"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceLines1730000000003 = void 0;
class ServiceLines1730000000003 {
    name = 'ServiceLines1730000000003';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS service_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, name)
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_service_lines_tenant ON service_lines(tenant_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_service_lines_manager ON service_lines(manager_id)`);
        await queryRunner.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS line_id UUID REFERENCES service_lines(id) ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT`);
        await queryRunner.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS deposit_required BOOLEAN NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(12,0)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_services_line ON services(line_id)`);
        for (const table of ['service_lines']) {
            await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
            await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
            await queryRunner.query(`DROP POLICY IF EXISTS ${table}_tenant_isolation ON ${table}`);
            await queryRunner.query(`
        CREATE POLICY ${table}_tenant_isolation ON ${table}
          USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
          WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
      `);
        }
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE services DROP COLUMN IF EXISTS deposit_amount`);
        await queryRunner.query(`ALTER TABLE services DROP COLUMN IF EXISTS deposit_required`);
        await queryRunner.query(`ALTER TABLE services DROP COLUMN IF EXISTS description`);
        await queryRunner.query(`ALTER TABLE services DROP COLUMN IF EXISTS line_id`);
        await queryRunner.query(`DROP POLICY IF EXISTS service_lines_tenant_isolation ON service_lines`);
        await queryRunner.query(`DROP TABLE IF EXISTS service_lines`);
    }
}
exports.ServiceLines1730000000003 = ServiceLines1730000000003;
