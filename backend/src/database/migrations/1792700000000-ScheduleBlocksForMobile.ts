import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Mobile specialists (`freelance_mobile`) own no salon, so their schedule
 * blocks hang off their `specialists` row with `schedule_blocks.tenant_id`
 * NULL (ADR-011).
 *
 * RLS splits the table in two:
 *   - `tenant_id IS NOT NULL` -> read by the salon staff gate, scoped with
 *     `app.current_tenant_id` (the existing policy).
 *   - `tenant_id IS NULL`      -> read by the mobile specialist gate, scoped
 *     with `app.current_user_id`, the GUC `setUserContext` writes.
 *
 * The `EXCLUDE` constraint keeps two blocks of the same specialist from
 * overlapping; a whole-salon block (`specialist_id IS NULL`) overlaps with
 * every specialist's block in that salon, so it is its own exclusion group.
 */
export class ScheduleBlocksForMobile1792700000000 implements MigrationInterface {
  name = 'ScheduleBlocksForMobile1792700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `specialists.tenant_id` becomes nullable so a salon-independent
    // specialist can exist. The FK is dropped and re-added as DEFERRABLE:
    // a partial foreign key does not exist in PostgreSQL, and the rows that
    // do carry a tenant must still point at an existing one.
    await queryRunner.query(`ALTER TABLE specialists DROP CONSTRAINT IF EXISTS specialists_tenant_id_fkey`);
    await queryRunner.query(`ALTER TABLE specialists ALTER COLUMN "tenant_id" DROP NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE specialists ADD CONSTRAINT specialists_tenant_id_fkey
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
        DEFERRABLE INITIALLY DEFERRED
    `);

    // `schedule_blocks.tenant_id` follows the same rule.
    await queryRunner.query(`ALTER TABLE schedule_blocks DROP CONSTRAINT IF EXISTS schedule_blocks_tenant_id_fkey`);
    await queryRunner.query(`ALTER TABLE schedule_blocks ALTER COLUMN "tenant_id" DROP NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE schedule_blocks ADD CONSTRAINT schedule_blocks_tenant_id_fkey
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
        DEFERRABLE INITIALLY DEFERRED
    `);

    // The mobile branch of RLS: a block is visible to the mobile specialist
    // who owns it, and invisible to every salon. `FORCE ROW LEVEL SECURITY`
    // keeps the table owner from bypassing it.
    await queryRunner.query(`DROP POLICY IF EXISTS mobile_specialist_blocks ON schedule_blocks`);
    await queryRunner.query(`
      CREATE POLICY mobile_specialist_blocks ON schedule_blocks
      FOR ALL
      USING (
        tenant_id IS NULL
        AND specialist_id IS NOT NULL
        AND specialist_id IN (
          SELECT id FROM specialists
          WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
            AND is_active = true
        )
      )
      WITH CHECK (
        tenant_id IS NULL
        AND specialist_id IS NOT NULL
        AND specialist_id IN (
          SELECT id FROM specialists
          WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
            AND is_active = true
        )
      )
    `);

    // Whole-salon blocks (the "we are closed" range) belong to no specialist,
    // so every specialist of the salon is blocked. They carry no tenant and
    // are read by whoever holds the mobile GUC — the salon staff gate never
    // reaches them because it filters on `tenant_id`.
    await queryRunner.query(`DROP POLICY IF EXISTS whole_salon_blocks ON schedule_blocks`);
    await queryRunner.query(`
      CREATE POLICY whole_salon_blocks ON schedule_blocks
      FOR ALL
      USING (tenant_id IS NULL AND specialist_id IS NULL)
      WITH CHECK (tenant_id IS NULL AND specialist_id IS NULL)
    `);

    // A block cannot overlap another block of the same specialist, so a
    // provider cannot accidentally double-book their own off-time.
    await queryRunner.query(`ALTER TABLE schedule_blocks DROP CONSTRAINT IF EXISTS EX_schedule_blocks_no_overlap`);
    await queryRunner.query(`
      ALTER TABLE schedule_blocks ADD CONSTRAINT EX_schedule_blocks_no_overlap
        EXCLUDE USING gist (
          tenant_id WITH =,
          specialist_id WITH =,
          tstzrange(start_time, end_time, '[)') WITH &&
        )
        WITH (fillfactor = 70)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE schedule_blocks DROP CONSTRAINT IF EXISTS EX_schedule_blocks_no_overlap`);
    await queryRunner.query(`DROP POLICY IF EXISTS whole_salon_blocks ON schedule_blocks`);
    await queryRunner.query(`DROP POLICY IF EXISTS mobile_specialist_blocks ON schedule_blocks`);
    await queryRunner.query(`ALTER TABLE schedule_blocks DROP CONSTRAINT IF EXISTS schedule_blocks_tenant_id_fkey`);
    await queryRunner.query(`ALTER TABLE schedule_blocks ALTER COLUMN tenant_id SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE schedule_blocks ADD CONSTRAINT schedule_blocks_tenant_id_fkey
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`ALTER TABLE specialists DROP CONSTRAINT IF EXISTS specialists_tenant_id_fkey`);
    await queryRunner.query(`ALTER TABLE specialists ALTER COLUMN tenant_id SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE specialists ADD CONSTRAINT specialists_tenant_id_fkey
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }
}