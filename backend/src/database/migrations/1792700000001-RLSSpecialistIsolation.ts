import { MigrationInterface, QueryRunner } from 'typeorm';

export class RLSSpecialistIsolation1792700000001 implements MigrationInterface {
  name = 'RLSSpecialistIsolation1792700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const roleBasedTables = ['bookings', 'schedule_blocks', 'accounting_ledgers', 'specialists'];

    for (const table of roleBasedTables) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`DROP POLICY IF EXISTS ${table}_tenant_isolation ON "${table}"`);
      await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_policy ON "${table}"`); // specific for schedule_blocks
    }

    // We enforce a unified policy:
    // If you are 'owner' or 'admin', you get access to all rows where tenant_id matches your current_tenant_id.
    // If you are a 'specialist', you only get access to rows where `specialist_id` belongs to you (via specialists table matching your user_id) AND tenant_id matches current_tenant_id.

    // 1. Specialists Table Policy
    // Specialists need to see themselves, but not others if they are just a specialist.
    // Owners need to see all specialists in the tenant.
    await queryRunner.query(`
      CREATE POLICY specialists_role_isolation ON specialists
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        AND (
          current_setting('app.current_role', true) IN ('owner', 'admin')
          OR (
            current_setting('app.current_role', true) = 'specialist'
            AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
          )
        )
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        AND (
          current_setting('app.current_role', true) IN ('owner', 'admin')
          OR (
            current_setting('app.current_role', true) = 'specialist'
            AND user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
          )
        )
      );
    `);

    // 2. Bookings Table Policy
    await queryRunner.query(`
      CREATE POLICY bookings_role_isolation ON bookings
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        AND (
          current_setting('app.current_role', true) IN ('owner', 'admin')
          OR (
            current_setting('app.current_role', true) = 'specialist'
            AND specialist_id IN (
              SELECT id FROM specialists WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
            )
          )
        )
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        AND (
          current_setting('app.current_role', true) IN ('owner', 'admin')
          OR (
            current_setting('app.current_role', true) = 'specialist'
            AND specialist_id IN (
              SELECT id FROM specialists WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
            )
          )
        )
      );
    `);

    // 3. Accounting Ledgers Table Policy
    await queryRunner.query(`
      CREATE POLICY accounting_ledgers_role_isolation ON accounting_ledgers
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        AND (
          current_setting('app.current_role', true) IN ('owner', 'admin')
          OR (
            current_setting('app.current_role', true) = 'specialist'
            AND booking_id IN (
              SELECT b.id FROM bookings b
              JOIN specialists s ON b.specialist_id = s.id
              WHERE s.user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
            )
          )
        )
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        AND (
          current_setting('app.current_role', true) IN ('owner', 'admin')
          OR (
            current_setting('app.current_role', true) = 'specialist'
            AND booking_id IN (
              SELECT b.id FROM bookings b
              JOIN specialists s ON b.specialist_id = s.id
              WHERE s.user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
            )
          )
        )
      );
    `);

    // 4. Schedule Blocks Table Policy (Tenant specific blocks, not the mobile freelance ones)
    await queryRunner.query(`
      CREATE POLICY schedule_blocks_role_isolation ON schedule_blocks
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        AND (
          current_setting('app.current_role', true) IN ('owner', 'admin')
          OR (
            current_setting('app.current_role', true) = 'specialist'
            AND specialist_id IN (
              SELECT id FROM specialists WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
            )
          )
        )
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
        AND (
          current_setting('app.current_role', true) IN ('owner', 'admin')
          OR (
            current_setting('app.current_role', true) = 'specialist'
            AND specialist_id IN (
              SELECT id FROM specialists WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
            )
          )
        )
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const roleBasedTables = ['bookings', 'schedule_blocks', 'accounting_ledgers', 'specialists'];

    for (const table of roleBasedTables) {
      await queryRunner.query(`DROP POLICY IF EXISTS ${table}_role_isolation ON "${table}"`);
      await queryRunner.query(`
        CREATE POLICY ${table}_tenant_isolation ON "${table}"
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
      `);
    }
  }
}
