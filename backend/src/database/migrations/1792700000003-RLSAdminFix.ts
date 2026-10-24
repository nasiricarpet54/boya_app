import { MigrationInterface, QueryRunner } from 'typeorm';

export class RLSAdminFix1792700000003 implements MigrationInterface {
  name = 'RLSAdminFix1792700000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tenants Table Policy
    // Admins (role = 'admin') should be able to see and modify ALL tenants.
    // Regular owners should only see their own tenant.

    await queryRunner.query(`DROP POLICY IF EXISTS tenants_tenant_isolation ON tenants`);
    await queryRunner.query(`
      CREATE POLICY tenants_role_isolation ON tenants
      USING (
        current_setting('app.current_role', true) = 'admin'
        OR id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      )
      WITH CHECK (
        current_setting('app.current_role', true) = 'admin'
        OR id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenants_role_isolation ON tenants`);
    await queryRunner.query(`
      CREATE POLICY tenants_tenant_isolation ON tenants
      USING (id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
      WITH CHECK (id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
    `);
  }
}
