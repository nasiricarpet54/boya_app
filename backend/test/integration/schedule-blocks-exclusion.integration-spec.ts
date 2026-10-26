import { describeIntegration, getDataSource, queryAsAdmin, withTenant } from '../setup/integration.setup';

const TENANT_A = 'a1000000-0000-4000-8000-000000000001';
const TENANT_B = 'a2000000-0000-4000-8000-000000000002';
const CUSTOMER = 'a3000000-0000-4000-8000-000000000001';
const SPECIALIST_USER = 'a3000000-0000-4000-8000-000000000002';
const SPECIALIST = 'a3000000-0000-4000-8000-000000000003';
const SERVICE = 'a3000000-0000-4000-8000-000000000004';
const S2_USER = 'a3000000-0000-4000-8000-000000000005';
const S2 = 'a3000000-0000-4000-8000-000000000006';
const MOBILE_SPECIALIST_USER = 'a4000000-0000-4000-8000-000000000001';
const MOBILE_SPECIALIST = 'a4000000-0000-4000-8000-000000000002';

const SLOT_START = new Date(Date.now() + 24 * 60 * 60 * 1000);
const SLOT_END = new Date(SLOT_START.getTime() + 60 * 60 * 1000);

const clearScheduleBlocks = async (): Promise<void> => {
  await queryAsAdmin(
    `DELETE FROM schedule_blocks
      WHERE tenant_id = ANY($1::uuid[]) OR specialist_id = $2::uuid`,
    [[TENANT_A, TENANT_B], MOBILE_SPECIALIST],
  );
};

const withMobileUser = <T>(work: (query: <R>(sql: string, params?: unknown[]) => Promise<R>) => Promise<T>) =>
  withTenant(TENANT_B, async (query) => {
    await query(`SELECT set_config('app.current_user_id', $1, true)`, [MOBILE_SPECIALIST_USER]);
    return work(query);
  });

describeIntegration('Schedule Blocks: exclusion and isolation', () => {
  beforeAll(async () => {
    getDataSource();
    await clearScheduleBlocks();

    await withTenant(TENANT_A, async (query) => {
      await query(`INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [TENANT_A, 'Test Saloon A']);
      await query(`DELETE FROM bookings WHERE tenant_id = $1`, [TENANT_A]);
      await query(`DELETE FROM specialists WHERE tenant_id = $1`, [TENANT_A]);
      await query(`DELETE FROM services WHERE tenant_id = $1`, [TENANT_A]);
      await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [[CUSTOMER, SPECIALIST_USER, S2_USER]]);
      await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, 'customer')`, [CUSTOMER, TENANT_A, '09129999801']);
      await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, 'specialist')`, [SPECIALIST_USER, TENANT_A, '09129999802']);
      await query(`INSERT INTO specialists (id, tenant_id, user_id) VALUES ($1, $2, $3)`, [SPECIALIST, TENANT_A, SPECIALIST_USER]);
      await query(`INSERT INTO services (id, tenant_id, name, price, duration_minutes) VALUES ($1, $2, $3, $4, $5)`, [SERVICE, TENANT_A, 'Saloon Service', 1000000, 60]);
    });

    await withTenant(TENANT_B, async (query) => {
      await query(`INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [TENANT_B, 'Test Saloon B']);
      await query(`DELETE FROM specialists WHERE id = $1`, [MOBILE_SPECIALIST]);
      await query(`DELETE FROM users WHERE id = $1`, [MOBILE_SPECIALIST_USER]);
      await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, 'specialist')`, [MOBILE_SPECIALIST_USER, TENANT_B, '09129999803']);
      await query(`INSERT INTO specialists (id, tenant_id, user_id) VALUES ($1, $2, $3)`, [MOBILE_SPECIALIST, TENANT_B, MOBILE_SPECIALIST_USER]);
    });
  });

  beforeEach(async () => {
    // Each test gets a clean time-slot namespace, including tenant-null mobile
    // rows that cannot be removed under either salon's tenant GUC.
    await clearScheduleBlocks();
  });

  afterAll(async () => {
    await clearScheduleBlocks();
    await withTenant(TENANT_A, async (query) => {
      await query(`DELETE FROM bookings WHERE tenant_id = $1`, [TENANT_A]);
      await query(`DELETE FROM specialists WHERE tenant_id = $1`, [TENANT_A]);
      await query(`DELETE FROM services WHERE tenant_id = $1`, [TENANT_A]);
      await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [[CUSTOMER, SPECIALIST_USER, S2_USER]]);
      await query(`DELETE FROM tenants WHERE id = $1`, [TENANT_A]);
    });
    await withTenant(TENANT_B, async (query) => {
      await query(`DELETE FROM specialists WHERE tenant_id = $1`, [TENANT_B]);
      await query(`DELETE FROM users WHERE id = $1`, [MOBILE_SPECIALIST_USER]);
      await query(`DELETE FROM tenants WHERE id = $1`, [TENANT_B]);
    });
  });

  describe('Exclusion Constraint Tests', () => {
    it('prevents overlapping blocks for the same specialist', async () => {
      await withTenant(TENANT_A, (query) =>
        query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, $2, $3, $4, 'Block 1')`, [TENANT_A, SPECIALIST, SLOT_START, SLOT_END]),
      );
      await expect(
        withTenant(TENANT_A, (query) =>
          query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, $2, $3, $4, 'Block 2')`, [TENANT_A, SPECIALIST, new Date(SLOT_START.getTime() + 1800000), new Date(SLOT_START.getTime() + 5400000)]),
        ),
      ).rejects.toThrow();
      const rows = await withTenant(TENANT_A, (query) =>
        query<{ count: number }[]>(`SELECT COUNT(*)::int AS count FROM schedule_blocks WHERE tenant_id=$1 AND specialist_id=$2`, [TENANT_A, SPECIALIST]),
      );
      expect(rows[0].count).toBe(1);
    });

    it('excludes overlapping whole-salon blocks', async () => {
      await withTenant(TENANT_A, (query) =>
        query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, NULL, $2, $3, 'Closed')`, [TENANT_A, SLOT_START, SLOT_END]),
      );
      await expect(
        withTenant(TENANT_A, (query) =>
          query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, NULL, $2, $3, 'Closed again')`, [TENANT_A, new Date(SLOT_START.getTime() + 1800000), new Date(SLOT_START.getTime() + 5400000)]),
        ),
      ).rejects.toThrow();
      const rows = await withTenant(TENANT_A, (query) =>
        query<{ count: number }[]>(`SELECT COUNT(*)::int AS count FROM schedule_blocks WHERE tenant_id=$1 AND specialist_id IS NULL`, [TENANT_A]),
      );
      expect(rows[0].count).toBe(1);
    });

    it('excludes overlapping mobile specialist blocks', async () => {
      await withMobileUser((query) =>
        query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES (NULL, $1, $2, $3, 'Mobile')`, [MOBILE_SPECIALIST, SLOT_START, SLOT_END]),
      );
      await expect(
        withMobileUser((query) =>
          query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES (NULL, $1, $2, $3, 'Mobile again')`, [MOBILE_SPECIALIST, new Date(SLOT_START.getTime() + 1800000), new Date(SLOT_START.getTime() + 5400000)]),
        ),
      ).rejects.toThrow();
      const rows = await withMobileUser((query) =>
        query<{ count: number }[]>(`SELECT COUNT(*)::int AS count FROM schedule_blocks WHERE specialist_id=$1 AND tenant_id IS NULL`, [MOBILE_SPECIALIST]),
      );
      expect(rows[0].count).toBe(1);
    });

    it('allows non-overlapping blocks for the same specialist', async () => {
      await withTenant(TENANT_A, async (query) => {
        await query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, $2, $3, $4, 'Block 1')`, [TENANT_A, SPECIALIST, SLOT_START, SLOT_END]);
        const nextStart = new Date(SLOT_END.getTime() + 3600000);
        const nextEnd = new Date(nextStart.getTime() + 3600000);
        await query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, $2, $3, $4, 'Block 2')`, [TENANT_A, SPECIALIST, nextStart, nextEnd]);
        const rows = await query<{ count: number }[]>(`SELECT COUNT(*)::int AS count FROM schedule_blocks WHERE tenant_id=$1 AND specialist_id=$2`, [TENANT_A, SPECIALIST]);
        expect(rows[0].count).toBe(2);
      });
    });

    it('allows blocks for different specialists in the same salon', async () => {
      await withTenant(TENANT_A, async (query) => {
        await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1,$2,$3,'specialist')`, [S2_USER, TENANT_A, '09129999804']);
        await query(`INSERT INTO specialists (id, tenant_id, user_id) VALUES ($1,$2,$3)`, [S2, TENANT_A, S2_USER]);
        await query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, $2, $3, $4, 'Block A')`, [TENANT_A, SPECIALIST, SLOT_START, SLOT_END]);
        await query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, $2, $3, $4, 'Block B')`, [TENANT_A, S2, SLOT_START, SLOT_END]);
        const rows = await query<{ count: number }[]>(`SELECT COUNT(*)::int AS count FROM schedule_blocks WHERE tenant_id=$1`, [TENANT_A]);
        expect(rows[0].count).toBe(2);
      });
    });
  });

  describe('RLS Isolation Tests', () => {
    it('keeps schedule blocks separate by tenant', async () => {
      await withTenant(TENANT_A, (query) =>
        query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, $2, $3, $4, 'Salon A')`, [TENANT_A, SPECIALIST, SLOT_START, SLOT_END]),
      );
      await withTenant(TENANT_B, (query) =>
        query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES ($1, $2, $3, $4, 'Salon B')`, [TENANT_B, MOBILE_SPECIALIST, SLOT_START, SLOT_END]),
      );

      const runner = getDataSource().createQueryRunner();
      await runner.connect();
      try {
        await runner.manager.query(`SET SESSION ROLE TO beauty_app`);
        await runner.manager.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [TENANT_A]);
        const visible = await runner.manager.query<{ count: number }[]>(`SELECT COUNT(*)::int AS count FROM schedule_blocks WHERE tenant_id=$1`, [TENANT_A]);
        const hidden = await runner.manager.query<{ count: number }[]>(`SELECT COUNT(*)::int AS count FROM schedule_blocks WHERE tenant_id=$1`, [TENANT_B]);
        expect(visible[0].count).toBe(1);
        expect(hidden[0].count).toBe(0);
      } finally {
        await runner.manager.query(`RESET app.current_tenant_id`);
        await runner.manager.query(`RESET ROLE`);
        await runner.release();
      }
    });

    it('mobile specialist sees only their own blocks', async () => {
      await withMobileUser((query) =>
        query(`INSERT INTO schedule_blocks (tenant_id, specialist_id, start_time, end_time, reason) VALUES (NULL, $1, $2, $3, 'My Block')`, [MOBILE_SPECIALIST, SLOT_START, SLOT_END]),
      );

      const runner = getDataSource().createQueryRunner();
      await runner.connect();
      try {
        await runner.manager.query(`SET SESSION ROLE TO beauty_app`);
        await runner.manager.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [TENANT_B]);
        await runner.manager.query(`SELECT set_config('app.current_user_id', $1, false)`, [MOBILE_SPECIALIST_USER]);
        const rows = await runner.manager.query<{ count: number }[]>(
          `SELECT COUNT(*)::int AS count FROM schedule_blocks WHERE specialist_id = $1 AND tenant_id IS NULL`,
          [MOBILE_SPECIALIST],
        );
        expect(rows[0].count).toBe(1);
      } finally {
        await runner.manager.query(`RESET app.current_tenant_id`);
        await runner.manager.query(`RESET app.current_user_id`);
        await runner.manager.query(`RESET ROLE`);
        await runner.release();
      }
    });
  });
});
