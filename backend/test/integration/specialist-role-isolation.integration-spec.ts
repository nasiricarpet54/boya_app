import { describeIntegration, getDataSource, withTenantAndUserAndRole } from '../setup/integration.setup';

const TENANT = '44444444-4444-4444-4444-444444444444';
const OWNER_USER = '44444444-4444-4444-4444-4444444444o1';
const SPEC1_USER = '44444444-4444-4444-4444-4444444444s1';
const SPEC2_USER = '44444444-4444-4444-4444-4444444444s2';
const CUSTOMER_USER = '44444444-4444-4444-4444-4444444444c1';

const SPEC1 = '44444444-4444-4444-4444-444444444s1s';
const SPEC2 = '44444444-4444-4444-4444-444444444s2s';
const SERVICE = '44444444-4444-4444-4444-444444444sv1';

const SLOT1 = `[2026-11-01 10:00:00Z,2026-11-01 11:00:00Z)`;
const SLOT2 = `[2026-11-01 12:00:00Z,2026-11-01 13:00:00Z)`;

/**
 * Validates the new RBAC RLS policies that restrict a specialist to only their own data,
 * preventing cross-specialist data leakage inside the same tenant.
 */
describeIntegration('Specialist RLS Role Isolation', () => {
  beforeAll(async () => {
    getDataSource();

    // We insert as owner first to bypass RLS restrictions during setup
    await withTenantAndUserAndRole(TENANT, OWNER_USER, 'owner', async (query) => {
      await query(`INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
        TENANT,
        'Role Isolation Salon',
      ]);

      // Cleanup previous runs if any
      await query(`DELETE FROM bookings WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM specialists WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM services WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM users WHERE tenant_id = $1`, [TENANT]);

      // Seed Users
      await query(`INSERT INTO users (id, tenant_id, full_name, phone, role) VALUES ($1, $2, 'Owner', '09120000001', 'owner')`, [OWNER_USER, TENANT]);
      await query(`INSERT INTO users (id, tenant_id, full_name, phone, role) VALUES ($1, $2, 'Spec 1', '09120000002', 'specialist')`, [SPEC1_USER, TENANT]);
      await query(`INSERT INTO users (id, tenant_id, full_name, phone, role) VALUES ($1, $2, 'Spec 2', '09120000003', 'specialist')`, [SPEC2_USER, TENANT]);
      await query(`INSERT INTO users (id, tenant_id, full_name, phone, role) VALUES ($1, $2, 'Cust 1', '09120000004', 'customer')`, [CUSTOMER_USER, TENANT]);

      // Seed Specialists
      await query(`INSERT INTO specialists (id, tenant_id, user_id) VALUES ($1, $2, $3)`, [SPEC1, TENANT, SPEC1_USER]);
      await query(`INSERT INTO specialists (id, tenant_id, user_id) VALUES ($1, $2, $3)`, [SPEC2, TENANT, SPEC2_USER]);

      // Seed Services
      await query(`INSERT INTO services (id, tenant_id, name, price, duration_minutes) VALUES ($1, $2, 'Haircut', 1000000, 60)`, [SERVICE, TENANT]);

      // Seed Bookings
      // Booking 1 for Specialist 1
      await query(
        `INSERT INTO bookings (tenant_id, specialist_id, customer_id, service_id, time_slot, total_price) VALUES ($1, $2, $3, $4, $5::tstzrange, $6)`,
        [TENANT, SPEC1, CUSTOMER_USER, SERVICE, SLOT1, 1000000]
      );

      // Booking 2 for Specialist 2
      await query(
        `INSERT INTO bookings (tenant_id, specialist_id, customer_id, service_id, time_slot, total_price) VALUES ($1, $2, $3, $4, $5::tstzrange, $6)`,
        [TENANT, SPEC2, CUSTOMER_USER, SERVICE, SLOT2, 1000000]
      );
    });
  });

  afterAll(async () => {
    await withTenantAndUserAndRole(TENANT, OWNER_USER, 'owner', async (query) => {
      await query(`DELETE FROM bookings WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM specialists WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM services WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM users WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM tenants WHERE id = $1`, [TENANT]);
    });
  });

  it('Owner should see all bookings in the salon', async () => {
    const res = await withTenantAndUserAndRole(TENANT, OWNER_USER, 'owner', async (query) => {
      return query<{ count: number }[]>(`SELECT COUNT(*)::int as count FROM bookings`);
    });
    expect(res[0].count).toBe(2);
  });

  it('Specialist 1 should ONLY see their own bookings (count = 1)', async () => {
    const res = await withTenantAndUserAndRole(TENANT, SPEC1_USER, 'specialist', async (query) => {
      return query<{ count: number }[]>(`SELECT COUNT(*)::int as count FROM bookings`);
    });
    expect(res[0].count).toBe(1);

    // Validate it's actually their booking
    const bookings = await withTenantAndUserAndRole(TENANT, SPEC1_USER, 'specialist', async (query) => {
      return query<{ specialist_id: string }[]>(`SELECT specialist_id FROM bookings`);
    });
    expect(bookings[0].specialist_id).toBe(SPEC1);
  });

  it('Specialist 2 should ONLY see their own bookings (count = 1)', async () => {
    const res = await withTenantAndUserAndRole(TENANT, SPEC2_USER, 'specialist', async (query) => {
      return query<{ count: number }[]>(`SELECT COUNT(*)::int as count FROM bookings`);
    });
    expect(res[0].count).toBe(1);

    // Validate it's actually their booking
    const bookings = await withTenantAndUserAndRole(TENANT, SPEC2_USER, 'specialist', async (query) => {
      return query<{ specialist_id: string }[]>(`SELECT specialist_id FROM bookings`);
    });
    expect(bookings[0].specialist_id).toBe(SPEC2);
  });
});
