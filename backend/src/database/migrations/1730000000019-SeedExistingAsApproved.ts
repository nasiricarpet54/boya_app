import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed existing records as approved.
 * All existing records are assumed to be active and should be marked as approved.
 */
export class SeedExistingAsApproved1730000000019 implements MigrationInterface {
  name = 'SeedExistingAsApproved1730000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Seed all tenants as approved
    await queryRunner.query(`
      UPDATE tenants SET status = 'approved', approved_at = NOW(), approved_by = NULL
      WHERE status != 'approved'
    `);

    // Seed all service lines as approved
    await queryRunner.query(`
      UPDATE service_lines SET status = 'approved', approved_at = NOW(), approved_by = NULL
      WHERE status != 'approved'
    `);

    // Seed all specialists as approved
    await queryRunner.query(`
      UPDATE specialists SET status = 'approved', approved_at = NOW(), approved_by = NULL
      WHERE status != 'approved'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reset all statuses to draft (for rollback safety)
    await queryRunner.query(`
      UPDATE tenants SET status = 'draft'
    `);
    await queryRunner.query(`
      UPDATE service_lines SET status = 'draft'
    `);
    await queryRunner.query(`
      UPDATE specialists SET status = 'draft'
    `);
  }
}