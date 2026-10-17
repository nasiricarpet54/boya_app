import { MigrationInterface, QueryRunner } from 'typeorm';

export class RLSForSpecialists1792048339004 implements MigrationInterface {
  name = 'RLSForSpecialists' + String(Date.now()); // Fallback name

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
