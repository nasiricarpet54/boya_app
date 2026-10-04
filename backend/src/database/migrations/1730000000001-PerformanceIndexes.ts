import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes only for columns that exist.
 * skills, is_active, line_id, transactions, notifications, and referrals do not.
 * The booking gist index and tenant policy already exist and stay unchanged.
 */
export class PerformanceIndexes1730000000001 implements MigrationInterface {
  name = 'PerformanceIndexes1730000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_specialists_tenant_id ON specialists(tenant_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_services_tenant_id ON services(tenant_id)`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_bookings_tenant_status ON bookings(tenant_id, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_bookings_tenant_created ON bookings(tenant_id, created_at DESC)`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_bookings_time_slot ON bookings USING GIST (time_slot)`);
    await queryRunner.query(`
      ALTER TABLE bookings SET (
        autovacuum_vacuum_scale_factor = 0.05,
        autovacuum_analyze_scale_factor = 0.02
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bookings RESET (autovacuum_vacuum_scale_factor, autovacuum_analyze_scale_factor)`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bookings_time_slot`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bookings_customer`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bookings_tenant_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bookings_tenant_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_services_tenant_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_specialists_tenant_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_phone`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_users_tenant_id`);
  }
}
