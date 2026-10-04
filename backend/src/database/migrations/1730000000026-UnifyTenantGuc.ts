import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unify every tenant RLS policy on `app.tenant_id`.
 *
 * History: bookings (1730000000000) always used `app.tenant_id`, while users
 * (1730000000002), service_lines (1730000000003), transactions (1730000000004)
 * and notifications (1730000000005) were created with a legacy GUC spelling
 * the app no longer sets. The app writes one GUC only (setTenantContext), so
 * this migration recreates the four policies on `app.tenant_id` (USING +
 * WITH CHECK) on databases that already ran the old SQL. The source files of
 * 1730000000002–0005 now carry the unified spelling too, so fresh installs
 * land on `app.tenant_id` from the start and this migration is a no-op there.
 */
export class UnifyTenantGuc1730000000026 implements MigrationInterface {
  name = 'UnifyTenantGuc1730000000026';

  private readonly policies: Array<{ table: string; policy: string }> = [
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
          USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
          WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      `);
    }
  }

  /**
   * Not reversible: the app only ever writes `app.tenant_id` (setTenantContext),
   * so restoring any other spelling would leave every tenant-scoped table
   * filtered to zero rows. Reverting means a follow-up migration, not a down().
   */
  public async down(): Promise<void> {
    // intentionally empty
  }
}
