import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { SmsService } from '@mirad-work/sms-nestjs';
import { DataSource } from 'typeorm';

import { AuthService } from '../../src/modules/auth/auth.service';
import type { AuthenticatedUser } from '../../src/modules/auth/guards/jwt-auth.guard';
import { InviteTokenService } from '../../src/modules/auth/invite-token.service';
import { OtpService } from '../../src/modules/auth/otp.service';
import { RefreshTokenService } from '../../src/modules/auth/refresh-token.service';
import { UpdateSpecialistPanelDto } from '../../src/modules/salon/dto/specialist-panel.dto';
import { UpdateSalonProfileDto } from '../../src/modules/salon/dto/update-salon-profile.dto';
import { SalonService } from '../../src/modules/salon/salon.service';
import { Tenant } from '../../src/modules/tenant/entities/tenant.entity';
import { TenantService } from '../../src/modules/tenant/tenant.service';
import { adminConfig, TEST_DB_NAME } from '../setup/test-db';
import { describeIntegration, queryAsAdmin } from '../setup/integration.setup';

/**
 * Profile completion (onboarding UI follow-up), end to end on real Postgres.
 *
 * The salon app routes a signed-in owner or specialist into a setup screen
 * while `profileCompleted` is false. That flag is written by three different
 * doors — `PATCH /salon/me`, `PATCH /salon/me/specialists/:id`, and the
 * `GET /auth/me` read the router consults — and the point of this spec is that
 * they agree:
 *
 *  1. a freshly created salon starts profile-incomplete;
 *  2. an owner submits the salon form -> the tenant row flips, decided through
 *     the real `SalonService.updateStaffProfile` (the same call the controller
 *     makes), so the assertion cannot drift from the service;
 *  3. a specialist submits their form -> their `specialists` row flips, again
 *     through the real `SalonService.updatePanelSpecialist`;
 *  4. `GET /auth/me` (real `AuthService.currentUser`) reports it, since that is
 *     the response the router actually reads.
 *
 * Runs on the migration-owner connection (`adminConfig`), the role the
 * application itself connects as: `currentUser` reads `users`, which is FORCE
 * ROW LEVEL SECURITY, and the production app resolves it on this connection.
 * Slugs/phones are namespaced and wiped first so a re-run starts clean.
 */
describeIntegration('profile completion (GET /auth/me, PATCH /salon/me)', () => {
  let dataSource: DataSource;
  let tenantService: TenantService;
  let salonService: SalonService;
  let authService: AuthService;
  let inviteService: InviteTokenService;

  let slugCounter = 0;
  const nextSlug = () => `it-profile-${Date.now()}-${++slugCounter}`;

  /** Owns `0912889…`; the other onboarding specs own `0912887…`/`0912888…`. */
  let phoneCounter = 0;
  const nextPhone = () => `0912889${(++phoneCounter).toString().padStart(4, '0')}`;

  const configStub = {
    get: <T>(_key: string, fallback: T) => fallback,
  } as unknown as ConfigService;

  beforeAll(async () => {
    // Own connection with the `Tenant` entity attached, so `TenantService` can
    // be built — the shared DataSource declares `entities: []`.
    dataSource = new DataSource({
      type: 'postgres',
      host: String(adminConfig.host),
      port: Number(adminConfig.port),
      username: String(adminConfig.user),
      password: String(adminConfig.password),
      database: TEST_DB_NAME,
      entities: [Tenant],
      synchronize: false,
    });
    await dataSource.initialize();

    tenantService = new TenantService(dataSource.getRepository(Tenant));
    salonService = new SalonService(dataSource, new EventEmitter2());

    const refreshTokenService = new RefreshTokenService(
      dataSource,
      new JwtService({ secret: 'integration-secret' }),
      configStub,
    );
    inviteService = new InviteTokenService(
      dataSource,
      refreshTokenService,
      configStub,
      // MELIPAYAMAK_INVITE_BODY_ID is unset on the stub, so `create` logs and
      // skips the SMS — no spec ever reaches a provider.
      { verify: async () => ({ success: false }) } as unknown as SmsService,
    );
    authService = new AuthService(
      // The OTP sender is never reached: `currentUser` does not verify a code.
      { sendOtp: jest.fn(), verifyOtp: jest.fn() } as unknown as OtpService,
      new JwtService({ secret: 'integration-secret' }),
      dataSource,
      refreshTokenService,
      inviteService,
    );

    await clearFixtures();
  }, 30_000);

  afterAll(async () => {
    await clearFixtures();
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  /**
   * `specialists` first (it references both other tables), then users, then
   * tenants — the column foreign keys carry no cascade, so that is the only
   * order that deletes cleanly.
   */
  async function clearFixtures(): Promise<void> {
    await queryAsAdmin(
      `DELETE FROM specialists WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'it-profile-%')`,
    );
    await queryAsAdmin(
      `DELETE FROM specialists WHERE user_id IN (SELECT id FROM users WHERE phone LIKE '0912889%')`,
    );
    await queryAsAdmin(`DELETE FROM users WHERE phone LIKE '0912889%'`);
    await queryAsAdmin(
      `DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'it-profile-%')`,
    );
    await queryAsAdmin(`DELETE FROM tenants WHERE slug LIKE 'it-profile-%'`);
  }

  /** A `salon_owner` row inside [tenantId]; a live owner is always a real row. */
  async function seedOwner(tenantId: string, phone: string): Promise<string> {
    const rows = await queryAsAdmin<{ id: string }>(
      `INSERT INTO users (tenant_id, phone, role, full_name)
       VALUES ($1, $2, 'salon_owner', $3) RETURNING id`,
      [tenantId, phone, 'مالک تست'],
    );
    return rows[0].id;
  }

  /** The identity `JwtAuthGuard` would attach from a real access token. */
  const asUser = (
    id: string,
    role: AuthenticatedUser['role'],
    tenantId: string | null,
    phone: string,
  ): AuthenticatedUser => ({ userId: id, role, tenantId, phoneNumber: phone });

  it('starts a freshly created salon as profile-incomplete', async () => {
    // The migration's default: an unreviewed salon has never had its profile
    // form submitted, and that `false` is exactly what routes its owner into
    // the setup screen rather than the dashboard.
    const salon = await tenantService.create({ name: 'Fresh Salon', slug: nextSlug() });
    const ownerPhone = nextPhone();
    const owner = await seedOwner(salon.id, ownerPhone);

    const before = await queryAsAdmin<{ profile_completed: boolean }>(
      `SELECT profile_completed FROM tenants WHERE id = $1`,
      [salon.id],
    );
    expect(before[0].profile_completed).toBe(false);

    const me = await authService.currentUser(asUser(owner, 'salon_owner', salon.id, ownerPhone));
    expect(me.profileCompleted).toBe(false);
    expect(me.role).toBe('salon_owner');
    expect(me.tenantId).toBe(salon.id);
  });

  it('PATCH /salon/me flips the owner profile flag and GET /auth/me reports it', async () => {
    const salon = await tenantService.create({ name: 'Owner Setup Salon', slug: nextSlug() });
    const ownerPhone = nextPhone();
    const owner = await seedOwner(salon.id, ownerPhone);
    const ownerUser = asUser(owner, 'salon_owner', salon.id, ownerPhone);

    // Step 1 — the owner submits the setup form. This is the controller's own
    // call, so the assertion exercises the production path rather than a
    // re-implementation of it.
    const result = await salonService.updateStaffProfile(ownerUser, {
      name: 'سالن آماده',
      address: 'تهران، خیابان آزادی',
      phone: '09120000000',
      workingHours: { saturday: { active: true, start: '09:00', end: '21:00' } },
    } as UpdateSalonProfileDto);
    expect(result.status).toBe('pending_approval');

    const tenantRow = await queryAsAdmin<{
      profile_completed: boolean;
      pending_changes: Record<string, unknown> | null;
      name: string;
    }>(
      `SELECT profile_completed, pending_changes, name FROM tenants WHERE id = $1`,
      [salon.id],
    );
    // The gated fields are only *staged* (that is the approval workflow)…
    expect(tenantRow[0].pending_changes).not.toBeNull();
    expect(tenantRow[0].pending_changes).toMatchObject({ name: 'سالن آماده' });
    // …but the onboarding flag is live: it records that the form was submitted,
    // not that an admin published the values, so the app stops sending the
    // owner back to the setup screen while review is pending.
    expect(tenantRow[0].profile_completed).toBe(true);
    // The live name is untouched: nothing is public before approval.
    expect(tenantRow[0].name).toBe('Owner Setup Salon');

    // Step 2 — the app asks who it is talking to and gets the flag.
    const me = await authService.currentUser(ownerUser);
    expect(me.profileCompleted).toBe(true);
    expect(me.fullName).toBe('مالک تست');
    expect(me.phoneNumber).toBe(ownerPhone);
  });

  it('PATCH /salon/me/specialists/:id flips the specialist flag and GET /auth/me reports it', async () => {
    const salon = await tenantService.create({ name: 'Specialist Setup Salon', slug: nextSlug() });
    const ownerPhone = nextPhone();
    const owner = await seedOwner(salon.id, ownerPhone);

    // Bring a specialist in the way the panel does: invite + accept, so the
    // auto-created row (ADR-010) is the one the setup form later completes.
    const specialistPhone = nextPhone();
    const invite = await inviteService.create(
      { role: 'specialist', phone: specialistPhone },
      owner,
      salon.id,
    );
    const accepted = await inviteService.accept(invite.token, specialistPhone);
    const specialistUser = asUser(accepted.user.id, 'specialist', salon.id, specialistPhone);

    // The invite leaves the profile empty, which is what routes the specialist
    // into `SpecialistProfileSetupScreen` on first sign-in.
    const created = await queryAsAdmin<{ id: string; profile_completed: boolean }>(
      `SELECT id, profile_completed FROM specialists WHERE user_id = $1`,
      [accepted.user.id],
    );
    expect(created).toHaveLength(1);
    expect(created[0].profile_completed).toBe(false);
    const specialistRowId = created[0].id;

    const before = await authService.currentUser(specialistUser);
    expect(before.profileCompleted).toBe(false);

    // Step 1 — the specialist submits bio, skills and their stated hours. The
    // specialist role is the one the router gates on, so it is the case tested.
    const result = await salonService.updatePanelSpecialist(specialistUser, specialistRowId, {
      bio: 'متخصص رنگ و مش',
      skills: ['رنگ', 'مش', 'کوتاهی'],
      workingHours: { saturday: { active: true, start: '10:00', end: '18:00' } },
    } as UpdateSpecialistPanelDto);
    expect(result.status).toBe('approved');

    const updated = await queryAsAdmin<{
      profile_completed: boolean;
      bio: string | null;
      skills: string[];
      working_hours: Record<string, unknown> | null;
    }>(
      `SELECT profile_completed, bio, skills, working_hours FROM specialists WHERE id = $1`,
      [specialistRowId],
    );
    expect(updated[0].profile_completed).toBe(true);
    expect(updated[0].bio).toBe('متخصص رنگ و مش');
    expect(updated[0].skills).toEqual(['رنگ', 'مش', 'کوتاهی']);
    // The stated hours are stored for the profile; the booking engine still
    // reads the salon's hours, so this column is informational today.
    expect(updated[0].working_hours).toMatchObject({
      saturday: { active: true, start: '10:00', end: '18:00' },
    });

    // Step 2 — the router's own read agrees, and it is the specialist's row
    // that decided it (the tenant flag is irrelevant to this role).
    const me = await authService.currentUser(specialistUser);
    expect(me.profileCompleted).toBe(true);
    expect(me.role).toBe('specialist');
    expect(me.tenantId).toBe(salon.id);
  });
});
