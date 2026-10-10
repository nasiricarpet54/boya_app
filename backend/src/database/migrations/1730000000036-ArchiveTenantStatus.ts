import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Archive tenant status.
 * Adds `archived` to the shared `approval_status` enum so DELETE on
 * /admin/tenants can hide a salon from the main list without conflating
 * it with `suspended`. Only tenants use this value.
 */
export class ArchiveTenantStatus1730000000036 implements MigrationInterface {
  name = 'ArchiveTenantStatus1730000000036';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'archived'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL cannot drop an enum value without recreating the type;
    // revert requires a new migration.
  }
}
