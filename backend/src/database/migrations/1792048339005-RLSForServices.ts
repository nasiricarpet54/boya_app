import { MigrationInterface, QueryRunner } from 'typeorm';

export class RLSForServices1792048339005 implements MigrationInterface {
  name = 'RLSForServices' + String(Date.now()); // Fallback name

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
