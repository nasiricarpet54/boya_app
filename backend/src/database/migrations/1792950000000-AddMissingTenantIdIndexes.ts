import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The two tenant-scoped RLS tables that had no B-tree index with `tenant_id`
 * as the leading column. Their policies filter `tenant_id = app.current_tenant_id`,
 * so without one the planner Seq-Scans on every panel query. `accounting_ledgers`
 * had no tenant index at all; `schedule_blocks` only had *partial* ones
 * (1792800000000, both `WHERE`-restricted), which do not cover whole-salon
 * blocks. Every other tenant-scoped RLS table already had one — the audit that
 * proves that lives in rls-tenant-indexes.spec.ts.
 */
export class AddMissingTenantIdIndexes1792950000000 implements MigrationInterface {
  name = 'AddMissingTenantIdIndexes1792950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_schedule_blocks_tenant_id ON schedule_blocks (tenant_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_accounting_ledgers_tenant_id ON accounting_ledgers (tenant_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_schedule_blocks_tenant_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_accounting_ledgers_tenant_id`);
  }
}
