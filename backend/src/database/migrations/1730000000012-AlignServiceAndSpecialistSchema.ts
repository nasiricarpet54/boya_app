import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aligns `services` and `specialists` with their TypeORM entities, then seeds
 * specialist fixtures for the demo salons.
 *
 * The entities had drifted ahead of the schema: `services` was missing
 * `duration_minutes` (read by BookingService to compute the slot end) and
 * `is_active`, and `specialists` was missing everything except its four keys.
 * That made every entity-level read of these tables throw
 * `column Service.duration_minutes does not exist`, which is what broke
 * POST /bookings.
 *
 * Only columns the entities actually reference are added. The Stripe and booth
 * rent fields that exist elsewhere in the product are deliberately left out
 * until an entity declares them. Defaults match the entity decorators, not the
 * task brief, so DDL and entity stay in agreement.
 *
 * Every statement is guarded, so re-running is a no-op.
 */
export class AlignServiceAndSpecialistSchema1730000000012 implements MigrationInterface {
  name = 'AlignServiceAndSpecialistSchema1730000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.alignServices(queryRunner);
    await this.alignSpecialists(queryRunner);
    await this.seedSpecialists(queryRunner);
  }

  /**
   * `description`, `deposit_required` and `deposit_amount` already matched the
   * entity, so only the two genuinely missing columns are added.
   *
   * duration_minutes has no entity-level default; 60 is applied here because
   * the existing service rows need a concrete value.
   */
  private async alignServices(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE services ADD COLUMN IF NOT EXISTS duration_minutes INT NOT NULL DEFAULT 60`,
    );
    await queryRunner.query(
      `ALTER TABLE services ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_services_tenant_active ON services(tenant_id, is_active)`,
    );
  }

  private async alignSpecialists(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS bio TEXT`);
    await queryRunner.query(
      `ALTER TABLE specialists ADD COLUMN IF NOT EXISTS skills JSONB NOT NULL DEFAULT '[]'::jsonb`,
    );
    // 50 matches @Column({ default: 50 }) on the entity. Seeded rows below use
    // their own 55-70 values; the default only covers future inserts.
    await queryRunner.query(
      `ALTER TABLE specialists ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) NOT NULL DEFAULT 50`,
    );
    await queryRunner.query(
      `ALTER TABLE specialists ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_specialists_tenant_id ON specialists(tenant_id)`,
    );
  }

  /**
   * `specialists.user_id` is NOT NULL with a foreign key to `users`, so each
   * seeded specialist needs a real user row first.
   *
   * Ids are md5-derived from the tenant id and a 1..3 index, which makes the
   * whole seed idempotent: a second run recomputes the same uuids and every
   * insert conflicts on the primary key. Phones start at 09130000001 and are
   * unique per row, so they cannot clash with a real signup.
   *
   * The specialist insert joins against `users`, so a row whose user was
   * skipped (for example a phone collision) is dropped rather than violating
   * the foreign key.
   */
  private async seedSpecialists(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO users (id, tenant_id, phone, full_name, role, is_active)
      SELECT
        md5(x.tenant_id::text || ':spec-user:' || x.g)::uuid,
        x.tenant_id,
        '0913' || lpad(x.ord::text, 7, '0'),
        'متخصص نمونه ' || x.g,
        'specialist',
        true
      FROM (
        SELECT t.id AS tenant_id,
               g,
               (row_number() OVER (ORDER BY t.id) - 1) * 3 + g AS ord
        FROM tenants t
        CROSS JOIN generate_series(1, 3) AS g
      ) x
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO specialists (id, tenant_id, user_id, bio, skills, commission_rate, is_active)
      SELECT
        md5(x.tenant_id::text || ':spec:' || x.g)::uuid,
        x.tenant_id,
        md5(x.tenant_id::text || ':spec-user:' || x.g)::uuid,
        CASE x.g
          WHEN 1 THEN 'متخصص رنگ و مش با هشت سال سابقه کار در سالن‌های تهران.'
          WHEN 2 THEN 'متخصص کراتین و احیای مو، دارای گواهی بین‌المللی.'
          ELSE 'متخصص کوتاهی و براشینگ مو، مسلط به جدیدترین مدل‌ها.'
        END,
        CASE x.g
          WHEN 1 THEN '["رنگ مو","مش","هایلایت"]'::jsonb
          WHEN 2 THEN '["کراتین","احیا مو"]'::jsonb
          ELSE '["کوتاهی مو","براشینگ"]'::jsonb
        END,
        (54 + x.g * 5)::numeric(5, 2),
        true
      FROM (
        SELECT t.id AS tenant_id, g
        FROM tenants t
        CROSS JOIN generate_series(1, 3) AS g
      ) x
      JOIN users u ON u.id = md5(x.tenant_id::text || ':spec-user:' || x.g)::uuid
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove only the rows this migration created, recomputing the same keys.
    await queryRunner.query(`
      DELETE FROM specialists
      WHERE id IN (
        SELECT md5(x.tenant_id::text || ':spec:' || x.g)::uuid
        FROM (SELECT t.id AS tenant_id, g FROM tenants t CROSS JOIN generate_series(1, 3) AS g) x
      )
    `);
    await queryRunner.query(`
      DELETE FROM users
      WHERE id IN (
        SELECT md5(x.tenant_id::text || ':spec-user:' || x.g)::uuid
        FROM (SELECT t.id AS tenant_id, g FROM tenants t CROSS JOIN generate_series(1, 3) AS g) x
      )
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_services_tenant_active`);
    await queryRunner.query(`ALTER TABLE services DROP COLUMN IF EXISTS is_active`);
    await queryRunner.query(`ALTER TABLE services DROP COLUMN IF EXISTS duration_minutes`);

    await queryRunner.query(`ALTER TABLE specialists DROP COLUMN IF EXISTS is_active`);
    await queryRunner.query(`ALTER TABLE specialists DROP COLUMN IF EXISTS commission_rate`);
    await queryRunner.query(`ALTER TABLE specialists DROP COLUMN IF EXISTS skills`);
    await queryRunner.query(`ALTER TABLE specialists DROP COLUMN IF EXISTS bio`);
  }
}