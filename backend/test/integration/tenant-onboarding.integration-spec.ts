import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SmsService } from '@mirad-work/sms-nestjs';
import { DataSource } from 'typeorm';

import { InviteTokenService } from '../../src/modules/auth/invite-token.service';
import { RefreshTokenService } from '../../src/modules/auth/refresh-token.service';
import { Tenant } from '../../src/modules/tenant/entities/tenant.entity';
import { TenantService } from '../../src/modules/tenant/tenant.service';
import { adminConfig, TEST_DB_NAME } from '../setup/test-db';
import { describeIntegration, queryAsAdmin, withTenant } from '../setup/integration.setup';

/**
 * Unique per run. The `slug` column is `UNIQUE`, so a fixed slug would collide
 * with the row an earlier run left behind; the phone prefix is wiped below for
 * the same reason. This file owns `0912888…`, the invite spec owns `0912999…`.
 */
let slugCounter = 0;
const nextSlug = () => `it-onboarding-${Date.now()}-${++slugCounter}`;

let phoneCounter = 0;
const nextPhone = () => `0912888${(++phoneCounter).toString().padStart(4, '0')}`;

/**
 * The inviter. `invite_tokens.invited_by` is `NOT NULL REFERENCES users(id)` with
 * `ON DELETE CASCADE`, so the admin must be a real row — an admin JWT itself
 * carries no tenant, but the row that issued the invite still has to exist, and
 * deleting it would silently take the tenant's invites with it. Seeded once, with
 * `ON CONFLICT` so repeated runs stay green.
 *
 * Its phone deliberately sits inside this file's `0912888…` range (the seeded
 * value is fixed and known), which is why every cleanup below excludes
 * [ADMIN_USER] by id: a bare `phone LIKE '0912888%'` wipe would delete the FK
 * target mid-suite, and the next invite insert would fail with a raw foreign-key
 * violation instead of the assertion under test.
 */
const PLATFORM_TENANT = '0a000000-0000-4000-8000-000000000001';
const ADMIN_USER = '0a000000-0000-4000-8000-0000000000ad';
const ADMIN_PHONE = '09128880000';

/**
 * The full ADR-010 onboarding flow, end to end on real Postgres.
 *
 * Admin creates a salon (`POST /tenants`), invites its owner (`POST /auth/invite`
 * with `role: 'salon_owner'`), and the owner redeems the invite
 * (`POST /auth/invite/accept`). The individual pieces are unit-tested elsewhere;
 * what this spec proves is that they *compose*: the tenant `create` returns an id
 * the invite can name, the invite binds the owner to that same id, and the
 * resulting salon is a real RLS boundary the new owner sits inside.
 *
 * Runs on the migration-owner connection (`adminConfig`), like the invite and
 * refresh specs: `accept` must resolve a tenant and a role from the presented
 * token hash before any RLS context exists, so the NOBYPASSRLS role would
 * exercise a path production does not have. The isolation assertion at the end
 * deliberately drops to `withTenant`, where the policy *does* apply.
 */
describeIntegration('salon onboarding (ADR-010): create tenant -> invite owner -> accept', () => {
  let dataSource: DataSource;
  let tenantService: TenantService;
  let inviteService: InviteTokenService;

  const configStub = {
    get: <T>(_key: string, fallback: T) => fallback,
  } as unknown as ConfigService;

  beforeAll(async () => {
    // Own connection with the `Tenant` entity attached: the shared DataSource
    // declares `entities: []`, so `TenantService` could not be built from it.
    // Admin credentials, because this spec reproduces the production path where
    // `POST /tenants` writes the registry row before any tenant exists.
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

    const refreshTokenService = new RefreshTokenService(
      dataSource,
      new JwtService({ secret: 'integration-secret' }),
      configStub,
    );
    inviteService = new InviteTokenService(
      dataSource,
      refreshTokenService,
      configStub,
      // MELIPAYAMAK_INVITE_BODY_ID is unset, so `create` logs and skips the SMS.
      { verify: async () => ({ success: false }) } as unknown as SmsService,
    );

    // Previous runs leave invitee users behind and the phone counter restarts
    // each run — clear them first so the unique index on `phone` cannot fail an
    // otherwise valid spec. Onboarding tenants are deleted next, but `users`
    // references `tenants` without a cascade, so the owners must go first.
    await queryAsAdmin(`DELETE FROM users WHERE phone LIKE '0912888%' AND id <> $1`, [ADMIN_USER]);
    await queryAsAdmin(
      `DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'it-onboarding-%')`,
    );
    // Now the tenants themselves; their invites cascade from the tenant row.
    await queryAsAdmin(`DELETE FROM tenants WHERE slug LIKE 'it-onboarding-%'`);

    // The inviter must exist: `invite_tokens.invited_by` is a `NOT NULL` FK.
    await queryAsAdmin(
      `INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [PLATFORM_TENANT, 'Platform Admin (integration)', 'it-platform-admin'],
    );
    await queryAsAdmin(
      `INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (id) DO NOTHING`,
      [ADMIN_USER, PLATFORM_TENANT, ADMIN_PHONE],
    );
  }, 30_000);

  afterAll(async () => {
    // Users first: `users.tenant_id` has no `ON DELETE CASCADE`, so the owner
    // rows the flow created would otherwise block the tenant delete.
    await queryAsAdmin(
      `DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'it-onboarding-%')`,
    );
    await queryAsAdmin(`DELETE FROM tenants WHERE slug LIKE 'it-onboarding-%'`);
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  // See `deleteSpecialistsForPhones`: `accept` reuses a same-phone account, so
  // the fixtures each redemption leaves must go before the next spec's
  // `nextPhone()` value is assumed to be fresh.
  //
  // `id <> ADMIN_USER` is load-bearing: the seeded admin's phone is inside the
  // `0912888…` range, and `invite_tokens.invited_by` cascades from it. Without
  // the exclusion the first spec deletes the inviter and every later invite
  // insert dies on `invite_tokens_invited_by_fkey`.
  afterEach(async () => {
    await deleteSpecialistsForPhones('0912888');
    await queryAsAdmin(`DELETE FROM users WHERE phone LIKE '0912888%' AND id <> $1`, [ADMIN_USER]);
  });

  /**
   * Removes the `specialists` rows a redemption could have left behind.
   *
   * These invites are `salon_owner`, so `accept` writes no specialist row — but
   * `accept` reuses an existing same-phone account, and a row left behind by an
   * earlier run would make the owner-based specs ambiguous. Clearing it in FK
   * order keeps the suite re-runnable, matching the sibling specs.
   */
  async function deleteSpecialistsForPhones(prefix: string): Promise<void> {
    await queryAsAdmin(
      `DELETE FROM specialists WHERE user_id IN (SELECT id FROM users WHERE phone LIKE $1)`,
      [`${prefix}%`],
    );
  }

  /** One admin, one invite, one redemption — the whole happy path. */
  it('walks create tenant -> invite owner -> accept and binds the owner to the new salon', async () => {
    const slug = nextSlug();
    const ownerPhone = nextPhone();

    // Step 1 — the admin creates the salon. It starts unreviewed (`draft`); an
    // admin creating a row is bookkeeping, not approval.
    const tenant = await tenantService.create({ name: 'Onboarding Salon', slug });
    expect(tenant.id).toEqual(expect.any(String));
    expect(tenant.slug).toBe(slug);
    expect(tenant.status).toBe('draft');

    // Step 2 — invite the owner into the salon just created. `admin` has no
    // tenant of their own, so the id from step 1 is exactly what the invite names.
    const invite = await inviteService.create(
      { role: 'salon_owner', phone: ownerPhone },
      // The admin who issued it; `invited_by` is a uuid FK to a real user.
      ADMIN_USER,
      tenant.id,
    );
    expect(invite.tenantId).toBe(tenant.id);
    expect(invite.role).toBe('salon_owner');
    // The plaintext is a sha256 hex digest's preimage — 64 hex chars.
    expect(invite.token).toMatch(/^[0-9a-f]{64}$/);

    // Step 3 — the owner redeems it. This is the public path: an account is
    // created with the invited role *inside the invited tenant*, and a session
    // is issued.
    const accepted = await inviteService.accept(invite.token, ownerPhone);
    expect(accepted.user.role).toBe('salon_owner');
    expect(accepted.user.tenantId).toBe(tenant.id);
    expect(accepted.user.phoneNumber).toBe(ownerPhone);
    expect(accepted.user.isNewUser).toBe(true);
    expect(accepted.accessToken).toEqual(expect.any(String));
    expect(accepted.refreshToken).toEqual(expect.any(String));

    // The account really exists in the new salon…
    const users = await queryAsAdmin<{ id: string; role: string; tenant_id: string }>(
      `SELECT id, role, tenant_id FROM users WHERE phone = $1`,
      [ownerPhone],
    );
    expect(users).toHaveLength(1);
    expect(users[0].role).toBe('salon_owner');
    expect(users[0].tenant_id).toBe(tenant.id);

    // …and the invite is spent, pointing at the user it created.
    const stored = await queryAsAdmin<{ used_at: Date | null; used_by: string | null }>(
      `SELECT used_at, used_by FROM invite_tokens WHERE tenant_id = $1`,
      [tenant.id],
    );
    expect(stored[0].used_at).not.toBeNull();
    expect(stored[0].used_by).toBe(users[0].id);
  });

  it('rejects a duplicate slug with a 409, leaving the first salon untouched', async () => {
    const slug = nextSlug();
    const first = await tenantService.create({ name: 'First Salon', slug });

    // Same slug, different display name: the unique index is the boundary, and
    // the admin gets an actionable conflict rather than a raw driver error.
    await expect(tenantService.create({ name: 'Second Salon', slug })).rejects.toBeInstanceOf(
      ConflictException,
    );

    const remaining = await queryAsAdmin<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tenants WHERE slug = $1`,
      [slug],
    );
    expect(remaining[0].count).toBe('1');
    expect((await tenantService.findById(first.id)).name).toBe('First Salon');
  });

  it('makes the new salon a real RLS boundary for its invites', async () => {
    const salonA = await tenantService.create({ name: 'Boundary A', slug: nextSlug() });
    const salonB = await tenantService.create({ name: 'Boundary B', slug: nextSlug() });

    const inviteA = await inviteService.create(
      { role: 'salon_owner', phone: nextPhone() },
      ADMIN_USER,
      salonA.id,
    );
    const inviteB = await inviteService.create(
      { role: 'salon_owner', phone: nextPhone() },
      ADMIN_USER,
      salonB.id,
    );

    // Seen from inside salon A, only A's invite is visible — `invite_tokens` is
    // FORCE ROW LEVEL SECURITY on `app.current_tenant_id`, and the freshly
    // created salon id is what the policy keys off.
    const seenFromA = await withTenant(salonA.id, (query) =>
      query<Array<{ id: string }>>(`SELECT id FROM invite_tokens`),
    );
    const ids = seenFromA.map((row) => row.id);
    expect(ids).toContain(inviteA.id);
    expect(ids).not.toContain(inviteB.id);

    // A write cannot escape either: the policy hides B's row, so the UPDATE
    // matches nothing. TypeORM answers an UPDATE with `[rows, rowCount]`.
    const updated = await withTenant(salonA.id, (query) =>
      query<[unknown[], number]>(`UPDATE invite_tokens SET used_at = NOW() WHERE id = $1`, [
        inviteB.id,
      ]),
    );
    expect(updated[1]).toBe(0);
  });
});
