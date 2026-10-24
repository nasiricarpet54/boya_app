import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';

import { Booking } from '../../src/modules/booking/booking.entity';
import { BookingService } from '../../src/modules/booking/booking.service';
import type { CreateBookingInput } from '../../src/modules/booking/booking.service';
import { AuthenticatedUser } from '../../src/modules/auth/guards/jwt-auth.guard';
import { SalonPanelBookingsQueryDto } from '../../src/modules/salon/dto/salon-bookings-query.dto';
import { SalonQueryDto } from '../../src/modules/salon/dto/salon-query.dto';
import { SalonService } from '../../src/modules/salon/salon.service';
import { Service } from '../../src/modules/service/entities/service.entity';
import { ServiceCatalogService } from '../../src/modules/service/service.service';
import { Specialist } from '../../src/modules/specialist/entities/specialist.entity';
import { SpecialistService } from '../../src/modules/specialist/specialist.service';
import { appConfig, TEST_DB_NAME } from '../setup/test-db';
import { describeIntegration, withTenant } from '../setup/integration.setup';

// Two salons: A can deliver on-site, B cannot. A also carries one specialist and
// one service that are *not* mobile-capable, so every filter has a same-salon
// sibling it must drop.
const TENANT_A = '55555555-5555-4555-8555-5555555555a1';
const TENANT_B = '55555555-5555-4555-8555-5555555555a2';
const CUSTOMER = '55555555-5555-4555-8555-5555555555c1';
const OWNER_A = '55555555-5555-4555-8555-5555555555b4';
const SPEC_USER_A = '55555555-5555-4555-8555-5555555555b1';
const SPEC_USER_A2 = '55555555-5555-4555-8555-5555555555b2';
const SPEC_USER_B = '55555555-5555-4555-8555-5555555555b3';
const SPECIALIST_A = '55555555-5555-4555-8555-5555555555d1';
const SPECIALIST_A2 = '55555555-5555-4555-8555-5555555555d2';
const SPECIALIST_B = '55555555-5555-4555-8555-5555555555d3';
const SERVICE_A = '55555555-5555-4555-8555-5555555555e1';
const SERVICE_A2 = '55555555-5555-4555-8555-5555555555e2';
const SERVICE_B = '55555555-5555-4555-8555-5555555555e3';

const BOTH_TENANTS = [TENANT_A, TENANT_B];

interface MobileBookingRow {
  is_mobile: boolean;
  customer_address: string | null;
  customer_latitude: string | null;
  customer_longitude: string | null;
}

/**
 * ADR-011 — mobile / on-site services, end to end against a real Postgres.
 *
 * The booking validations run through the real `BookingService` (its catalog and
 * specialist lookups are real repositories, so the flags are read from the rows
 * the panel toggles write) and the catalogue filters through the real
 * `SalonService`, so the tests cover the whole path the request takes rather
 * than a re-implementation of it.
 */
describeIntegration('ADR-011: mobile / on-site services', () => {
  let dataSource: DataSource;
  let bookings: BookingService;
  let salons: SalonService;

  beforeAll(async () => {
    // The shared DataSource declares `entities: []`; this spec needs real
    // repositories for the catalog lookups `create()` performs.
    dataSource = new DataSource({
      type: 'postgres',
      host: String(appConfig.host),
      port: Number(appConfig.port),
      username: String(appConfig.user),
      password: String(appConfig.password),
      database: TEST_DB_NAME,
      entities: [Booking, Service, Specialist],
      synchronize: false,
    });
    await dataSource.initialize();

    salons = new SalonService(dataSource, new EventEmitter2());
    bookings = new BookingService(
      dataSource.getRepository(Booking),
      dataSource,
      new ServiceCatalogService(dataSource.getRepository(Service), {} as never),
      new SpecialistService(dataSource.getRepository(Specialist)),
      new EventEmitter2(),
    );

    await seed();
  });

  afterAll(async () => {
    // `bookings` and `users` are FORCE RLS, so each tenant's rows are cleared
    // under that tenant's own GUC; `specialists`/`services`/`tenants` carry no
    // policy at all.
    for (const tenant of BOTH_TENANTS) {
      await withTenant(tenant, async (query) => {
        await query(`DELETE FROM bookings WHERE tenant_id = $1`, [tenant]);
        await query(`DELETE FROM specialists WHERE tenant_id = $1`, [tenant]);
        await query(`DELETE FROM services WHERE tenant_id = $1`, [tenant]);
        await query(`DELETE FROM users WHERE tenant_id = $1`, [tenant]);
      });
    }
    await withTenant(TENANT_A, async (query) => {
      await query(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [BOTH_TENANTS]);
    });
    if (dataSource?.isInitialized) await dataSource.destroy();
  });


  const seed = async (): Promise<void> => {
    await withTenant(TENANT_A, async (query) => {
      await query(`DELETE FROM bookings WHERE tenant_id = ANY($1::uuid[])`, [BOTH_TENANTS]);
      await query(`DELETE FROM specialists WHERE tenant_id = ANY($1::uuid[])`, [BOTH_TENANTS]);
      await query(`DELETE FROM services WHERE tenant_id = ANY($1::uuid[])`, [BOTH_TENANTS]);
      await query(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [BOTH_TENANTS]);
      await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [
        [CUSTOMER, OWNER_A, SPEC_USER_A, SPEC_USER_A2],
      ]);
    });

    await withTenant(TENANT_A, async (query) => {
      await query(
        `INSERT INTO tenants (id, name, is_active, status, approved_at)
         VALUES ($1, $2, true, 'approved', NOW())
         ON CONFLICT (id) DO NOTHING`,
        [TENANT_A, 'IT Mobile Salon A'],
      );
      await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, 'customer')`, [
        CUSTOMER,
        TENANT_A,
        '09120009951',
      ]);
      await query(
        `INSERT INTO users (id, tenant_id, phone, full_name, role) VALUES ($1, $2, $3, $4, 'salon_owner')`,
        [OWNER_A, TENANT_A, '09120009955', 'IT Owner A'],
      );
      await query(
        `INSERT INTO users (id, tenant_id, phone, full_name, role) VALUES ($1, $2, $3, $4, 'specialist')`,
        [SPEC_USER_A, TENANT_A, '09120009952', 'IT Specialist A'],
      );
      await query(
        `INSERT INTO users (id, tenant_id, phone, full_name, role) VALUES ($1, $2, $3, $4, 'specialist')`,
        [SPEC_USER_A2, TENANT_A, '09120009953', 'IT Specialist A2'],
      );
      await query(
        `INSERT INTO specialists (id, tenant_id, user_id, offers_mobile_service) VALUES ($1, $2, $3, true)`,
        [SPECIALIST_A, TENANT_A, SPEC_USER_A],
      );
      await query(
        `INSERT INTO specialists (id, tenant_id, user_id, offers_mobile_service) VALUES ($1, $2, $3, false)`,
        [SPECIALIST_A2, TENANT_A, SPEC_USER_A2],
      );
      await query(
        `INSERT INTO services (id, tenant_id, name, price, duration_minutes, is_mobile_available)
         VALUES ($1, $2, $3, 1000000, 60, true)`,
        [SERVICE_A, TENANT_A, 'IT Service A'],
      );
      await query(
        `INSERT INTO services (id, tenant_id, name, price, duration_minutes, is_mobile_available)
         VALUES ($1, $2, $3, 500000, 30, false)`,
        [SERVICE_A2, TENANT_A, 'IT Service A2'],
      );
    });

    await withTenant(TENANT_B, async (query) => {
      await query(`DELETE FROM users WHERE id = $1`, [SPEC_USER_B]);
      await query(
        `INSERT INTO tenants (id, name, is_active, status, approved_at)
         VALUES ($1, $2, true, 'approved', NOW())
         ON CONFLICT (id) DO NOTHING`,
        [TENANT_B, 'IT Mobile Salon B'],
      );
      await query(
        `INSERT INTO users (id, tenant_id, phone, full_name, role) VALUES ($1, $2, $3, $4, 'specialist')`,
        [SPEC_USER_B, TENANT_B, '09120009954', 'IT Specialist B'],
      );
      await query(`SELECT set_config('app.current_role', 'admin', true)`); await query(`INSERT INTO specialists (id, tenant_id, user_id) VALUES ($1, $2, $3)`, [
        SPECIALIST_B,
        TENANT_B,
        SPEC_USER_B,
      ]);
      await query(
        `INSERT INTO services (id, tenant_id, name, price, duration_minutes) VALUES ($1, $2, $3, 750000, 45)`,
        [SERVICE_B, TENANT_B, 'IT Service B'],
      );
    });
  };

  /** The booking tests flip salon A's flagship pair; the catalogue tests rely on
   * the seeded state, so they restore it first. */
  const restoreCatalog = async (): Promise<void> => {
    await withTenant(TENANT_A, async (query) => {
      await query(`UPDATE specialists SET offers_mobile_service = true WHERE id = $1`, [
        SPECIALIST_A,
      ]);
      await query(`UPDATE services SET is_mobile_available = true WHERE id = $1`, [SERVICE_A]);
    });
  };

  const setFlags = async (offersMobile: boolean, isMobileAvailable: boolean): Promise<void> => {
    await withTenant(TENANT_A, async (query) => {
      await query(`UPDATE specialists SET offers_mobile_service = $2 WHERE id = $1`, [
        SPECIALIST_A,
        offersMobile,
      ]);
      await query(`UPDATE services SET is_mobile_available = $2 WHERE id = $1`, [
        SERVICE_A,
        isMobileAvailable,
      ]);
    });
  };

  let slotCounter = 0;

  const create = (overrides: Partial<CreateBookingInput> = {}): Promise<Booking> => {
    // Each booking gets its own non-overlapping hour, so the
    // `no_overlapping_bookings` exclusion constraint never fires between tests.
    slotCounter += 1;
    const startsAt = new Date(Date.now() + (48 + slotCounter * 2) * 60 * 60 * 1000);
    return bookings.create({
      tenantId: TENANT_A,
      specialistId: SPECIALIST_A,
      serviceId: SERVICE_A,
      customerId: CUSTOMER,
      startsAt,
      ...overrides,
    });
  };

  const readBooking = (id: string): Promise<MobileBookingRow | undefined> =>
    withTenant(TENANT_A, async (query) => {
      const rows = await query<MobileBookingRow[]>(
        `SELECT is_mobile, customer_address, customer_latitude, customer_longitude
           FROM bookings
          WHERE id = $1`,
        [id],
      );
      return rows[0];
    });

  const listIds = async (mobile?: boolean): Promise<string[]> => {
    const query = new SalonQueryDto();
    query.limit = 50;
    if (mobile !== undefined) query.mobile = mobile;
    const page = await salons.list(query);
    return page.data.map((salon) => salon.id);
  };

  it('refuses an on-site booking when the specialist does not travel', async () => {
    await setFlags(false, true);

    await expect(create({ isMobile: true, customerAddress: 'IT Address' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(create({ isMobile: true, customerAddress: 'IT Address' })).rejects.toThrow(
      'این متخصص خدمات سیار ارائه نمی‌دهد',
    );
  });

  it('refuses an on-site booking when the service cannot leave the salon', async () => {
    await setFlags(true, false);

    await expect(create({ isMobile: true, customerAddress: 'IT Address' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(create({ isMobile: true, customerAddress: 'IT Address' })).rejects.toThrow(
      'این خدمت به‌صورت سیار ارائه نمی‌شود',
    );
  });

  it('refuses an on-site booking without a customer address', async () => {
    await setFlags(true, true);

    await expect(create({ isMobile: true })).rejects.toThrow(BadRequestException);
    await expect(create({ isMobile: true, customerAddress: '   ' })).rejects.toThrow(
      'آدرس مشتری الزامی است',
    );
  });

  it('persists an on-site booking with its address and coordinates', async () => {
    await setFlags(true, true);

    const saved = await create({
      isMobile: true,
      customerAddress: 'IT Address 1',
      customerLatitude: 35.6892,
      customerLongitude: 51.389,
    });

    const row = await readBooking(saved.id);
    expect(row?.is_mobile).toBe(true);
    expect(row?.customer_address).toBe('IT Address 1');
    // The columns are `numeric`, so they arrive as decimal text; the coordinate
    // value is what matters, not the scale Postgres pads it out to.
    expect(Number(row?.customer_latitude)).toBe(35.6892);
    expect(Number(row?.customer_longitude)).toBe(51.389);
  });

  it('surfaces the on-site flag, address and coordinates on the panel booking detail', async () => {
    await setFlags(true, true);

    const saved = await create({
      isMobile: true,
      customerAddress: 'IT Panel Address',
      customerLatitude: 35.6892,
      customerLongitude: 51.389,
    });

    const owner = { userId: OWNER_A, role: 'salon_owner', tenantId: TENANT_A } as AuthenticatedUser;
    const detail = await salons.getPanelBooking(owner, saved.id);

    expect(detail.isMobile).toBe(true);
    expect(detail.customerAddress).toBe('IT Panel Address');
    // `numeric` arrives as decimal text (ADR-011); the panel's contract is the
    // raw column value, and the Flutter client parses it.
    expect(Number(detail.customerLatitude)).toBe(35.6892);
    expect(Number(detail.customerLongitude)).toBe(51.389);
  });

  it('reports an in-salon booking as not mobile on the panel detail', async () => {
    await setFlags(true, true);

    const saved = await create();

    const owner = { userId: OWNER_A, role: 'salon_owner', tenantId: TENANT_A } as AuthenticatedUser;
    const detail = await salons.getPanelBooking(owner, saved.id);

    expect(detail.isMobile).toBe(false);
    expect(detail.customerAddress).toBeNull();
    expect(detail.customerLatitude).toBeNull();
    expect(detail.customerLongitude).toBeNull();
  });

  it('lists the on-site flag alongside the panel bookings', async () => {
    await setFlags(true, true);

    const mobile = await create({
      isMobile: true,
      customerAddress: 'IT Panel List Address',
      customerLatitude: 35.6892,
      customerLongitude: 51.389,
    });
    const inSalon = await create();

    const owner = { userId: OWNER_A, role: 'salon_owner', tenantId: TENANT_A } as AuthenticatedUser;
    const page = await salons.listPanelBookings(owner, new SalonPanelBookingsQueryDto());

    const byId = new Map(page.data.map((booking) => [booking.id, booking]));
    expect(byId.get(mobile.id)?.isMobile).toBe(true);
    expect(byId.get(mobile.id)?.customerAddress).toBe('IT Panel List Address');
    expect(byId.get(inSalon.id)?.isMobile).toBe(false);
  });

  it('leaves an in-salon booking untouched by the new fields', async () => {
    await setFlags(true, true);

    // An address sent with a regular booking is dropped, not stored: the column
    // only belongs on an on-site row.
    const saved = await create({ customerAddress: 'never stored' });

    const row = await readBooking(saved.id);
    expect(row?.is_mobile).toBe(false);
    expect(row?.customer_address).toBeNull();
    expect(row?.customer_latitude).toBeNull();
    expect(row?.customer_longitude).toBeNull();
  });

  it('narrows the salon feed to salons that can deliver on-site', async () => {
    await restoreCatalog();

    const mobile = await listIds(true);
    expect(mobile).toContain(TENANT_A);
    expect(mobile).not.toContain(TENANT_B);

    // Without the flag the feed is not narrowed at all.
    const all = await listIds();
    expect(all).toContain(TENANT_A);
    expect(all).toContain(TENANT_B);
  });

  it('lists every specialist, and only travelling ones with ?mobile=true', async () => {
    await restoreCatalog();

    const every = await salons.specialists(TENANT_A);
    expect(every.data.map((specialist) => specialist.id).sort()).toEqual(
      [SPECIALIST_A, SPECIALIST_A2].sort(),
    );

    const mobile = await salons.specialists(TENANT_A, true);
    expect(mobile.data.map((specialist) => specialist.id)).toEqual([SPECIALIST_A]);
    expect(mobile.data[0].offersMobileService).toBe(true);

    const none = await salons.specialists(TENANT_B, true);
    expect(none.data).toHaveLength(0);
  });

  it('lists every service, and only mobile ones with ?mobile=true', async () => {
    await restoreCatalog();

    const every = await salons.services(TENANT_A);
    expect(every.data.map((service) => service.id).sort()).toEqual([SERVICE_A, SERVICE_A2].sort());

    const mobile = await salons.services(TENANT_A, true);
    expect(mobile.data.map((service) => service.id)).toEqual([SERVICE_A]);
    expect(mobile.data[0].isMobileAvailable).toBe(true);

    const none = await salons.services(TENANT_B, true);
    expect(none.data).toHaveLength(0);
  });

  it('exposes both flags on the salon detail page', async () => {
    await restoreCatalog();

    const detail = await salons.findOne(TENANT_A, new SalonQueryDto());

    const mobileByService = new Map(
      detail.services.map((service) => [service.id, service.isMobileAvailable]),
    );
    expect(mobileByService.get(SERVICE_A)).toBe(true);
    expect(mobileByService.get(SERVICE_A2)).toBe(false);

    const travellingBySpecialist = new Map(
      detail.specialists.map((specialist) => [specialist.id, specialist.offersMobileService]),
    );
    expect(travellingBySpecialist.get(SPECIALIST_A)).toBe(true);
    expect(travellingBySpecialist.get(SPECIALIST_A2)).toBe(false);
  });

  it('takes effect through the panel toggles', async () => {
    await restoreCatalog();

    const owner = { userId: OWNER_A, role: 'salon_owner', tenantId: TENANT_A } as AuthenticatedUser;

    // Flip both flags from the salon panel: the travelling specialist stops
    // travelling, the in-salon one starts, and the same for the services.
    await salons.updatePanelSpecialist(owner, SPECIALIST_A, { offersMobileService: false });
    await salons.updatePanelSpecialist(owner, SPECIALIST_A2, { offersMobileService: true });
    await salons.updateService(owner, SERVICE_A, { isMobileAvailable: false });
    await salons.updateService(owner, SERVICE_A2, { isMobileAvailable: true });

    const mobileSpecialists = await salons.specialists(TENANT_A, true);
    expect(mobileSpecialists.data.map((specialist) => specialist.id)).toEqual([SPECIALIST_A2]);

    const mobileServices = await salons.services(TENANT_A, true);
    expect(mobileServices.data.map((service) => service.id)).toEqual([SERVICE_A2]);

    // With no travelling specialist left the salon drops out of the mobile feed
    // entirely, even though it still has a mobile service on the books.
    await salons.updatePanelSpecialist(owner, SPECIALIST_A2, { offersMobileService: false });
    const feed = await listIds(true);
    expect(feed).not.toContain(TENANT_A);
  });
});
