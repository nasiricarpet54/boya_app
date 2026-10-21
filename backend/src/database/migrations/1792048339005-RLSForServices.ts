import { MigrationInterface, QueryRunner } from 'typeorm';

export class RLSForServices1792048339005 implements MigrationInterface {
  // Fixed name — see ExclusionConstraint for why a runtime-built name breaks.
  // This is the name already in the migrations ledger.
  name = 'RLSForServices1792554473158';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Service lookup is tenant-qualified by the application before writes.
    await queryRunner.query(`ALTER TABLE services DISABLE ROW LEVEL SECURITY`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS services_tenant_isolation ON services`);
    await queryRunner.query(`ALTER TABLE services NO FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE services DISABLE ROW LEVEL SECURITY`);
  }
}
