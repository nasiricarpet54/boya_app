import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-001: every tenant policy must read `app.current_tenant_id` with
 * NULLIF(...,'')::uuid.
 *
 * This is the single place that defines tenant policies. The older migrations
 * create the tables and enable RLS (bookings in 1730000000000; users,
 * service_lines, transactions and notifications in 1730000000002–0005) but
 * define no policy, and 1730000000026 is a no-op.
 *
 * The application sets one GUC only (setTenantContext writes
 * `app.current_tenant_id`), so all five policies are (re)created here on the
 * standard spelling, USING + WITH CHECK, for fresh and existing databases
 * alike.
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
