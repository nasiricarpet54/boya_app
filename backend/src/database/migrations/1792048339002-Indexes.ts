import { MigrationInterface, QueryRunner } from 'typeorm';

export class Indexes1792048339002 implements MigrationInterface {
  name = 'Indexes' + String(Date.now()); // Fallback name

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_bookings_tenant_time ON bookings (tenant_id, created_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_transactions_tenant_status ON transactions (tenant_id, payment_status)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bookings_tenant_time`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_transactions_tenant_status`);
  }
}
