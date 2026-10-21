import { MigrationInterface, QueryRunner } from 'typeorm';

export class RLSForSpecialists1792048339004 implements MigrationInterface {
  // Fixed name — see ExclusionConstraint for why a runtime-built name breaks.
  // This is the name already in the migrations ledger.
  name = 'RLSForSpecialists1792554473158';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The booking flow resolves a specialist before the tenant context is
    // known. All tenant-scoped specialist queries already include tenant_id.
    await queryRunner.query(`ALTER TABLE specialists DISABLE ROW LEVEL SECURITY`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS specialists_tenant_isolation ON specialists`);
    await queryRunner.query(`ALTER TABLE specialists NO FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE specialists DISABLE ROW LEVEL SECURITY`);
  }
}
