import { MigrationInterface, QueryRunner } from 'typeorm';

export class RLSForServices1792048339005 implements MigrationInterface {
  name = 'RLSForServices' + String(Date.now()); // Fallback name

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE services ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE services FORCE ROW LEVEL SECURITY`);

    const res = await queryRunner.query(`
      SELECT policyname
      FROM pg_policies
      WHERE tablename = 'services' AND policyname = 'services_tenant_isolation'
    `);

    if (res.length === 0) {
      await queryRunner.query(`
        CREATE POLICY services_tenant_isolation ON services
        USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS services_tenant_isolation ON services`);
    await queryRunner.query(`ALTER TABLE services NO FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE services DISABLE ROW LEVEL SECURITY`);
  }
}
