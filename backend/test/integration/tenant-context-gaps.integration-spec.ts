import { DataSource, Repository } from 'typeorm';

import { BookingService } from '../../src/modules/booking/booking.service';
import { Booking, BookingStatus } from '../../src/modules/booking/booking.entity';
import { AuthenticatedUser } from '../../src/modules/auth/guards/jwt-auth.guard';
import { appConfig, TEST_DB_NAME } from '../setup/test-db';
import { describeIntegration, withTenant } from '../setup/integration.setup';

const TENANT = '44444444-4444-4444-8444-444444444444';
const CUSTOMER = '44444444-4444-4444-8444-4444444444c1';
const SPECIALIST_USER = '44444444-4444-4444-8444-4444444444c2';
const SPECIALIST = '44444444-4444-4444-8444-4444444444c3';
const SERVICE = '44444444-4444-4444-8444-4444444444c4';

const SLOT_START = new Date(Date.now() + 36 * 60 * 60 * 1000);

/**
 * BUG-4 / BUG-5 — the four `bookings` reads that never set the tenant GUC.
 *
 * `bookings` is FORCE ROW LEVEL SECURITY on `current_setting('app.current_tenant_id')`.
 * With the GUC unset a read as the NOBYPASSRLS `beauty_app` role is filtered to
 * zero rows, so the reads below either throw a spurious `NotFoundException`
 * (findById / cancel / markReviewed) or make the customer unable to see her own
 * booking (confirmVisitByCustomer).
 *
 * Every assertion runs through the real `BookingService` on a real Postgres, so
 * the fix is proven on the production code path rather than an inlined query.
 */
describeIntegration('BUG-4/5: booking reads must set the tenant GUC', () => {
  let dataSource: DataSource;
  let service: BookingService;
  let rawRepository: Repository<Booking>;

  beforeAll(async () => {
    // The shared DataSource declares `entities: []`; this spec needs a real
    // `Booking` repository, so it opens its own RLS-subject connection with the
    // entity attached.
    dataSource = new DataSource({
      type: 'postgres',
      host: String(appConfig.host),
      port: Number(appConfig.port),
      username: String(appConfig.user),
      password: String(appConfig.password),
      database: TEST_DB_NAME,
      entities: [Booking],
      synchronize: false,
    });
    await dataSource.initialize();
    rawRepository = dataSource.getRepository(Booking);

    service = new BookingService(
      dataSource.getRepository(Booking),
      dataSource,
      { findById: async () => ({ isActive: true, durationMinutes: 60 }) } as never,
      { findById: async () => ({ isActive: true }) } as never,
      { emit: () => undefined } as never,
    );

    await withTenant(TENANT, async (query) => {
      await query(`INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
        TENANT,
        'IT Tenant Context Gaps',
      ]);
      await query(`DELETE FROM bookings WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM specialists WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM services WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [[CUSTOMER, SPECIALIST_USER]]);
      await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, 'customer')`, [
        CUSTOMER,
        TENANT,
        '09120009921',
      ]);
      await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, 'specialist')`, [
        SPECIALIST_USER,
        TENANT,
        '09120009922',
      ]);
      await query(`SELECT set_config('app.current_role', 'admin', true)`); await query(`INSERT INTO specialists (id, tenant_id, user_id) VALUES ($1, $2, $3)`, [
        SPECIALIST,
        TENANT,
        SPECIALIST_USER,
      ]);
      await query(`SELECT set_config('app.current_role', 'admin', true)`); await query(`INSERT INTO services (id, tenant_id, name, price, duration_minutes) VALUES ($1, $2, $3, $4, $5)`, [
        SERVICE,
        TENANT,
        'IT Context Service',
        1000000,
        60,
      ]);
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
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  let slotCounter = 0;
  const nextSlot = (): { start: Date; end: Date } => {
    // Each seeded booking gets its own non-overlapping hour, so the
    // `no_overlapping_bookings` exclusion constraint never fires between tests.
    slotCounter += 1;
    const start = new Date(SLOT_START.getTime() + slotCounter * 2 * 60 * 60 * 1000);
    return { start, end: new Date(start.getTime() + 60 * 60 * 1000) };
  };

  const seedBooking = (status: string, slot = nextSlot()): Promise<string> =>
    withTenant(TENANT, async (query) => {
      const rows = await query<Array<{ id: string }>>(
        `INSERT INTO bookings (tenant_id, specialist_id, customer_id, service_id, time_slot, total_price, status)
         VALUES ($1, $2, $3, $4, $5::tstzrange, $6, $7)
         RETURNING id`,
        [
          TENANT,
          SPECIALIST,
          CUSTOMER,
          SERVICE,
          `[${slot.start.toISOString()},${slot.end.toISOString()})`,
          1000000,
          status,
        ],
      );
      return rows[0].id;
    });

  /** The buggy shape: a GUC-less read on the RLS-subject connection. */
  const readWithoutContext = (id: string): Promise<Booking | null> =>
    rawRepository.findOne({ where: { tenantId: TENANT, id } });

  it('BUG-4 findById: 0 rows without the GUC, the row with it', async () => {
    const id = await seedBooking('pending');

    // RED: without tenant context the read is filtered to zero rows.
    await expect(readWithoutContext(id)).resolves.toBeNull();

    // GREEN: findById sets the context and returns the row.
    await expect(service.findById(TENANT, id)).resolves.toMatchObject({ id, tenantId: TENANT });
  });

  it('BUG-4 cancel: cancels only when the GUC is set', async () => {
    const id = await seedBooking('pending');

    await expect(readWithoutContext(id)).resolves.toBeNull();

    const { booking } = await service.cancel(TENANT, id, 'customer_request');
    expect(booking.id).toBe(id);
    expect(booking.status).toBe(BookingStatus.Cancelled);
  });

  it('BUG-4 markReviewed: completed -> reviewed only with the GUC set', async () => {
    const id = await seedBooking('completed');

    await expect(readWithoutContext(id)).resolves.toBeNull();

    await expect(service.markReviewed(TENANT, id)).resolves.toMatchObject({
      id,
      status: BookingStatus.Reviewed,
    });
  });

  it('BUG-5 confirmVisitByCustomer: customer finds her own booking (GUC from the row)', async () => {
    const id = await seedBooking('confirmed');

    // The customer's GUC-less read cannot see the row at all — the bug.
    await expect(readWithoutContext(id)).resolves.toBeNull();

    const user = {
      userId: CUSTOMER,
      phoneNumber: '09120009921',
      role: 'customer',
      tenantId: null,
    } as AuthenticatedUser;

    const saved = await service.confirmVisitByCustomer(user, id);
    expect(saved.id).toBe(id);
    expect(saved.visitConfirmedByCustomerAt).toBeInstanceOf(Date);
  });
});
