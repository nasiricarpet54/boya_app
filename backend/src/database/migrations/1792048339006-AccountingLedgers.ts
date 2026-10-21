import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountingLedgers1792048339006 implements MigrationInterface {
  // Fixed name — see ExclusionConstraint for why a runtime-built name breaks.
  // This is the name already in the migrations ledger.
  name = 'AccountingLedgers1792554473158';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Keep the full booking lifecycle, including newly created pending rows.
    await queryRunner.query(`ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check`);
    await queryRunner.query(`ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK ("status" IN ('pending','confirmed','cancelled','completed','no_show','reviewed'))`);

    // 2. Add no_show_count and late_cancel_count to users
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS no_show_count INT DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS late_cancel_count INT DEFAULT 0`);

    // 3. Create accounting_ledgers table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS accounting_ledgers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        booking_id UUID REFERENCES bookings(id),
        payment_method VARCHAR NOT NULL CHECK (payment_method IN ('pos', 'cash', 'card_transfer', 'package')),
        total_amount NUMERIC(10, 2) NOT NULL,
        specialist_share_percent NUMERIC(5, 2) NOT NULL,
        salon_share_percent NUMERIC(5, 2) NOT NULL,
        specialist_share_amount NUMERIC(10, 2) NOT NULL,
        salon_share_amount NUMERIC(10, 2) NOT NULL,
        is_settled_internally BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Optional: Enable RLS on accounting_ledgers
    await queryRunner.query(`ALTER TABLE accounting_ledgers ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE accounting_ledgers FORCE ROW LEVEL SECURITY`);

    // ✅ حذف پالیسی قبلی و ساخت پالیسی جدید با WITH CHECK
    await queryRunner.query(`DROP POLICY IF EXISTS accounting_ledgers_tenant_isolation ON accounting_ledgers`);
    
    await queryRunner.query(`
      CREATE POLICY accounting_ledgers_tenant_isolation ON accounting_ledgers
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS accounting_ledgers`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS no_show_count`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS late_cancel_count`);
  }
}
