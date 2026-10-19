import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { City } from '../../src/modules/location/entities/city.entity';
import { Province } from '../../src/modules/location/entities/province.entity';
import { LocationModule } from '../../src/modules/location/location.module';
import { SalonModule } from '../../src/modules/salon/salon.module';
import { adminConfig, TEST_DB_NAME } from '../setup/test-db';
import { describeIntegration, queryAsAdmin } from '../setup/integration.setup';

/**
 * Province/city endpoints and the salon city filter, end to end over HTTP
 * against the migrated test database (reference tables from migrations
 * 1730000000038 / 1730000000039).
 *
 * The spec boots the real `LocationModule` (so `@Public`, the ValidationPipe and
 * the TypeORM repositories are all exercised) alongside `SalonModule`, because
 * `?cityId=` only means something when the catalogue filter and the location
 * seed agree on what a city id is.
 *
 * The connection is the migration owner with the two entities attached — the
 * shared integration DataSource declares `entities: []`, which cannot resolve
 * `@InjectRepository(Province)` — and it is the role the application itself
 * connects as, so `SalonService.list` sees tenants the way production does.
 */

interface ProvinceResponse {
  id: string;
  code: string;
  nameFa: string;
  nameEn: string;
  displayOrder: number;
  isActive: boolean;
}

interface CityResponse {
  id: string;
  provinceId: string;
  code: string;
  nameFa: string;
  nameEn: string;
  isCapital: boolean;
  displayOrder: number;
  isActive: boolean;
}

interface SalonPageResponse {
  data: Array<{ id: string }>;
  total: number;
}

/** Iran has 31 provinces; the seed pins that number, so it is asserted exactly. */
const EXPECTED_PROVINCES = 31;

describeIntegration('locations: provinces, cities and the salon city filter', () => {
  let app: INestApplication;
  let baseUrl: string;

  /** Two salons that differ only in which city they sit in. */
  const TENANT_TEHRAN = '0c000000-0000-4000-8000-0000000000c1';
  const TENANT_OTHER = '0c000000-0000-4000-8000-0000000000c2';
  const SLUG_TEHRAN = `it-location-tehran-${Date.now()}`;
  const SLUG_OTHER = `it-location-other-${Date.now()}`;

  let tehranProvinceId: string;
  let tehranCityId: string;
  let otherCityId: string;

  const call = (path: string, init: RequestInit = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });

  beforeAll(async () => {
    // Resolve the seed rows by their stable Persian names rather than the
    // generated city codes, which are derived from the English names.
    const [tehran] = await queryAsAdmin<{ id: string }>(`SELECT id FROM provinces WHERE code = 'THR'`);
    const [tehranCity] = await queryAsAdmin<{ id: string }>(
      `SELECT id FROM cities WHERE province_id = $1 AND name_fa = 'تهران'`,
      [tehran.id],
    );
    const [otherCity] = await queryAsAdmin<{ id: string; province_id: string }>(
      `SELECT id, province_id FROM cities WHERE name_fa = 'تبریز'`,
    );
    tehranProvinceId = tehran.id;
    tehranCityId = tehranCity.id;
    otherCityId = otherCity.id;

    await queryAsAdmin(`DELETE FROM tenants WHERE id IN ($1, $2)`, [TENANT_TEHRAN, TENANT_OTHER]);
    // Both salons are made publicly visible the way `list` requires: approved at
    // least once and not suspended. Only the location columns differ.
    for (const [id, slug, cityId, provinceId] of [
      [TENANT_TEHRAN, SLUG_TEHRAN, tehranCityId, tehranProvinceId],
      [TENANT_OTHER, SLUG_OTHER, otherCityId, otherCity.province_id],
    ] as const) {
      await queryAsAdmin(
        `INSERT INTO tenants (id, name, slug, status, approved_at, is_active, city_id, province_id)
         VALUES ($1, $2, $3, 'approved', NOW(), true, $4, $5)`,
        [id, `Location salon ${slug}`, slug, cityId, provinceId],
      );
    }

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }), // ✅ این خط را اضافه کنید
        TypeOrmModule.forRoot({
        // Owns and exports the connection so that both the `forFeature`
        // repositories in `LocationModule` and `SalonService`'s injected
        // `DataSource` resolve to the same migration-owner client. The two
        // entities are named explicitly because the shared harness DataSource
        // declares `entities: []`.
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: String(adminConfig.host),
          port: Number(adminConfig.port),
          username: String(adminConfig.user),
          password: String(adminConfig.password),
          database: TEST_DB_NAME,
          entities: [Province, City],
          synchronize: false,
        }),
        EventEmitterModule.forRoot(),
        LocationModule,
        SalonModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Mirrors main.ts; `whitelist` + `transform` are what make the `?q=` and
    // `?cityId=` validations actually run on the query string.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0);
    baseUrl = await app.getUrl();
  }, 30_000);

  afterAll(async () => {
    // Closing the app destroys the TypeORM connection the module opened.
    await app?.close();
    await queryAsAdmin(`DELETE FROM tenants WHERE id IN ($1, $2)`, [TENANT_TEHRAN, TENANT_OTHER]);
  });

  it('GET /locations/provinces → all 31, ordered for the city picker', async () => {
    const response = await call('/locations/provinces');

    expect(response.status).toBe(200);
    const body = (await response.json()) as ProvinceResponse[];

    expect(body).toHaveLength(EXPECTED_PROVINCES);
    expect(body.map((province) => province.displayOrder)).toEqual(
      [...body.map((province) => province.displayOrder)].sort((a, b) => a - b),
    );
    // Tehran is displayOrder 1 in the seed, so it heads the list the Home screen
    // renders first.
    expect(body[0].code).toBe('THR');
    expect(body[0].nameFa).toBe('تهران');
  });

  it('GET /locations/provinces/:id/cities → Tehran county, capital first', async () => {
    const response = await call(`/locations/provinces/${tehranProvinceId}/cities`);

    expect(response.status).toBe(200);
    const body = (await response.json()) as CityResponse[];

    // Tehran province seeds 22 cities; the assertion stays loose (> 10) so a
    // future seed addition cannot break it, but the ordering contract is exact.
    expect(body.length).toBeGreaterThan(10);
    expect(body[0].nameFa).toBe('تهران');
    expect(body[0].isCapital).toBe(true);
    expect(body.every((city) => city.provinceId === tehranProvinceId)).toBe(true);
    expect(body.map((city) => city.displayOrder)).toEqual(
      [...body.map((city) => city.displayOrder)].sort((a, b) => a - b),
    );
  });

  it('GET /locations/cities?q=تهر → only cities whose name contains the term', async () => {
    const response = await call(`/locations/cities?q=${encodeURIComponent('تهر')}`);

    expect(response.status).toBe(200);
    const body = (await response.json()) as CityResponse[];

    expect(body.length).toBeGreaterThan(0);
    expect(
      body.every((city) => city.nameFa.includes('تهر') || city.nameEn.toLowerCase().includes('تهر')),
    ).toBe(true);
    // The search is not province-scoped: it runs across the whole country.
    expect(body.map((city) => city.nameFa)).toContain('تهران');
  });

  it('GET /locations/cities?q=ت → [] without ever touching Postgres', async () => {
    const response = await call(`/locations/cities?q=${encodeURIComponent('ت')}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it('GET /salons?cityId=<tehran> → only the salons in that city', async () => {
    const response = await call(`/salons?cityId=${tehranCityId}`);

    expect(response.status).toBe(200);
    const body = (await response.json()) as SalonPageResponse;
    const ids = body.data.map((salon) => salon.id);

    expect(ids).toContain(TENANT_TEHRAN);
    expect(ids).not.toContain(TENANT_OTHER);
  });

  it('GET /salons with no city filter → both salons', async () => {
    const response = await call('/salons');

    expect(response.status).toBe(200);
    const body = (await response.json()) as SalonPageResponse;
    const ids = body.data.map((salon) => salon.id);

    expect(ids).toContain(TENANT_TEHRAN);
    expect(ids).toContain(TENANT_OTHER);
  });
});
