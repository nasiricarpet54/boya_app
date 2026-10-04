import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bookings plus the parent rows their foreign keys need.
 * Jalali is not a column: Postgres to_char is Gregorian, and display
 * conversion stays in date-fns-jalali.
 */
export class CreateBookings1730000000000 implements MigrationInterface {
  name = 'CreateBookings1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        full_name VARCHAR(200) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS specialists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        user_id UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS services (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        name VARCHAR(200) NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        specialist_id UUID NOT NULL REFERENCES specialists(id),
        customer_id UUID NOT NULL REFERENCES users(id),
        service_id UUID NOT NULL REFERENCES services(id),
        time_slot TSTZRANGE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','confirmed','cancelled','completed','no_show')),
        total_price NUMERIC(10,2) NOT NULL,
        deposit_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
        flexible_specialist BOOLEAN NOT NULL DEFAULT false,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT no_overlapping_bookings
          EXCLUDE USING gist (
            specialist_id WITH =,
            time_slot WITH &&
          ) WHERE (status NOT IN ('cancelled', 'no_show'))
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_bookings_tenant_id ON bookings(tenant_id)`);
    await queryRunner.query(
      `CREATE INDEX idx_bookings_specialist_time ON bookings USING GIST (specialist_id, time_slot)`,
    );

    await queryRunner.query(`ALTER TABLE bookings ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE bookings FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY bookings_tenant_isolation ON bookings
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS bookings_tenant_isolation ON bookings`);
    await queryRunner.query(`DROP TABLE IF EXISTS bookings`);
    await queryRunner.query(`DROP TABLE IF EXISTS services`);
    await queryRunner.query(`DROP TABLE IF EXISTS specialists`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenants`);
  }
}
