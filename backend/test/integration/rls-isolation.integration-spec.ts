import { describeIntegration, getDataSource, withTenant } from '../setup/integration.setup';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const USER_A = '11111111-1111-4111-8111-1111111111a1';
const USER_B = '22222222-2222-4222-8222-2222222222b1';

/**
 * Proves the RLS contract on a real database: two tenants, one user each, and
 * the `beauty_app` role (NOBYPASSRLS) doing the reading. The superuser would
 * bypass every policy, so it is never used for the assertions.
 */
describeIntegration('RLS tenant isolation', () => {
  beforeAll(async () => {
    getDataSource();

    await withTenant(TENANT_A, async (query) => {
      await query(`INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
        TENANT_A,
        'IT Tenant A',
      ]);
      await query(`DELETE FROM users WHERE id = $1`, [USER_A]);
      await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, 'customer')`, [
        USER_A,
        TENANT_A,
        '09120009901',
      ]);
    });

    await withTenant(TENANT_B, async (query) => {
      await query(`INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
        TENANT_B,
        'IT Tenant B',
      ]);
      await query(`DELETE FROM users WHERE id = $1`, [USER_B]);
      await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, 'customer')`, [
        USER_B,
        TENANT_B,
        '09120009902',
      ]);
    });
  });

  afterAll(async () => {
    for (const [tenantId, userId] of [
      [TENANT_A, USER_A],
      [TENANT_B, USER_B],
    ]) {
      await withTenant(tenantId, async (query) => {
        await query(`DELETE FROM users WHERE id = $1`, [userId]);
        await query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
      });
    }
  });

  it("hides the other tenant's rows", async () => {
    const [foreign] = await withTenant(TENANT_A, (query) =>
      query<Array<{ n: number }>>(`SELECT count(*)::int AS n FROM users WHERE tenant_id = $1`, [TENANT_B]),
    );
    expect(foreign.n).toBe(0);

    const [own] = await withTenant(TENANT_A, (query) =>
      query<Array<{ n: number }>>(`SELECT count(*)::int AS n FROM users WHERE id = $1`, [USER_A]),
    );
    expect(own.n).toBe(1);
  });

  it('refuses a cross-tenant INSERT through WITH CHECK', async () => {
    await expect(
      withTenant(TENANT_A, (query) =>
        query(`INSERT INTO users (tenant_id, phone, role) VALUES ($1, $2, 'customer')`, [
          TENANT_B,
          '09120009999',
        ]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });
});
