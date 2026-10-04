import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unify the four non-bookings tenant RLS policies on `app.current_tenant_id`
 * (ADR-001): users (1730000000002), service_lines (1730000000003),
 * transactions (1730000000004) and notifications (1730000000005).
 *
 * The app writes one GUC only (setTenantContext), so their policies are
 * recreated here on the standard spelling (USING + WITH CHECK) for databases
 * that ran the old SQL; on fresh installs the source migrations already carry
 * it and this run is a no-op. `bookings` is normalized by 1730000000027,
 * because its own policy predates this standard.
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
          USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
          WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
      `);
    }
  }

  /**
   * Not reversible: the app only ever writes `app.current_tenant_id` (setTenantContext),
   * so restoring any other spelling would leave every tenant-scoped table
   * filtered to zero rows. Reverting means a follow-up migration, not a down().
   */
  public async down(): Promise<void> {
    // intentionally empty
  }
}
