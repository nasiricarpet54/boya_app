import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import { AuthController } from '../../src/modules/auth/auth.controller';
import { AuthService } from '../../src/modules/auth/auth.service';
import { InviteTokenService } from '../../src/modules/auth/invite-token.service';
import { OtpService } from '../../src/modules/auth/otp.service';
import { RefreshTokenService } from '../../src/modules/auth/refresh-token.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard';

/**
 * `@Roles()` enforcement on the invite routes (ADR-010).
 *
 * The rest of this folder drives a real database; this spec does not need one.
 * What it pins down is the *guard chain*, which is pure: `JwtAuthGuard` verifies
 * the token and attaches `request.user`, then `RolesGuard` reads the `@Roles()`
 * metadata off the real `AuthController` handler. Testing that through a live
 * Postgres would only add noise, so the module below is the smallest one that
 * can serve `AuthController` over HTTP.
 *
 * A full `AppModule` is deliberately not booted: it needs Redis, TypeORM and the
 * SMS provider, none of which these assertions touch.
 *
 * The app listens on port 0 (an ephemeral port the OS hands out) rather than the
 * production 3000, so the suite never collides with a running `npm run start:dev`.
 */
const ACCESS_SECRET = 'integration-secret';

/** Version 4 UUIDs: `ParseUUIDPipe({ version: '4' })` rejects anything else. */
const TENANT_A = '55555555-5555-4555-8555-555555555555';
const CUSTOMER_ID = 'c9d1e2f3-4a56-4b7c-8d9e-f0a1b2c3d4e5';
const ADMIN_ID = 'd0e1f2a3-4b56-4c7d-8e9f-0a1b2c3d4e5f';

describe('RolesGuard (integration)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwtService: JwtService;
  const inviteTokenService = {
    create: jest.fn(),
    listByTenant: jest.fn(),
    revoke: jest.fn(),
  };

  beforeAll(async () => {
    jwtService = new JwtService({ secret: ACCESS_SECRET });

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        // Mirrors app.module.ts: JwtAuthGuard is registered before RolesGuard,
        // and guards run in registration order, so `request.user` is populated
        // by the time the role check reads it.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { get: () => ACCESS_SECRET, getOrThrow: () => ACCESS_SECRET },
        },
        { provide: OtpService, useValue: { sendOtp: jest.fn() } },
        {
          provide: AuthService,
          useValue: { verifyOtpAndIssueToken: jest.fn(), verifyInviteOtpAndIssueToken: jest.fn() },
        },
        {
          provide: RefreshTokenService,
          useValue: { rotate: jest.fn(), revoke: jest.fn(), revokeAll: jest.fn() },
        },
        // The handler is expected to run, so the invite service answers with a
        // well-formed shape rather than being asserted for its own behaviour —
        // `invite-token.integration-spec.ts` owns that.
        { provide: InviteTokenService, useValue: inviteTokenService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    inviteTokenService.listByTenant.mockResolvedValue([]);
  });

  const tokenFor = (role: 'customer' | 'admin', tenantId: string | null) =>
    jwtService.sign({
      sub: role === 'admin' ? ADMIN_ID : CUSTOMER_ID,
      phone: '09123456789',
      role,
      tenantId,
    });

  const call = (path: string, init: RequestInit = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });

  it('answers 401 (not 403) when the caller presents no token', async () => {
    // Distinguishes "not signed in" from "signed in but not allowed": the role
    // guard must never be the thing that rejects an anonymous caller.
    const response = await call('/auth/invite/list', { method: 'GET' });

    expect(response.status).toBe(401);
    expect(inviteTokenService.listByTenant).not.toHaveBeenCalled();
  });

  it('rejects an authenticated customer on POST /auth/invite with 403, not 401', async () => {
    // The customer's token verifies (so JwtAuthGuard passes and `request.user`
    // exists), but `customer` is not in @Roles('salon_owner','line_manager','admin'),
    // so RolesGuard must answer 403 Forbidden — not 401, and not 201.
    const response = await call('/auth/invite', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenFor('customer', TENANT_A)}` },
      body: JSON.stringify({ role: 'specialist', phone: '09129990001' }),
    });

    expect(response.status).toBe(403);
    const body = (await response.json()) as { message: string };
    expect(body.message).toContain('دسترسی لازم');
    // The handler is never reached — a rejected role must not mint an invite.
    expect(inviteTokenService.create).not.toHaveBeenCalled();
  });

  it('allows an admin on GET /auth/invite/list and forwards the named salon', async () => {
    const response = await call(`/auth/invite/list?tenantId=${TENANT_A}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenFor('admin', null)}` },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    // An admin JWT carries no tenant, so the salon must come from the query —
    // proving the guard let the request through *and* the handler resolved it.
    expect(inviteTokenService.listByTenant).toHaveBeenCalledWith(TENANT_A);
  });

  it('rejects an admin on POST /auth/invite when no salon is named (400, not 403)', async () => {
    // Past the role gate, the failure is the missing salon — `resolveInviteTenant`
    // refuses to guess, because a default would invite into the wrong tenant.
    const response = await call('/auth/invite', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenFor('admin', null)}` },
      body: JSON.stringify({ role: 'specialist', phone: '09129990002' }),
    });

    expect(response.status).toBe(400);
    expect(inviteTokenService.create).not.toHaveBeenCalled();
  });
});
