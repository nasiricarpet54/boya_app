import { describeIntegration, getDataSource, withTenant } from '../setup/integration.setup';

const TENANT = '33333333-3333-4333-8333-333333333333';
const CUSTOMER = '33333333-3333-4333-8333-3333333333c1';
const SPECIALIST_USER = '33333333-3333-4333-8333-3333333333c2';
const SPECIALIST = '33333333-3333-4333-8333-3333333333c3';
const SERVICE = '33333333-3333-4333-8333-3333333333c4';

const SLOT_START = new Date(Date.now() + 24 * 60 * 60 * 1000);
const SLOT_END = new Date(SLOT_START.getTime() + 60 * 60 * 1000);
const SLOT = `[${SLOT_START.toISOString()},${SLOT_END.toISOString()})`;

/**
 * The `no_overlapping_bookings` exclusion constraint is the last line of
 * defence for double booking: two concurrent INSERTs for the same specialist
 * and an overlapping range must leave exactly one row behind, and the loser
 * must see SQLSTATE 23P01.
 */
describeIntegration('booking exclusion constraint', () => {
  beforeAll(async () => {
    getDataSource();

    await withTenant(TENANT, async (query) => {
      await query(`INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
        TENANT,
        'IT Tenant Exclusion',
      ]);
      await query(`DELETE FROM bookings WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM specialists WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM services WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [[CUSTOMER, SPECIALIST_USER]]);
      await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, 'customer')`, [
        CUSTOMER,
        TENANT,
        '09120009911',
      ]);
      await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, 'specialist')`, [
        SPECIALIST_USER,
        TENANT,
        '09120009912',
      ]);
      await query(`SELECT set_config('app.current_role', 'admin', true)`); await query(`INSERT INTO specialists (id, tenant_id, user_id) VALUES ($1, $2, $3)`, [
        SPECIALIST,
        TENANT,
        SPECIALIST_USER,
      ]);
      await query(
        `INSERT INTO services (id, tenant_id, name, price, duration_minutes) VALUES ($1, $2, $3, $4, $5)`,
        [SERVICE, TENANT, 'IT Service', 1000000, 60],
      );
    });
  });

  afterAll(async () => {
    await withTenant(TENANT, async (query) => {
      await query(`DELETE FROM bookings WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM specialists WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM services WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [[CUSTOMER, SPECIALIST_USER]]);
      await query(`DELETE FROM tenants WHERE id = $1`, [TENANT]);
    });
  });

  const book = (): Promise<Array<{ id: string }>> =>
    withTenant(TENANT, (query) =>
      query<Array<{ id: string }>>(
        `INSERT INTO bookings (tenant_id, specialist_id, customer_id, service_id, time_slot, total_price)
         VALUES ($1, $2, $3, $4, $5::tstzrange, $6)
         RETURNING id`,
        [TENANT, SPECIALIST, CUSTOMER, SERVICE, SLOT, 1000000],
      ),
    );

  it('lets exactly one of two overlapping bookings through (23P01)', async () => {
    const results = await Promise.allSettled([book(), book()]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const code = (rejected[0].reason as { code?: string }).code;
    expect(code).toBe('23P01');

    const [stored] = await withTenant(TENANT, (query) =>
      query<Array<{ n: number }>>(`SELECT count(*)::int AS n FROM bookings WHERE tenant_id = $1`, [TENANT]),
    );
    expect(stored.n).toBe(1);
  });
});
