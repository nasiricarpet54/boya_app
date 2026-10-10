import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { AdminTenantsController } from '../../src/modules/admin/tenants/admin-tenants.controller';
import { AdminTenantsService } from '../../src/modules/admin/tenants/admin-tenants.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { describeIntegration, getDataSource, queryAsAdmin } from '../setup/integration.setup';

/**
 * PATCH /admin/tenants/:id + DELETE /admin/tenants/:id over HTTP.
 *
 * Boots the real controller, the real `AdminTenantsService`, the real
 * `JwtAuthGuard` and the real `ValidationPipe` from `main.ts`, so the DTO
 * decorators (slug charset, phone regex, discount bounds, categoryId UUID)
 * and the `role=admin` service gate are actually exercised. `DataSource` is
 * wired to the **RLS-subject** `beauty_app` connection — not the superuser —
 * which is also proof that these writes do *not* need a SECURITY DEFINER
 * helper: unlike `users`, the `tenants` table carries no row-level security
 * (see migration 1730000000023), so a plain `UPDATE tenants SET …` reaches the
 * row under the role the app runs as. A regression that moved the table behind
 * RLS would make every write silently affect zero rows and this suite would
 * go red.
 *
 * The app listens on port 0 (an ephemeral port) so it never collides with a
 * running `npm run start:dev`.
 */
const ACCESS_SECRET = 'integration-secret';

/** This file owns the `0b…` id space. */
const TENANT_ID = '0b000000-0000-4000-8000-000000000001';
const OTHER_TENANT_ID = '0b000000-0000-4000-8000-000000000002';
const DELETE_TENANT_ID = '0b000000-0000-4000-8000-000000000003';
const ADMIN_ID = '0b000000-0000-4000-8000-0000000000ad';
const ADMIN_PHONE = '09128880000';

/** A well-formed v4 UUID that is guaranteed not to exist as a category/tenant. */
const MISSING_UUID = '0b999999-9999-4999-8999-999999999999';
/** The slug another tenant already holds, reused to trigger the 409. */
const OTHER_SLUG = 'it-admin-tenants-crud-other';

describeIntegration('admin tenants CRUD (PATCH + DELETE /admin/tenants/:id)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwtService: JwtService;

  beforeAll(async () => {
    // Three tenants. `tenants` has no RLS, but the fixtures still go through
    // the migration-owner connection for parity with the other admin specs.
    await queryAsAdmin(
      `INSERT INTO tenants (id, name, slug, phone, status) VALUES ($1, $2, $3, $4, 'approved')`,
      [TENANT_ID, 'Admin Tenants CRUD Salon', 'it-admin-tenants-crud-main', '09121110000'],
    );
    await queryAsAdmin(
      `INSERT INTO tenants (id, name, slug, phone, status) VALUES ($1, $2, $3, $4, 'approved')`,
      [OTHER_TENANT_ID, 'Other CRUD Salon', OTHER_SLUG, '09122220000'],
    );
    await queryAsAdmin(
      `INSERT INTO tenants (id, name, slug, phone, status) VALUES ($1, $2, $3, $4, 'approved')`,
      [DELETE_TENANT_ID, 'Delete CRUD Salon', 'it-admin-tenants-crud-del', '09123330000'],
    );
    await queryAsAdmin(
      `INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, NULL, $2, 'admin')`,
      [ADMIN_ID, ADMIN_PHONE],
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminTenantsController],
      providers: [
        // Same guard the app registers globally; no RolesGuard here because the
        // admin gate lives in the service (requireAdmin), not on a decorator.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        AdminTenantsService,
        { provide: DataSource, useValue: getDataSource() },
        { provide: JwtService, useValue: new JwtService({ secret: ACCESS_SECRET }) },
        {
          provide: ConfigService,
          useValue: {
            get: <T>(_key: string, fallback: T) => fallback,
            getOrThrow: () => ACCESS_SECRET,
          } as unknown as ConfigService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Mirrors main.ts verbatim: whitelist + forbidNonWhitelisted + transform,
    // so an undeclared body key is a 400 rather than silently ignored.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.listen(0);
    baseUrl = await app.getUrl();
    jwtService = app.get(JwtService);
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    // Order matters: audit_logs has an FK to tenants (ON DELETE SET NULL), but
    // is cleaned first for tidiness. Superuser connection.
    await queryAsAdmin(`DELETE FROM audit_logs WHERE tenant_id = ANY($1::uuid[])`, [
      [TENANT_ID, OTHER_TENANT_ID, DELETE_TENANT_ID],
    ]);
    await queryAsAdmin(`DELETE FROM users WHERE id = $1`, [ADMIN_ID]);
    await queryAsAdmin(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [
      [TENANT_ID, OTHER_TENANT_ID, DELETE_TENANT_ID],
    ]);
  });

  const call = (path: string, init: RequestInit = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });

  const tokenFor = (role: 'admin' | 'customer', subject: string) =>
    jwtService.sign({ sub: subject, phone: ADMIN_PHONE, role, tenantId: null });

  const adminPatch = (id: string, body: unknown) =>
    call(`/admin/tenants/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenFor('admin', ADMIN_ID)}` },
      body: JSON.stringify(body),
    });

  const adminDelete = (id: string) =>
    call(`/admin/tenants/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenFor('admin', ADMIN_ID)}` },
    });

  it('admin → PATCH /admin/tenants/:id {name} → 200 and the row is updated', async () => {
    const response = await adminPatch(TENANT_ID, { name: 'نام جدید سالن' });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string; name: string; slug: string | null };
    expect(body.id).toBe(TENANT_ID);
    expect(body.name).toBe('نام جدید سالن');

    // Confirmed in the database, not just the response body.
    const tenants = await queryAsAdmin<{ name: string; slug: string | null }>(
      `SELECT name, slug FROM tenants WHERE id = $1`,
      [TENANT_ID],
    );
    expect(tenants[0].name).toBe('نام جدید سالن');
  });

  it('admin → PATCH with a slug another tenant already owns → 409', async () => {
    const response = await adminPatch(TENANT_ID, { slug: OTHER_SLUG });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { message: string };
    expect(body.message).toContain('اسلاگ');
  });

  it('admin → PATCH with a non-existent categoryId → 404', async () => {
    const response = await adminPatch(TENANT_ID, { categoryId: MISSING_UUID });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { message: string };
    expect(body.message).toContain('دسته‌بندی');
  });

  it('admin → PATCH a non-existent tenant → 404', async () => {
    const response = await adminPatch(MISSING_UUID, { name: 'چیزی' });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { message: string };
    expect(body.message).toContain('یافت نشد');
  });

  it('customer → PATCH → 403 (the service refuses a non-admin)', async () => {
    const response = await call(`/admin/tenants/${TENANT_ID}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenFor('customer', ADMIN_ID)}` },
      body: JSON.stringify({ name: 'تلاش غیرمجاز' }),
    });

    expect(response.status).toBe(403);
    const body = (await response.json()) as { message: string };
    expect(body.message).toContain('مدیر سامانه');
  });

  it('admin → DELETE /admin/tenants/:id → 200 and the salon soft-deletes', async () => {
    const response = await adminDelete(DELETE_TENANT_ID);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, message: 'سالن غیرفعال شد' });

    // Confirmed in the database, not just the response body.
    const tenants = await queryAsAdmin<{ is_active: boolean; status: string }>(
      `SELECT is_active, status FROM tenants WHERE id = $1`,
      [DELETE_TENANT_ID],
    );
    expect(tenants[0].is_active).toBe(false);
    expect(tenants[0].status).toBe('suspended');
  });
});

