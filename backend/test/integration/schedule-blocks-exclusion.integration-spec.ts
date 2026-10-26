import { describeIntegration, getDataSource, withTenant } from '../setup/integration.setup';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const CUSTOMER = '33333333-3333-4333-8333-3333333333c1';
const SPECIALIST_USER = '33333333-3333-4333-8333-3333333333c2';
const SPECIALIST = '33333333-3333-4333-8333-3333333333c3';
const SERVICE = '33333333-3333-4333-8333-3333333333c4';
const MOBILE_SPECIALIST_USER = '44444444-4444-4444-8444-4444444444c2';
const MOBILE_SPECIALIST = '44444444-4444-4444-8444-4444444444c3';

const SLOT_START = new Date(Date.now() + 24 * 60 * 60 * 1000);
const SLOT_END = new Date(SLOT_START.getTime() + 60 * 60 * 1000);

describeIntegration('Schedule Blocks: exclusion and isolation', () => {
  beforeAll(async () => {
    getDataSource();

    await withTenant(TENANT_A, async (query) => {
      await query(`INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [TENANT_A, 'Test Saloon A']);
      await query(`DELETE FROM bookings WHERE tenant_id = $1`, [TENANT_A]);
      await query(`DELETE FROM schedule_blocks WHERE tenant_id = $1`, [TENANT_A]);
      await query(`DELETE FROM specialists WHERE tenant_id = $1`, [TENANT_A]);
      await query(`DELETE FROM services WHERE tenant_id = $1`, [TENANT_A]);
      await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [[CUSTOMER, SPECIALIST_USER]]);
      await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, 'customer')`, [CUSTOMER, TENANT_A, '09120009911']);
      await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, 'specialist')`, [SPECIALIST_USER, TENANT_A, '09120009912']);
      await query(`INSERT INTO specialists (id, tenant_id, user_id) VALUES ($1, $2, $3)`, [SPECIALIST, TENANT_A, SPECIALIST_USER]);
      await query(`INSERT INTO services (id, tenant_id, name, price, duration_minutes) VALUES ($1, $2, $3, $4, $5)`, [SERVICE, TENANT_A, 'Saloon Service', 1000000, 60]);
    });

    await withTenant(TENANT_B, async (query) => {
      await query(`INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [TENANT_B, 'Test Saloon B']);
      await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, 'specialist')`, [MOBILE_SPECIALIST_USER, TENANT_B, '09120009922']);
      await query(`INSERT INTO specialists (id, tenant_id, user_id) VALUES ($1, $2, $3)`, [MOBILE_SPECIALIST, TENANT_B, MOBILE_SPECIALIST_USER]);
    });
  });

  afterAll(async () => {
    await withTenant(TENANT_A, async (query) => {
      await query(`DELETE FROM bookings WHERE tenant_id = $1`, [TENANT_A]);
      await query(`DELETE FROM schedule_blocks WHERE tenant_id = $1`, [TENANT_A]);
      await query(`DELETE FROM specialists WHERE tenant_id = $1`, [TENANT_A]);
      await query(`DELETE FROM services WHERE tenant_id = $1`, [TENANT_A]);
      await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [[CUSTOMER, SPECIALIST_USER]]);
      await query(`DELETE FROM tenants WHERE id = $1`, [TENANT_A]);
    });

    await withTenant(TENANT_B, async (query) => {
      await query(`DELETE FROM specialists WHERE tenant_id = $1`, [TENANT_B]);
      await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [[MOBILE_SPECIALIST_USER]]);
      await query(`DELETE FROM tenants WHERE id = $1`, [TENANT_B]);
    });
  });


  describe('Exclusion Constraint Tests', () => {
    it('prevents overlapping blocks for same specialist', async () => {
      await withTenant(TENANT_A, async (query) => {
        await query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, $2, $3, $4, 'Block 1')`, [TENANT_A, SPECIALIST, SLOT_START, SLOT_END]);
        const trySecond = async () => await query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, $2, $3, $4, 'Block 2')`, [TENANT_A, SPECIALIST, new Date(SLOT_START.getTime()+1800000), new Date(SLOT_START.getTime()+5400000)]);
        await expect(trySecond()).rejects.toThrow();
        const cnt = await query<{ count: number }[]>(`SELECT COUNT(*)::int FROM schedule_blocks WHERE tenant_id=$1 AND specialist_id=$2`, [TENANT_A, SPECIALIST]);
        expect(cnt[0].count).toBe(1);
      });
    });

    it('excludes overlapping whole-salon blocks', async () => {
      await withTenant(TENANT_A, async (query) => {
        await query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, NULL, $2, $3, 'Closed')`, [TENANT_A, SLOT_START, SLOT_END]);
        const trySecond = async () => await query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, NULL, $2, $3, '再审')`, [TENANT_A, new Date(SLOT_START.getTime()+1800000), new Date(SLOT_START.getTime()+5400000)]);
        await expect(trySecond()).rejects.toThrow();
        const cnt = await query<{ count: number }[]>(`SELECT COUNT(*)::int FROM schedule_blocks WHERE tenant_id=$1 AND specialist_id IS NULL`, [TENANT_A]);
        expect(cnt[0].count).toBe(1);
      });
    });

    it('excludes overlapping mobile specialist blocks', async () => {
      await withTenant(TENANT_B, async (query) => {
        await query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES (NULL, $1, $2, $3, 'Mobile')`, [MOBILE_SPECIALIST, SLOT_START, SLOT_END]);
        const trySecond = async () => await query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES (NULL, $1, $2, $3, 'Mobile2')`, [MOBILE_SPECIALIST, new Date(SLOT_START.getTime()+1800000), new Date(SLOT_START.getTime()+5400000)]);
        await expect(trySecond()).rejects.toThrow();
        const cnt = await query<{ count: number }[]>(`SELECT COUNT(*)::int FROM schedule_blocks WHERE specialist_id=$1 AND tenant_id IS NULL`, [MOBILE_SPECIALIST]);
        expect(cnt[0].count).toBe(1);
      });
    });

    it('allows non-overlapping blocks for same specialist', async () => {
      await withTenant(TENANT_A, async (query) => {
        await query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, $2, $3, $4, 'Block 1')`, [TENANT_A, SPECIALIST, SLOT_START, SLOT_END]);
        const nextStart = new Date(SLOT_END.getTime() + 3600000);
        const nextEnd = new Date(nextStart.getTime() + 3600000);
        await query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, $2, $3, $4, 'Block 2')`, [TENANT_A, SPECIALIST, nextStart, nextEnd]);
        const cnt = await query<{ count: number }[]>(`SELECT COUNT(*)::int FROM schedule_blocks WHERE tenant_id=$1 AND specialist_id=$2`, [TENANT_A, SPECIALIST]);
        expect(cnt[0].count).toBe(2);
      });
    });

    it('allows blocks for different specialists in same salon', async () => {
      await withTenant(TENANT_A, async (query) => {
        const S2_USER = '55555555-5555-4555-8555-5555555555c2';
        const S2 = '55555555-5555-4555-8555-5555555555c3';
        await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1,$2,$3,'specialist')`, [S2_USER, TENANT_A, '09120009933']);
        await query(`INSERT INTO specialists (id, tenant_id, user_id) VALUES ($1,$2,$3)`, [S2, TENANT_A, S2_USER]);
        await query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, $2, $3, $4, 'Block A')`, [TENANT_A, SPECIALIST, SLOT_START, SLOT_END]);
        await query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, $2, $3, $4, 'Block B')`, [TENANT_A, S2, SLOT_START, SLOT_END]);
        const cnt = await query<{ count: number }[]>(`SELECT COUNT(*)::int FROM schedule_blocks WHERE tenant_id=$1`, [TENANT_A]);
        expect(cnt[0].count).toBe(2);
      });
    });
  });


  describe('RLS Isolation Tests', () => {
    it('keeps bookings separate by tenant', async () => {
      await withTenant(TENANT_A, async (query) => {
        await query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, $2, $3, $4, 'Saloon A')`, [TENANT_A, SPECIALIST, SLOT_START, SLOT_END]);
      });

      await withTenant(TENANT_B, async (query) => {
        await query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, $2, $3, $4, 'Saloon B')`, [TENANT_B, MOBILE_SPECIALIST, SLOT_START, SLOT_END]);
      });

      const ds = getDataSource();
      const q = await ds.createQueryRunner();
      await q.connect();
      await q.manager.query(`SET SESSION role TO beauty_app`);
      await q.manager.query(`SET SESSION app.current_tenant_id TO '${TENANT_A}'`);
      const resA = await q.manager.query<{ count: number }[]>(`SELECT COUNT(*)::int FROM schedule_blocks WHERE tenant_id=$1`, [TENANT_A]);
      const resB = await q.manager.query<{ count: number }[]>(`SELECT COUNT(*)::int FROM schedule_blocks WHERE tenant_id=$1`, [TENANT_B]);
      await q.release();
      expect(resA[0].count).toBe(1);
      expect(resB[0].count).toBe(0);
    });

    it('mobile specialist sees only own blocks', async () => {
      await withTenant(TENANT_B, async (query) => {
        await query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES (NULL, $1, $2, $3, 'My Block')`, [MOBILE_SPECIALIST, SLOT_START, SLOT_END]);
      });

      const ds = getDataSource();
      const q = await ds.createQueryRunner();
      await q.connect();
      await q.manager.query(`SET SESSION role TO beauty_app`);
      await q.manager.query(`SET SESSION app.current_user_id TO '${MOBILE_SPECIALIST_USER}'`);
      const res = await q.manager.query<{ count: number }[]>(`SELECT COUNT(*)::int FROM schedule_blocks WHERE specialist_id IN (SELECT id FROM specialists WHERE user_id=$1 AND is_active=true)`, [MOBILE_SPECIALIST_USER]);
      await q.release();
      expect(res[0].count).toBe(1);
    });
  });
});

