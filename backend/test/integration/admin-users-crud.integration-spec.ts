import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { AdminUsersController } from '../../src/modules/admin/users/admin-users.controller';
import { AdminUsersService } from '../../src/modules/admin/users/admin-users.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { describeIntegration, getDataSource, queryAsAdmin } from '../setup/integration.setup';

/**
 * POST /admin/users + DELETE /admin/users/:id over HTTP.
 *
 * Boots the real controller, the real `AdminUsersService`, the real
 * `JwtAuthGuard` and the real `ValidationPipe` from `main.ts`, so the DTO
 * decorators (phone regex, role enum) and the `role=admin` service gate are
 * actually exercised. Only `DataSource` is wired, and to the **RLS-subject**
 * `beauty_app` connection — not the superuser — so the SECURITY DEFINER
 * `admin_create_user` / `admin_soft_delete_user` functions added in migration
 * 1730000000034 are proven to work under the role the app runs as. A regression
 * that swapped them back for raw SQL would make every write silently affect
 * zero rows and this suite would go red.
 *
 * The app listens on port 0 (an ephemeral port) so it never collides with a
 * running `npm run start:dev`.
 */
const ACCESS_SECRET = 'integration-secret';

/** This file owns the `0912666…` phone range and the `0c…` id space. */
const TENANT_ID = '0c000000-0000-4000-8000-000000000001';
const ADMIN_ID = '0c000000-0000-4000-8000-0000000000ad';
const ADMIN_PHONE = '09126660000';

let phoneCounter = 0;
const nextPhone = () => `0912666${(++phoneCounter).toString().padStart(4, '0')}`;

describeIntegration('admin users CRUD (POST + DELETE /admin/users)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwtService: JwtService;

  beforeAll(async () => {
    // Superuser connection for fixtures: an admin JWT carries no tenant, and
    // `users` is FORCE RLS, so the seed must bypass the policy the app honours.
    await queryAsAdmin(`INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)`, [
      TENANT_ID,
      'Admin Users CRUD Salon',
      `it-admin-users-crud-${Date.now()}`,
    ]);
    await queryAsAdmin(
      `INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, NULL, $2, 'admin')`,
      [ADMIN_ID, ADMIN_PHONE],
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        // Same guard the app registers globally; no RolesGuard here because the
        // admin gate lives in the service (requireAdmin), not on a decorator.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        AdminUsersService,
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
    // Order matters: specialists and users reference the tenant; audit_logs has
    // no FK but is cleaned for tidiness. Superuser connection, so FORCE RLS is
    // not in the way.
    await queryAsAdmin(
      `DELETE FROM audit_logs WHERE actor_id IN (SELECT id FROM users WHERE phone LIKE '0912666%')`,
    );
    await queryAsAdmin(
      `DELETE FROM specialists WHERE user_id IN (SELECT id FROM users WHERE phone LIKE '0912666%')`,
    );
    await queryAsAdmin(`DELETE FROM specialists WHERE tenant_id = $1`, [TENANT_ID]);
    await queryAsAdmin(`DELETE FROM users WHERE phone LIKE '0912666%'`);
    await queryAsAdmin(`DELETE FROM users WHERE tenant_id = $1`, [TENANT_ID]);
    await queryAsAdmin(`DELETE FROM tenants WHERE id = $1`, [TENANT_ID]);
  });

  const call = (path: string, init: RequestInit = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });

  const tokenFor = (role: 'admin' | 'customer', subject: string) =>
    jwtService.sign({ sub: subject, phone: ADMIN_PHONE, role, tenantId: null });

  const adminPost = (body: unknown) =>
    call('/admin/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenFor('admin', ADMIN_ID)}` },
      body: JSON.stringify(body),
    });

  const adminDelete = (id: string) =>
    call(`/admin/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenFor('admin', ADMIN_ID)}` },
    });

  it('admin → POST /admin/users with role=specialist → 201, and the specialist row is auto-created', async () => {
    const phone = nextPhone();
    const response = await adminPost({ phone, role: 'specialist', fullName: 'مریم رضایی', tenantId: TENANT_ID });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      id: string;
      phoneNumber: string;
      role: string;
      tenantId: string | null;
      isActive: boolean;
      specialistCreated: boolean;
    };
    expect(body.phoneNumber).toBe(phone);
    expect(body.role).toBe('specialist');
    expect(body.tenantId).toBe(TENANT_ID);
    expect(body.isActive).toBe(true);
    expect(body.specialistCreated).toBe(true);

    // The user really exists and the auto-add pattern produced an approved,
    // active specialist row bound to the same user.
    const users = await queryAsAdmin<{ id: string; is_active: boolean }>(
      `SELECT id, is_active FROM users WHERE phone = $1`,
      [phone],
    );
    expect(users).toHaveLength(1);
    expect(users[0].is_active).toBe(true);

    const specs = await queryAsAdmin<{ status: string; is_active: boolean }>(
      `SELECT status, is_active FROM specialists WHERE user_id = $1`,
      [users[0].id],
    );
    expect(specs).toHaveLength(1);
    expect(specs[0].status).toBe('approved');
    expect(specs[0].is_active).toBe(true);
  });

  it('admin → POST /admin/users with an already-used phone → 409', async () => {
    const phone = nextPhone();
    const first = await adminPost({ phone, role: 'customer' });
    expect(first.status).toBe(201);

    const dup = await adminPost({ phone, role: 'customer' });
    expect(dup.status).toBe(409);
    const body = (await dup.json()) as { message: string };
    expect(body.message).toContain('قبلاً ثبت شده');
  });

  it('customer → POST /admin/users → 403 (the service refuses a non-admin)', async () => {
    const response = await call('/admin/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenFor('customer', ADMIN_ID)}` },
      body: JSON.stringify({ phone: nextPhone(), role: 'customer' }),
    });

    expect(response.status).toBe(403);
    const body = (await response.json()) as { message: string };
    expect(body.message).toContain('مدیر سامانه');
  });

  it('admin → DELETE /admin/users/:id → 200, and both user and specialist flip is_active=false', async () => {
    const phone = nextPhone();
    const created = await adminPost({ phone, role: 'specialist', tenantId: TENANT_ID });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };

    const response = await adminDelete(id);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });

    // Confirmed in the database, not just the response body.
    const users = await queryAsAdmin<{ is_active: boolean }>(
      `SELECT is_active FROM users WHERE id = $1`,
      [id],
    );
    expect(users[0].is_active).toBe(false);

    const specs = await queryAsAdmin<{ is_active: boolean }>(
      `SELECT is_active FROM specialists WHERE user_id = $1`,
      [id],
    );
    expect(specs[0].is_active).toBe(false);
  });

  it('admin → DELETE /admin/users/:id of themselves → 400', async () => {
    const response = await adminDelete(ADMIN_ID);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { message: string };
    expect(body.message).toContain('حساب خودتان');
  });
});

