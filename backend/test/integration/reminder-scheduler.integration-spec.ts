// `@nestjs/schedule` v12 ships ESM only and is not transformed by ts-jest, so
// it is stubbed here: this spec drives `notify()` directly and never needs the
// real cron scheduler (the decorators only register metadata).
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: { EVERY_30_MINUTES: '*/30 * * * *' },
}));

import { DataSource } from 'typeorm';

import { ReminderScheduler } from '../../src/modules/notification/services/reminder.scheduler';
import { MelipayamakAlertService } from '../../src/modules/notification/services/melipayamak-alert.service';
import { InAppNotificationService } from '../../src/modules/notification/services/in-app-notification.service';
import { PushNotificationService } from '../../src/modules/notification/services/push-notification.service';
import { describeIntegration, getDataSource, queryAsAdmin, withTenant } from '../setup/integration.setup';

const TENANT = '55555555-5555-4555-8555-555555555555';
const CUSTOMER = '55555555-5555-4555-8555-5555555555c1';
const SPECIALIST_USER = '55555555-5555-4555-8555-5555555555c2';
const SPECIALIST = '55555555-5555-4555-8555-5555555555c3';
const SERVICE = '55555555-5555-4555-8555-5555555555c4';

const CUSTOMER_PHONE = '09120009931';

const SLOT_START = new Date(Date.now() + 60 * 60 * 1000);
const SLOT_END = new Date(SLOT_START.getTime() + 60 * 60 * 1000);
const SLOT = `[${SLOT_START.toISOString()},${SLOT_END.toISOString()})`;

/**
 * BUG-1 — a customer's SMS reminder never goes out.
 *
 * `notify()` looked the customer's phone up with
 * `SELECT u.phone FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.id = $1`.
 * Customers are not tenant-scoped (`users.tenant_id` is NULL by design, migration
 * 1730000000007), so the INNER JOIN to `tenants` matched nothing and the SMS was
 * silently skipped — every reminder email/SMS to a customer vanished.
 *
 * The fix drops the join: `users` alone carries the phone. The spec seeds a
 * NULL-tenant customer and drives the real `notify()` to prove the alert fires
 * with that phone.
 */
describeIntegration('BUG-1: customer SMS reminder must not depend on tenant_id', () => {
  let scheduler: ReminderScheduler;
  let sentAlerts: Array<{ phone: string; title: string }>;

  beforeAll(async () => {
    const dataSource = getDataSource();

    sentAlerts = [];
    const alerts = {
      sendBookingAlert: async (phone: string, title: string) => {
        sentAlerts.push({ phone, title });
        return true;
      },
    } as unknown as MelipayamakAlertService;

    const inApp = { create: async () => ({}) } as unknown as InAppNotificationService;
    const push = { sendToUser: async () => true } as unknown as PushNotificationService;

    scheduler = new ReminderScheduler(dataSource, inApp, alerts, push);

    // The booking needs a specialist/service, which are tenant-scoped, so those
    // seed under the tenant GUC. The customer is deliberately inserted with a
    // NULL tenant through the admin (superuser) connection: a NULL tenant cannot
    // satisfy `users_tenant_isolation`'s WITH CHECK.
    await withTenant(TENANT, async (query) => {
      await query(`INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
        TENANT,
        'IT Tenant Reminder',
      ]);
      await query(`DELETE FROM bookings WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM specialists WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM services WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM users WHERE id = $1`, [SPECIALIST_USER]);
      await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, 'specialist')`, [
        SPECIALIST_USER,
        TENANT,
        '09120009932',
      ]);
      await query(`INSERT INTO specialists (id, tenant_id, user_id) VALUES ($1, $2, $3)`, [
        SPECIALIST,
        TENANT,
        SPECIALIST_USER,
      ]);
      await query(`INSERT INTO services (id, tenant_id, name, price, duration_minutes) VALUES ($1, $2, $3, $4, $5)`, [
        SERVICE,
        TENANT,
        'IT Reminder Service',
        1000000,
        60,
      ]);
    });

    // Customer with no tenant, seeded as superuser because RLS forbids it otherwise.
    await queryAsAdmin(`DELETE FROM users WHERE id = $1`, [CUSTOMER]);
    await queryAsAdmin(
      `INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, NULL, $2, 'customer')`,
      [CUSTOMER, CUSTOMER_PHONE],
    );

    await withTenant(TENANT, async (query) => {
      await query(
        `INSERT INTO bookings (tenant_id, specialist_id, customer_id, service_id, time_slot, total_price, status)
         VALUES ($1, $2, $3, $4, $5::tstzrange, $6, 'confirmed')`,
        [TENANT, SPECIALIST, CUSTOMER, SERVICE, SLOT, 1000000],
      );
    });
  });

  afterAll(async () => {
    await withTenant(TENANT, async (query) => {
      await query(`DELETE FROM bookings WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM specialists WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM services WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM users WHERE id = $1`, [SPECIALIST_USER]);
      await query(`DELETE FROM tenants WHERE id = $1`, [TENANT]);
    });
    await queryAsAdmin(`DELETE FROM users WHERE id = $1`, [CUSTOMER]);
  });

  it('sends the booking SMS to the customer phone even though tenant_id is NULL', async () => {
    const dataSource: DataSource = getDataSource();

    // `notify()` is the unit under test: the claim sweep's `RETURNING` row is
    // supplied directly, so the assertion is about the phone lookup, not the
    // claiming UPDATE.
    const row = { id: 'row-1', tenant_id: TENANT, customer_id: CUSTOMER, title: '', body: '' };
    await (
      scheduler as unknown as { notify: (r: typeof row, k: 'booking') => Promise<void> }
    ).notify(row, 'booking');

    expect(sentAlerts).toHaveLength(1);
    expect(sentAlerts[0].phone).toBe(CUSTOMER_PHONE);

    // Sanity: the lookup really resolves the phone for a NULL-tenant customer,
    // through the same SECURITY DEFINER function `notify()` uses (a bare read of
    // `users` would be RLS-filtered to nothing).
    const phone = await dataSource.query<Array<{ phone: string | null }>>(
      `SELECT get_user_phone($1) AS phone`,
      [CUSTOMER],
    );
    expect(phone[0]?.phone).toBe(CUSTOMER_PHONE);
  });
});
