import { describeIntegration, queryAsAdmin } from '../setup/integration.setup';

interface PolicyRow extends Record<string, unknown> {
  tablename: string;
  policyname: string;
  qual: string | null;
  with_check: string | null;
}

/** The five tenant-scoped tables, as published by the migration chain. */
const TENANT_TABLES = ['bookings', 'notifications', 'service_lines', 'transactions', 'users'];

describeIntegration('tenant policies (pg_policies)', () => {
  it('defines every tenant policy on app.current_tenant_id only', async () => {
    const rows = await queryAsAdmin<PolicyRow>(
      `SELECT tablename, policyname, qual, with_check
         FROM pg_policies
        WHERE schemaname = 'public' AND policyname LIKE '%_tenant_isolation'
        ORDER BY tablename`,
    );

    expect(rows.map((row) => row.tablename)).toEqual(TENANT_TABLES);

    for (const row of rows) {
      const using = String(row.qual ?? '');
      const check = String(row.with_check ?? '');

      expect(using).toContain('app.current_tenant_id');
      expect(using).not.toContain('app.tenant_id');
      expect(check).toContain('app.current_tenant_id');
      expect(check).not.toContain('app.tenant_id');
    }
  });
});
