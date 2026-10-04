"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantUserProfile1730000000002 = void 0;
class TenantUserProfile1730000000002 {
    name = 'TenantUserProfile1730000000002';
    async up(queryRunner) {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
        await queryRunner.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS name_en VARCHAR(255)`);
        await queryRunner.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug VARCHAR(100)`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug) WHERE slug IS NOT NULL`);
        await queryRunner.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address TEXT`);
        await queryRunner.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`);
        await queryRunner.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE users ALTER COLUMN full_name DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
        await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'customer'`);
        await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON users(phone)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role)`);
        await queryRunner.query(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);
        await queryRunner.query(`ALTER TABLE users FORCE ROW LEVEL SECURITY`);
        await queryRunner.query(`DROP POLICY IF EXISTS users_tenant_isolation ON users`);
        await queryRunner.query(`
      CREATE POLICY users_tenant_isolation ON users
        USING (
          tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        WITH CHECK (
          tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP POLICY IF EXISTS users_tenant_isolation ON users`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_users_tenant_role`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_users_phone_unique`);
        await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS is_active`);
        await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS role`);
        await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS avatar_url`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_tenants_slug`);
        await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS is_active`);
        await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS phone`);
        await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS address`);
        await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS slug`);
        await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS name_en`);
    }
}
exports.TenantUserProfile1730000000002 = TenantUserProfile1730000000002;
