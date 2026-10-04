"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notifications1730000000005 = void 0;
class Notifications1730000000005 {
    name = 'Notifications1730000000005';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_read BOOLEAN NOT NULL DEFAULT false,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id)`);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
        ON notifications(user_id) WHERE is_read = false
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_created
        ON notifications(user_id, created_at DESC)
    `);
        await queryRunner.query(`ALTER TABLE notifications ENABLE ROW LEVEL SECURITY`);
        await queryRunner.query(`ALTER TABLE notifications FORCE ROW LEVEL SECURITY`);
        await queryRunner.query(`DROP POLICY IF EXISTS notifications_tenant_isolation ON notifications`);
        await queryRunner.query(`
      CREATE POLICY notifications_tenant_isolation ON notifications
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP POLICY IF EXISTS notifications_tenant_isolation ON notifications`);
        await queryRunner.query(`DROP TABLE IF EXISTS notifications`);
    }
}
exports.Notifications1730000000005 = Notifications1730000000005;
