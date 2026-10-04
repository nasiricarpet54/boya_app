import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-001: every tenant policy must read `app.current_tenant_id` with
 * NULLIF(...,'')::uuid.
 *
 * 1730000000000 created `bookings_tenant_isolation` on an interim GUC
 * spelling, and 1730000000026 (already applied here) left
 * users / service_lines / transactions / notifications on that same interim
 * spelling. The application now sets one GUC only — setTenantContext writes
 * `app.current_tenant_id` — so this migration recreates all five policies on
 * the standard spelling (USING + WITH CHECK).
 *
 * The source files of the older migrations already carry the standard
 * spelling, so on a fresh database every policy is created correctly from the
 * start and this migration merely re-creates identical ones.
 */
export class UnifyTenantGuc1730000000027 implements MigrationInterface {
  name = 'UnifyTenantGuc1730000000027';

  private readonly policies: Array<{ table: string; policy: string }> = [
    { table: 'bookings', policy: 'bookings_tenant_isolation' },
    { table: 'users', policy: 'users_tenant_isolation' },
    { table: 'service_lines', policy: 'service_lines_tenant_isolation' },
    { table: 'transactions', policy: 'transactions_tenant_isolation' },
    { table: 'notifications', policy: 'notifications_tenant_isolation' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { table, policy } of this.policies) {
      await queryRunner.query(`DROP POLICY IF EXISTS ${policy} ON ${table}`);
      await queryRunner.query(`
        CREATE POLICY ${policy} ON ${table}
          USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
          WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
      `);
    }
  }

  /**
   * Not reversible: the app only ever writes `app.current_tenant_id`
   * (setTenantContext), so restoring any other spelling would leave every
   * tenant-scoped table filtered to zero rows. Reverting means a follow-up
   * migration, not a down().
   */
  public async down(): Promise<void> {
    // intentionally empty
  }
}
