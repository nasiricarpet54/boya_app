// `@nestjs/schedule` v12 ships ESM only and is not transformed by ts-jest, so
// it is stubbed here: this spec drives the scheduler's sweeps directly and never
// needs the real cron registration (the decorators only attach metadata).
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_30_MINUTES: '*/30 * * * *' },
}));

import { DataSource } from 'typeorm';

import { ReminderScheduler } from '../../src/modules/notification/services/reminder.scheduler';
import { KavenegarAlertService } from '../../src/modules/notification/services/kavenegar-alert.service';
import { InAppNotificationService } from '../../src/modules/notification/services/in-app-notification.service';
import { PushNotificationService } from '../../src/modules/notification/services/push-notification.service';
import {
  describeIntegration,
  getDataSource,
  queryAsAdmin,
  withTenant,
} from '../setup/integration.setup';

const TENANT = '66666666-6666-4666-8666-666666666666';
const CUSTOMER = '66666666-6666-4666-8666-6666666666c1';
const CUSTOMER_PHONE = '09120009941';

/** Each booking gets its own specialist so the `no_overlapping_bookings`
 *  exclusion constraint (per specialist) can never fire between tests. */
const SPECIALISTS: Array<{ user: string; specialist: string; phone: string }> = [
  {
    user: '66666666-6666-4666-8666-6666666666a2',
    specialist: '66666666-6666-4666-8666-6666666666a3',
    phone: '09120009942',
  },
  {
    user: '66666666-6666-4666-8666-6666666666b2',
    specialist: '66666666-6666-4666-8666-6666666666b3',
    phone: '09120009943',
  },
  {
    user: '66666666-6666-4666-8666-6666666666d2',
    specialist: '66666666-6666-4666-8666-6666666666d3',
    phone: '09120009944',
  },
];
const SERVICE = '66666666-6666-4666-8666-6666666666c4';

/** Inside the 24h booking-reminder lead window (starts in 60 minutes). */
const REMINDER_SLOT_START = new Date(Date.now() + 60 * 60 * 1000);
/** Past the 30-minute no-show grace window (started 2 hours ago). */
const NO_SHOW_SLOT_START = new Date(Date.now() - 2 * 60 * 60 * 1000);

const slot = (start: Date): string =>
  `[${start.toISOString()},${new Date(start.getTime() + 60 * 60 * 1000).toISOString()})`;

/**
 * The cron sweeps claim their work with a bare `UPDATE bookings ... RETURNING`.
 *
 * `bookings` is FORCE ROW LEVEL SECURITY on
 * `current_setting('app.current_tenant_id')`, and a `@Cron` runs with **no**
 * tenant context — nothing calls `setTenantContext()` on the scheduler's
 * connection. So the `SELECT id FROM bookings` sub-select is filtered to zero
 * rows and the UPDATE claims nothing: reminders never fire and no-shows are
 * never detected. The `notify()` phone lookup was BUG-1; this is the claim step
 * that runs *before* it, and it was silently doing nothing.
 *
 * These specs seed real rows and call the real sweeps with the GUC unset, the
 * way the cron does, and assert the rows are actually claimed.
 */
describeIntegration('cron sweeps must claim rows with no tenant GUC (like the @Cron)', () => {
  let scheduler: ReminderScheduler;
  let dataSource: DataSource;
  let sentAlerts: Array<{ phone: string; title: string }>;

  beforeAll(async () => {
    dataSource = getDataSource();

    sentAlerts = [];
    const alerts = {
      sendBookingAlert: async (phone: string, title: string) => {
        sentAlerts.push({ phone, title });
        return true;
      },
    } as unknown as KavenegarAlertService;
    const inApp = { create: async () => ({}) } as unknown as InAppNotificationService;
    const push = { sendToUser: async () => true } as unknown as PushNotificationService;

    scheduler = new ReminderScheduler(dataSource, inApp, alerts, push);

    await withTenant(TENANT, async (query) => {
      await query(`INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
        TENANT,
        'IT Tenant Claim Due',
      ]);
      await query(`DELETE FROM bookings WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM specialists WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM services WHERE tenant_id = $1`, [TENANT]);
      for (const s of SPECIALISTS) {
        await query(`DELETE FROM users WHERE id = $1`, [s.user]);
        await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, 'specialist')`, [
          s.user,
          TENANT,
          s.phone,
        ]);
        await query(`INSERT INTO specialists (id, tenant_id, user_id) VALUES ($1, $2, $3)`, [
          s.specialist,
          TENANT,
          s.user,
        ]);
      }
      await query(
        `INSERT INTO services (id, tenant_id, name, price, duration_minutes) VALUES ($1, $2, $3, $4, $5)`,
        [SERVICE, TENANT, 'IT Claim Service', 1000000, 60],
      );
    });

    // Customer is not tenant-scoped, so she is seeded as superuser.
    await queryAsAdmin(`DELETE FROM users WHERE id = $1`, [CUSTOMER]);
    await queryAsAdmin(
      `INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, NULL, $2, 'customer')`,
      [CUSTOMER, CUSTOMER_PHONE],
    );
  });

  afterAll(async () => {
    await withTenant(TENANT, async (query) => {
      await query(`DELETE FROM bookings WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM specialists WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM services WHERE tenant_id = $1`, [TENANT]);
      for (const s of SPECIALISTS) {
        await query(`DELETE FROM users WHERE id = $1`, [s.user]);
      }
      await query(`DELETE FROM tenants WHERE id = $1`, [TENANT]);
    });
    await queryAsAdmin(`DELETE FROM users WHERE id = $1`, [CUSTOMER]);
  });

  /** Seeds a booking through the tenant GUC (a write needs the policy's WITH CHECK). */
  const seedBooking = (status: string, timeSlot: string, index: number): Promise<string> =>
    withTenant(TENANT, async (query) => {
      const rows = await query<Array<{ id: string }>>(
        `INSERT INTO bookings (tenant_id, specialist_id, customer_id, service_id, time_slot, total_price, status)
         VALUES ($1, $2, $3, $4, $5::tstzrange, $6, $7)
         RETURNING id`,
        [TENANT, SPECIALISTS[index].specialist, CUSTOMER, SERVICE, timeSlot, 1000000, status],
      );
      return rows[0].id;
    });

  const claimDue = (kind: 'booking' | 'feedback'): Promise<unknown[]> =>
    (
      scheduler as unknown as { claimDue: (k: 'booking' | 'feedback') => Promise<unknown[]> }
    ).claimDue(kind);

  const claimAndSend = (kind: 'booking' | 'feedback'): Promise<number> =>
    (scheduler as unknown as { claimAndSend: (k: 'booking' | 'feedback') => Promise<number> })
      .claimAndSend(kind);

  const markNoShows = (): Promise<number> =>
    (scheduler as unknown as { markNoShows: () => Promise<number> }).markNoShows();

  it('claimDue returns the due booking with no tenant GUC set', async () => {
    const id = await seedBooking('confirmed', slot(REMINDER_SLOT_START), 0);

    // The cron path: a @Cron reaches this with no tenant context set.
    const claimed = await claimDue('booking');

    expect(claimed).toHaveLength(1);
    expect((claimed[0] as { id: string }).id).toBe(id);
  });

  it('claimAndSend then notifies the customer (the whole @Cron body)', async () => {
    await seedBooking('confirmed', slot(REMINDER_SLOT_START), 1);
    sentAlerts.length = 0;

    const claimed = await claimAndSend('booking');

    expect(claimed).toBe(1);
    expect(sentAlerts).toHaveLength(1);
    expect(sentAlerts[0].phone).toBe(CUSTOMER_PHONE);
  });

  it('markNoShows flips an overdue confirmed booking to no_show with no tenant GUC set', async () => {
    const id = await seedBooking('confirmed', slot(NO_SHOW_SLOT_START), 2);

    const affected = await markNoShows();
    expect(affected).toBe(1);

    const [booking] = await queryAsAdmin<{ status: string }>(
      `SELECT status FROM bookings WHERE id = $1`,
      [id],
    );
    expect(booking?.status).toBe('no_show');

    // `users` is FORCE RLS too, so the no_show_count bump has to happen in the
    // same privileged sweep — otherwise the counter silently stays 0.
    const [user] = await queryAsAdmin<{ no_show_count: number }>(
      `SELECT no_show_count FROM users WHERE id = $1`,
      [CUSTOMER],
    );
    expect(Number(user?.no_show_count)).toBeGreaterThanOrEqual(1);
  });
});
