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
 * Unique per run. The `phone` column carries a global unique index, so a fixed
 * number would collide with the row an earlier run left behind; the phone
 * prefix is wiped below for the same reason. This file owns `0912887…`, the
 * tenant-onboarding spec owns `0912888…`, the invite spec owns `0912999…`.
 */
let phoneCounter = 0;
const nextPhone = () => `0912887${(++phoneCounter).toString().padStart(4, '0')}`;

let slugCounter = 0;
const nextSlug = () => `it-specialist-${Date.now()}-${++slugCounter}`;

/**
 * The full specialist-onboarding flow (ADR-010), end to end on real Postgres.
 *
 * A salon owner signs in, invites a specialist (`POST /auth/invite` with
 * `role: 'specialist'`), and the specialist redeems the invite with an OTP
 * (`POST /auth/invite/accept`). The individual pieces are unit-tested and
 * covered by the invite spec; what this proves is the *composition* the panel
 * depends on: the invite binds the specialist to the owner's salon (never a
 * body-supplied tenant), the resulting account is a `specialist` inside that
 * salon, and that salon remains an RLS boundary a specialist cannot read
 * through.
 *
 * Runs on the migration-owner connection (`adminConfig`), like the invite and
 * onboarding specs: `accept` must resolve a tenant and a role from the token
 * hash before any RLS context exists, so the NOBYPASSRLS role would exercise a
 * path production does not have. The isolation assertion at the end drops to
 * `withTenant`, where the policy *does* apply.
 */
describeIntegration('specialist onboarding (ADR-010): owner invites -> specialist accepts', () => {
  let dataSource: DataSource;
  let tenantService: TenantService;
  let inviteService: InviteTokenService;

  const configStub = {
    get: <T>(_key: string, fallback: T) => fallback,
  } as unknown as ConfigService;

  beforeAll(async () => {
    // Own connection with the `Tenant` entity attached: the shared DataSource
    // declares `entities: []`, so `TenantService` could not be built from it.
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
      // KAVENEGAR_INVITE_TEMPLATE is unset on the stub, so `create` logs and
      // skips the SMS — no spec ever reaches a provider.
      { verify: async () => ({ success: false }) } as unknown as SmsService,
    );

    // Previous runs leave invitee users behind (there is no tenant to cascade
    // from), and the phone counter restarts, so clear the prefix first. The
    // salons this spec created are removed next; `users` references `tenants`
    // without a cascade, so those users must go first.
    await queryAsAdmin(`DELETE FROM users WHERE phone LIKE '0912887%'`);
    await queryAsAdmin(
      `DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'it-specialist-%')`,
    );
    await queryAsAdmin(`DELETE FROM tenants WHERE slug LIKE 'it-specialist-%'`);
  });

  afterAll(async () => {
    await queryAsAdmin(`DELETE FROM users WHERE phone LIKE '0912887%'`);
    await queryAsAdmin(
      `DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'it-specialist-%')`,
    );
    // Invites cascade from the tenant row (`invite_tokens.tenant_id` FK).
    await queryAsAdmin(`DELETE FROM tenants WHERE slug LIKE 'it-specialist-%'`);
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  /** Seeds a fresh `salon_owner` for a salon and returns its id (the inviter). */
  async function seedInviter(tenantId: string, phone: string): Promise<string> {
    const rows = await queryAsAdmin<{ id: string }>(
      `INSERT INTO users (tenant_id, phone, role) VALUES ($1, $2, 'salon_owner') RETURNING id`,
      [tenantId, phone],
    );
    return rows[0].id;
  }

  it('binds the invited specialist to the owner salon with the invited role', async () => {
    // Step 1 — an admin (or the platform) created the salon; here we just need
    // the registry row, which is what the owner's JWT tenant would point at.
    const salon = await tenantService.create({ name: 'Specialist Salon', slug: nextSlug() });

    // A real owner row: `invite_tokens.invited_by` is `NOT NULL REFERENCES
    // users(id)`, so the issuing account must exist even though the tenant on
    // the invite is taken from the controller's JWT, not from this row.
    const ownerPhone = nextPhone();
    const owner = await queryAsAdmin<{ id: string }>(
      `INSERT INTO users (tenant_id, phone, role) VALUES ($1, $2, 'salon_owner') RETURNING id`,
      [salon.id, ownerPhone],
    );

    // Step 2 — the owner invites a specialist. `phone` is the *target*; the
    // specialist still has to prove it with an OTP before the account exists.
    const specialistPhone = nextPhone();
    const invite = await inviteService.create(
      { role: 'specialist', phone: specialistPhone },
      owner[0].id,
      salon.id,
    );
    expect(invite.role).toBe('specialist');
    expect(invite.tenantId).toBe(salon.id);
    expect(invite.token).toMatch(/^[0-9a-f]{64}$/);

    // The row is stored under the owner's salon and unspent.
    const pending = await queryAsAdmin<{ tenant_id: string; used_at: Date | null }>(
      `SELECT tenant_id, used_at FROM invite_tokens WHERE token_hash = $1`,
      [InviteTokenService.hashToken(invite.token)],
    );
    expect(pending[0].tenant_id).toBe(salon.id);
    expect(pending[0].used_at).toBeNull();

    // Step 3 — the specialist redeems it. `accept` runs once the OTP has proven
    // the phone; the service takes the proven phone, so passing it here stands
    // in for that step.
    const accepted = await inviteService.accept(invite.token, specialistPhone);
    expect(accepted.user.role).toBe('specialist');
    expect(accepted.user.tenantId).toBe(salon.id);
    expect(accepted.user.phoneNumber).toBe(specialistPhone);
    expect(accepted.user.isNewUser).toBe(true);
    expect(accepted.accessToken).toEqual(expect.any(String));
    expect(accepted.refreshToken).toEqual(expect.any(String));

    // The account really is a specialist inside the owner's salon…
    const users = await queryAsAdmin<{ id: string; role: string; tenant_id: string }>(
      `SELECT id, role, tenant_id FROM users WHERE phone = $1`,
      [specialistPhone],
    );
    expect(users).toHaveLength(1);
    expect(users[0].role).toBe('specialist');
    expect(users[0].tenant_id).toBe(salon.id);

    // …and the invite is spent, pointing at the user it created.
    const spent = await queryAsAdmin<{ used_at: Date | null; used_by: string | null }>(
      `SELECT used_at, used_by FROM invite_tokens WHERE token_hash = $1`,
      [InviteTokenService.hashToken(invite.token)],
    );
    expect(spent[0].used_at).not.toBeNull();
    expect(spent[0].used_by).toBe(users[0].id);
  });

  it('never grants a tenant from the invite body — the salon comes from the issuer', async () => {
    const salonA = await tenantService.create({ name: 'Salon A', slug: nextSlug() });
    const salonB = await tenantService.create({ name: 'Salon B', slug: nextSlug() });

    // The invite is issued for salon B explicitly (the service is tenant-
    // explicit); a specialist invited into B must land in B, never A.
    const specialistPhone = nextPhone();
    const inviteB = await inviteService.create(
      { role: 'specialist', phone: specialistPhone },
      await seedInviter(salonB.id, nextPhone()),
      salonB.id,
    );

    const accepted = await inviteService.accept(inviteB.token, specialistPhone);
    expect(accepted.user.tenantId).toBe(salonB.id);

    const users = await queryAsAdmin<{ tenant_id: string }>(
      `SELECT tenant_id FROM users WHERE phone = $1`,
      [specialistPhone],
    );
    expect(users[0].tenant_id).toBe(salonB.id);
    expect(users[0].tenant_id).not.toBe(salonA.id);
  });

  it('keeps a specialist scoped to their own salon through RLS', async () => {
    const salonA = await tenantService.create({ name: 'Scope A', slug: nextSlug() });
    const salonB = await tenantService.create({ name: 'Scope B', slug: nextSlug() });

    const inA = await inviteService.create(
      { role: 'specialist', phone: nextPhone() },
      await seedInviter(salonA.id, nextPhone()),
      salonA.id,
    );
    const inB = await inviteService.create(
      { role: 'specialist', phone: nextPhone() },
      await seedInviter(salonB.id, nextPhone()),
      salonB.id,
    );

    // Seen from inside salon A, only A's invite is visible — `invite_tokens` is
    // FORCE ROW LEVEL SECURITY on `app.current_tenant_id`, and the salon id the
    // specialist belongs to is what the policy keys off.
    const seenFromA = await withTenant(salonA.id, (query) =>
      query<Array<{ id: string }>>(`SELECT id FROM invite_tokens`),
    );
    const ids = seenFromA.map((row) => row.id);
    expect(ids).toContain(inA.id);
    expect(ids).not.toContain(inB.id);

    // A write cannot escape either: the policy hides B's row, so the UPDATE
    // matches nothing. TypeORM answers an UPDATE with `[rows, rowCount]`.
    const updated = await withTenant(salonA.id, (query) =>
      query<[unknown[], number]>(`UPDATE invite_tokens SET used_at = NOW() WHERE id = $1`, [
        inB.id,
      ]),
    );
    expect(updated[1]).toBe(0);
  });
});
