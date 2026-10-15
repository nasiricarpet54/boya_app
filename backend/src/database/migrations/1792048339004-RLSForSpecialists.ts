import { MigrationInterface, QueryRunner } from 'typeorm';

export class RLSForSpecialists1792048339004 implements MigrationInterface {
  name = 'RLSForSpecialists' + String(Date.now()); // Fallback name

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE specialists ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE specialists FORCE ROW LEVEL SECURITY`);

    const res = await queryRunner.query(`
      SELECT policyname
      FROM pg_policies
      WHERE tablename = 'specialists' AND policyname = 'specialists_tenant_isolation'
    `);

    if (res.length === 0) {
      await queryRunner.query(`
        CREATE POLICY specialists_tenant_isolation ON specialists
        USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS specialists_tenant_isolation ON specialists`);
    await queryRunner.query(`ALTER TABLE specialists NO FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE specialists DISABLE ROW LEVEL SECURITY`);
  }
}
