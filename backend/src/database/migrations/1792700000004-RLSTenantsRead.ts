import { MigrationInterface, QueryRunner } from 'typeorm';

export class RLSTenantsRead1792700000004 implements MigrationInterface {
  name = 'RLSTenantsRead1792700000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Customers need to be able to read tenant data (like working hours) during booking.
    await queryRunner.query(`
      CREATE POLICY tenants_public_read ON tenants
      FOR SELECT
      USING (true);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenants_public_read ON tenants`);
  }
}
