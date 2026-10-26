import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';

import { Booking } from '../../src/modules/booking/booking.entity';
import { BookingService } from '../../src/modules/booking/booking.service';
import { Service } from '../../src/modules/service/entities/service.entity';
import { ServiceCatalogService } from '../../src/modules/service/service.service';
import { Specialist } from '../../src/modules/specialist/entities/specialist.entity';
import { SpecialistService } from '../../src/modules/specialist/specialist.service';
import { adminConfig, TEST_DB_NAME } from '../setup/test-db';
import { describeIntegration, withTenant } from '../setup/integration.setup';

// Jest runs the integration suites in parallel workers over one shared test
// database, so this spec owns a dedicated id/phone namespace (the siblings use
// 3333…/5555… and 0912000991…/0912000995…).
const TENANT = '44444444-4444-4444-8444-4444444444a1';
const CUSTOMER = '44444444-4444-4444-8444-4444444444c1';
const SPECIALIST_USER = '44444444-4444-4444-8444-4444444444b1';
const SPECIALIST = '44444444-4444-4444-8444-4444444444d1';
const SERVICE = '44444444-4444-4444-8444-4444444444e1';

/** A well-formed tenant id that no seeded specialist belongs to. */
const OTHER_TENANT = '44444444-4444-4444-8444-4444444444a2';

const startsIn = (hours: number): Date => new Date(Date.now() + hours * 60 * 60 * 1000);

/**
 * `POST /bookings` without a `tenantId` — the tenant a booking is written into
 * is the specialist's tenant, not something the caller may pick freely.
 *
 * The scenarios run through the real `BookingService.create` against a real
 * Postgres — the same call the controller's `create` handler makes — so the
 * assertions track the code that actually runs instead of a re-implementation
 * of it.
 */
describeIntegration('booking tenantId derived from the specialist', () => {
  let dataSource: DataSource;
  let bookings: BookingService;

  beforeAll(async () => {
    // The shared DataSource declares `entities: []`; this spec needs real
    // repositories for the specialist read and the catalog lookup `create()`
    // performs.
    dataSource = new DataSource({
      type: 'postgres',
      host: String(adminConfig.host),
      port: Number(adminConfig.port),
      username: String(adminConfig.user),
      password: String(adminConfig.password),
      database: TEST_DB_NAME,
      entities: [Booking, Service, Specialist],
      synchronize: false,
    });
    await dataSource.initialize();

    bookings = new BookingService(
      dataSource.getRepository(Booking),
      dataSource,
      new ServiceCatalogService(dataSource.getRepository(Service), {} as never),
      new SpecialistService(dataSource.getRepository(Specialist)),
      new EventEmitter2(),
      { invalidateTenantCache: async () => undefined } as never,
    );

    await seed();
  });

  const seed = async (): Promise<void> => {
    // `bookings` and `users` are FORCE ROW LEVEL SECURITY, so each tenant's rows
    // are cleared under that tenant's own GUC; `specialists`/`services`/`tenants`
    // carry no policy at all.
    await withTenant(TENANT, async (query) => {
      await query(`DELETE FROM bookings WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM specialists WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM services WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM users WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM tenants WHERE id = $1`, [TENANT]);
    });

    await withTenant(TENANT, async (query) => {
      await query(
        `INSERT INTO tenants (id, name, is_active, status, approved_at)
         VALUES ($1, $2, true, 'approved', NOW())
         ON CONFLICT (id) DO NOTHING`,
        [TENANT, 'IT Tenant Derived'],
      );
      await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, 'customer')`, [
        CUSTOMER,
        TENANT,
        '09120009881',
      ]);
      await query(`INSERT INTO users (id, tenant_id, phone, full_name, role) VALUES ($1, $2, $3, $4, 'specialist')`, [
        SPECIALIST_USER,
        TENANT,
        '09120009882',
        'IT Derived Specialist',
      ]);
      await query(`INSERT INTO specialists (id, tenant_id, user_id) VALUES ($1, $2, $3)`, [
        SPECIALIST,
        TENANT,
        SPECIALIST_USER,
      ]);
      await query(
        `INSERT INTO services (id, tenant_id, name, price, duration_minutes) VALUES ($1, $2, $3, 1000000, 60)`,
        [SERVICE, TENANT, 'IT Derived Service'],
      );
      await query(
        `INSERT INTO specialist_services (tenant_id, specialist_id, service_id, is_active)
         VALUES ($1, $2, $3, true)`,
        [TENANT, SPECIALIST, SERVICE],
      );
    });
  };

  afterAll(async () => {
    await withTenant(TENANT, async (query) => {
      await query(`DELETE FROM bookings WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM specialists WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM services WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM users WHERE tenant_id = $1`, [TENANT]);
      await query(`DELETE FROM tenants WHERE id = $1`, [TENANT]);
    });
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('derives tenantId from the specialist when the caller omits it', async () => {
    const saved = await bookings.create({
      // tenantId is deliberately absent: the customer only picks a specialist.
      specialistId: SPECIALIST,
      serviceId: SERVICE,
      customerId: CUSTOMER,
      startsAt: startsIn(48),
      notes: 'بدون tenantId',
    });

    expect(saved.tenantId).toBe(TENANT);

    // The persisted row, read back under the tenant's own GUC (`bookings` is
    // FORCE RLS), carries the specialist's tenant rather than NULL.
    const rows = await withTenant(TENANT, (query) =>
      query<Array<{ tenant_id: string }>>(`SELECT tenant_id FROM bookings WHERE id = $1`, [saved.id]),
    );
    expect(rows[0].tenant_id).toBe(TENANT);
  });

  it('still accepts a tenantId that matches the specialist', async () => {
    const saved = await bookings.create({
      tenantId: TENANT,
      specialistId: SPECIALIST,
      serviceId: SERVICE,
      customerId: CUSTOMER,
      startsAt: startsIn(50),
      notes: 'tenantId مطابق',
    });

    expect(saved.tenantId).toBe(TENANT);
  });

  it('rejects a tenantId that does not match the specialist (400)', async () => {
    await expect(
      bookings.create({
        tenantId: OTHER_TENANT,
        specialistId: SPECIALIST,
        serviceId: SERVICE,
        customerId: CUSTOMER,
        startsAt: startsIn(52),
      }),
    ).rejects.toMatchObject({ status: 400, message: 'tenantId با متخصص مطابقت ندارد' });
  });

  it('rejects an unknown specialist (404)', async () => {
    await expect(
      bookings.create({
        // A uuid no specialist row carries, so the tenant cannot be resolved.
        specialistId: OTHER_TENANT,
        serviceId: SERVICE,
        customerId: CUSTOMER,
        startsAt: startsIn(54),
      }),
    ).rejects.toMatchObject({ status: 404, message: 'متخصص یافت نشد' });
  });
});
