"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transactions1730000000004 = void 0;
class Transactions1730000000004 {
    name = 'Transactions1730000000004';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
        provider VARCHAR(20) NOT NULL,
        provider_intent_id VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        total_amount DECIMAL(12,0) NOT NULL,
        platform_fee DECIMAL(12,0) NOT NULL DEFAULT 0,
        specialist_share DECIMAL(12,0) NOT NULL DEFAULT 0,
        salon_share DECIMAL(12,0) NOT NULL DEFAULT 0,
        refund_amount DECIMAL(12,0) NOT NULL DEFAULT 0,
        provider_refund_id VARCHAR(255),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        captured_at TIMESTAMPTZ,
        refunded_at TIMESTAMPTZ
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON transactions(tenant_id, status)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_transactions_intent ON transactions(provider, provider_intent_id)`);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS processed_webhook_events (
        event_id VARCHAR(255) PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
        await queryRunner.query(`ALTER TABLE transactions ENABLE ROW LEVEL SECURITY`);
        await queryRunner.query(`ALTER TABLE transactions FORCE ROW LEVEL SECURITY`);
        await queryRunner.query(`DROP POLICY IF EXISTS transactions_tenant_isolation ON transactions`);
        await queryRunner.query(`
      CREATE POLICY transactions_tenant_isolation ON transactions
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP POLICY IF EXISTS transactions_tenant_isolation ON transactions`);
        await queryRunner.query(`DROP TABLE IF EXISTS processed_webhook_events`);
        await queryRunner.query(`DROP TABLE IF EXISTS transactions`);
    }
}
exports.Transactions1730000000004 = Transactions1730000000004;
