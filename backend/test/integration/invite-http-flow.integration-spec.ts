import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { SmsService } from '@mirad-work/sms-nestjs';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { AuthController } from '../../src/modules/auth/auth.controller';
import { AuthService } from '../../src/modules/auth/auth.service';
import { AcceptedInvite, InviteTokenService } from '../../src/modules/auth/invite-token.service';
import { OtpService } from '../../src/modules/auth/otp.service';
import type { OtpPurpose } from '../../src/modules/auth/otp.service';
import { RefreshTokenService } from '../../src/modules/auth/refresh-token.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard';
import { PERSIAN_ERRORS } from '../../src/common/persian-errors';
import { toLatinDigits } from '../../src/utils/persian-number.util';
import { describeIntegration, getAdminDataSource, queryAsAdmin } from '../setup/integration.setup';

/**
 * The invite/accept flow *over HTTP*, rather than through the service directly.
 *
 * `tenant-onboarding` and `specialist-onboarding` call `inviteService.accept()`
 * in-process, which skips `AuthController` and the DTOs entirely — so two bugs
 * lived in exactly those skipped layers and every run stayed green:
 *
 *  1. `AcceptInviteDto.otpCode` carried a malformed regex (`/^[0-9]{۰-۹0-9]{6}$/`)
 *     that matched nothing, so every accept came back 400.
 *  2. `POST /auth/otp/send` never forwarded a purpose, so it issued `login`
 *     codes while `invite/accept` verifies under `invite` — 401 OTP_EXPIRED.
 *
 * What this spec boots is therefore deliberately the HTTP surface: the real
 * `AuthController`, the real `AuthService` / `InviteTokenService` /
 * `RefreshTokenService`, the real `JwtAuthGuard` + `RolesGuard` chain, and the
 * real `ValidationPipe` from `main.ts` (`whitelist` + `forbidNonWhitelisted` +
 * `transform`), so the DTO decorators are actually executed. The only stand-in
 * is `OtpService`, replaced by a deterministic double below.
 *
 * The app talks to the migrated test database on the migration-owner connection
 * (the role the application itself connects as today) — the same choice the
 * other onboarding specs make, because `accept` resolves rows from a credential
 * before any tenant context exists. `roles-guard.integration-spec` owns the
 * guard chain without a database; this one owns the pipe with one.
 */
const ACCESS_SECRET = 'integration-secret';

/**
 * Deterministic stand-in for `OtpService`.
 *
 * Every send answers one fixed code, so the tests never have to read a hash out
 * of Redis. `issued` mirrors the purpose-namespaced keys the real service uses
 * (`otp:<purpose>:<phone>`), so a code issued for one purpose still cannot be
 * spent on another — that separation is part of what the spec asserts.
 */
const OTP_CODE = '123456';
const issued = new Map<string, string>();
const fakeOtp = {
  CODE: OTP_CODE,
  sendOtp: jest.fn(async (phoneNumber: string, purpose: OtpPurpose = 'login') => {
    issued.set(`${purpose}:${phoneNumber}`, OTP_CODE);
  }),
  verifyOtp: jest.fn(async (phoneNumber: string, code: string, purpose: OtpPurpose = 'login') => {
    const stored = issued.get(`${purpose}:${phoneNumber}`);
    if (!stored || toLatinDigits(code) !== stored) {
      throw new UnauthorizedException(PERSIAN_ERRORS.OTP_INVALID);
    }
    // Single-use, like the real service: a second spend of the same purpose+phone fails.
    issued.delete(`${purpose}:${phoneNumber}`);
  }),
};

describeIntegration('invite flow over HTTP (DTO + controller layer)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let inviteService: InviteTokenService;

  /**
   * The inviter and its salon. `invite_tokens.invited_by` is
   * `NOT NULL REFERENCES users(id)`, so the admin has to be a real row; an admin
   * JWT carries no tenant, hence `tenant_id IS NULL` here. Fixed ids + a
   * namespaced slug/phone range so the cleanup below is exact and repeatable.
   * `0912777…` is this file's; the other onboarding specs own `0912887…`/…
   */
  const TENANT_ID = '0b000000-0000-4000-8000-000000000001';
  const ADMIN_ID = '0b000000-0000-4000-8000-0000000000ad';
  const ADMIN_PHONE = '09127770000';
  const SLUG = `it-invite-http-${Date.now()}`;

  let phoneCounter = 0;
  const nextPhone = () => `0912777${(++phoneCounter).toString().padStart(4, '0')}`;

  beforeAll(async () => {
    await queryAsAdmin(`INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)`, [
      TENANT_ID,
      'HTTP Invite Salon',
      SLUG,
    ]);
    await queryAsAdmin(
      `INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, NULL, $2, 'admin')`,
      [ADMIN_ID, ADMIN_PHONE],
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        // Same registration order as app.module.ts: JwtAuthGuard populates
        // `request.user` before RolesGuard reads it.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        AuthService,
        RefreshTokenService,
        InviteTokenService,
        { provide: OtpService, useValue: fakeOtp },
        // `create` sends the invite SMS; it is fail-soft, so a resolving stub is enough.
        { provide: SmsService, useValue: { verify: jest.fn().mockResolvedValue({ success: true }) } },
        { provide: DataSource, useValue: getAdminDataSource() },
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
    // Mirrors main.ts verbatim. `whitelist` is what makes the purpose assertion
    // meaningful: a `purpose` key the DTO stopped declaring would be dropped
    // here rather than silently ignored, and the test below would fail.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0);
    baseUrl = await app.getUrl();
    inviteService = app.get(InviteTokenService);
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    // Order matters: specialists and refresh_tokens reference users, and
    // invite_tokens reference both users and tenants. Superuser connection, so
    // the FORCE ROW LEVEL SECURITY on these tables is not in the way.
    await queryAsAdmin(
      `DELETE FROM specialists WHERE user_id IN (SELECT id FROM users WHERE phone LIKE '0912777%')`,
    );
    await queryAsAdmin(
      `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE phone LIKE '0912777%')`,
    );
    await queryAsAdmin(`DELETE FROM invite_tokens WHERE tenant_id = $1`, [TENANT_ID]);
    await queryAsAdmin(`DELETE FROM users WHERE phone LIKE '0912777%'`);
    await queryAsAdmin(`DELETE FROM tenants WHERE id = $1`, [TENANT_ID]);
  });

  beforeEach(() => {
    // Clears the call log only — the closures over `issued` stay, so the double
    // keeps behaving like a store across tests.
    jest.clearAllMocks();
  });

  const call = (path: string, init: RequestInit = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });

  const sendOtp = (phone: string, purpose?: 'login' | 'invite') =>
    call('/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify(purpose ? { phoneNumber: phone, purpose } : { phoneNumber: phone }),
    });

  const acceptInvite = (token: string, phone: string, otpCode: string) =>
    call('/auth/invite/accept', {
      method: 'POST',
      body: JSON.stringify({ token, phone, otpCode }),
    });


  it('forwards purpose=invite to the OTP layer (regression: send used to hardcode login)', async () => {
    const phone = nextPhone();

    const response = await sendOtp(phone, 'invite');

    expect(response.status).toBe(200);
    // The whole point of the `purpose` field: the controller must pass it
    // through. Before the fix this was always 'login', so the code an invite
    // screen requested could never be spent on the accept endpoint.
    expect(fakeOtp.sendOtp).toHaveBeenCalledWith(phone, 'invite');
  });

  it('accepts an invite over HTTP with an ASCII OTP code and creates the staff account', async () => {
    const phone = nextPhone();
    const invite = await inviteService.create({ role: 'salon_owner', phone }, ADMIN_ID, TENANT_ID);

    const sent = await sendOtp(phone, 'invite');
    expect(sent.status).toBe(200);

    // Regression: the old otpCode regex rejected every string, so this was a 400.
    const response = await acceptInvite(invite.token, phone, fakeOtp.CODE);
    expect(response.status).toBe(200);

    const body = (await response.json()) as AcceptedInvite;
    expect(body.user.role).toBe('salon_owner');
    expect(body.user.tenantId).toBe(TENANT_ID);
    expect(body.user.phoneNumber).toBe(phone);
    expect(body.user.isNewUser).toBe(true);
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toEqual(expect.any(String));

    // The account really exists inside the invited salon.
    const users = await queryAsAdmin<{ id: string; role: string; tenant_id: string }>(
      `SELECT id, role, tenant_id FROM users WHERE phone = $1`,
      [phone],
    );
    expect(users).toHaveLength(1);
    expect(users[0].role).toBe('salon_owner');
    expect(users[0].tenant_id).toBe(TENANT_ID);

    // …and the invite is spent, pointing at the user it created.
    const stored = await queryAsAdmin<{ used_at: Date | null; used_by: string | null }>(
      `SELECT used_at, used_by FROM invite_tokens WHERE id = $1`,
      [invite.id],
    );
    expect(stored[0].used_at).not.toBeNull();
    expect(stored[0].used_by).toBe(users[0].id);
  });

  it('defaults the OTP purpose to login when the client omits it (backward compatible)', async () => {
    const phone = nextPhone();

    const response = await sendOtp(phone);

    expect(response.status).toBe(200);
    // The field is optional for a reason: every existing caller (both apps, the
    // admin panel) still sends a bare phone and must keep getting a login code.
    expect(fakeOtp.sendOtp).toHaveBeenCalledWith(phone, 'login');
  });

  it('refuses to spend a login-purpose code on an invite accept', async () => {
    const phone = nextPhone();
    const invite = await inviteService.create({ role: 'salon_owner', phone }, ADMIN_ID, TENANT_ID);

    // A *login* code is issued (no purpose). The accept path verifies under the
    // 'invite' purpose, and the two namespaces do not overlap, so a login code
    // is not a credential for opening a salon account — and vice versa.
    const sent = await sendOtp(phone);
    expect(sent.status).toBe(200);

    const response = await acceptInvite(invite.token, phone, fakeOtp.CODE);
    expect(response.status).toBe(401);

    // Nothing was created and the invite is still open for its real owner.
    const users = await queryAsAdmin<{ id: string }>(`SELECT id FROM users WHERE phone = $1`, [phone]);
    expect(users).toHaveLength(0);
    const stored = await queryAsAdmin<{ used_at: Date | null }>(
      `SELECT used_at FROM invite_tokens WHERE id = $1`,
      [invite.id],
    );
    expect(stored[0].used_at).toBeNull();
  });

  it('rejects a replayed invite token with 401 even after a fresh code is issued', async () => {
    const phone = nextPhone();
    const invite = await inviteService.create({ role: 'specialist', phone }, ADMIN_ID, TENANT_ID);

    const first = await acceptInvite(invite.token, phone, fakeOtp.CODE).then((r) => r.status);
    expect(first).toBe(401); // no code issued yet

    await sendOtp(phone, 'invite');
    const accepted = await acceptInvite(invite.token, phone, fakeOtp.CODE);
    expect(accepted.status).toBe(200);

    // A second code is issued for the same number so the replay fails at the
    // *token* stage rather than the OTP stage — this is about the invite being
    // spent, not about the code being single-use.
    await sendOtp(phone, 'invite');
    const replay = await acceptInvite(invite.token, phone, fakeOtp.CODE);

    expect(replay.status).toBe(401);
    const body = (await replay.json()) as { message: string };
    expect(body.message).toContain('قبلاً استفاده شده');
  });

  it('accepts Persian-digit OTP codes through the same HTTP pipe', async () => {
    const phone = nextPhone();
    const invite = await inviteService.create({ role: 'line_manager', phone }, ADMIN_ID, TENANT_ID);

    await sendOtp(phone, 'invite');

    // The regex allows `[0-9۰-۹]` and the OTP layer normalises, so a Persian
    // keypad is not a second-class citizen on this endpoint.
    const response = await acceptInvite(invite.token, phone, '۱۲۳۴۵۶');

    expect(response.status).toBe(200);
    const body = (await response.json()) as AcceptedInvite;
    expect(body.user.role).toBe('line_manager');
    expect(body.user.tenantId).toBe(TENANT_ID);
  });


});

