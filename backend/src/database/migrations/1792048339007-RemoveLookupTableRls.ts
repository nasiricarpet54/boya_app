import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Specialists and services are lookup tables. Their application queries
 * already require an explicit tenant_id, while booking creation must resolve
 * a specialist before the tenant context is known. Keeping FORCE RLS here
 * makes that valid flow impossible for the least-privileged app role.
 */
export class RemoveLookupTableRls1792048339007 implements MigrationInterface {
  name = 'RemoveLookupTableRls1792048339007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['specialists', 'services']) {
      await queryRunner.query(`DROP POLICY IF EXISTS ${table}_tenant_isolation ON ${table}`);
      await queryRunner.query(`ALTER TABLE ${table} NO FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['specialists', 'services']) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY ${table}_tenant_isolation ON ${table}
        USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
      `);
    }
  }
}
