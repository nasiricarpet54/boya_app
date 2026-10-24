import { MigrationInterface, QueryRunner } from 'typeorm';

export class RLSReadAccess1792700000002 implements MigrationInterface {
  name = 'RLSReadAccess1792700000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Customers need to be able to read specialists and services to book them.
    // The previous migration locked them down to owners and specific specialists only.
    // We will add a read-only policy for everyone (or specifically for customers / public reads)
    // so `findOne` calls without a tenant context or role context don't fail for customers.

    await queryRunner.query(`
      CREATE POLICY specialists_public_read ON specialists
      FOR SELECT
      USING (true);
    `);

    await queryRunner.query(`
      CREATE POLICY services_public_read ON services
      FOR SELECT
      USING (true);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS specialists_public_read ON specialists`);
    await queryRunner.query(`DROP POLICY IF EXISTS services_public_read ON services`);
  }
}
