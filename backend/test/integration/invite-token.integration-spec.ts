import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from '@mirad-work/sms-nestjs';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';

import { InviteTokenService } from '../../src/modules/auth/invite-token.service';
import { RefreshTokenService } from '../../src/modules/auth/refresh-token.service';
import {
  describeIntegration,
  getAdminDataSource,
  queryAsAdmin,
  withTenant,
} from '../setup/integration.setup';

const TENANT_A = '55555555-5555-5555-8555-555555555555';
const TENANT_B = '66666666-6666-6666-8666-666666666666';
const OWNER = '55555555-5555-5555-8555-5555555555a1';
const MANAGER = '55555555-5555-5555-8555-5555555555b1';

interface InviteRow {
  [key: string]: unknown;
  id: string;
  role: string;
  tenant_id: string;
  phone: string | null;
  token_hash: string;
  invited_by: string;
  used_at: Date | null;
  used_by: string | null;
}

/**
 * Unique invitee phone per call, so specs never collide within a run.
 *
 * The `0912999` prefix is reserved for this file: `beforeAll` wipes any user
 * carrying it, because the counter restarts at 1 every run and would otherwise
 * hit `idx_users_phone_unique` against rows an earlier run left behind. The
 * refresh spec owns `0912000…`, so the two never overlap even in parallel.
 */
let phoneCounter = 0;
const nextPhone = () => `0912999${(++phoneCounter).toString().padStart(4, '0')}`;

/**
 * Invite tokens against a real database (ADR-010).
 *
 * Runs on the migration-owner connection, like the refresh spec: `accept` has to
 * resolve a tenant and a role from the presented token hash before any RLS
 * context exists, so testing it through the NOBYPASSRLS role would exercise a
 * path production does not have. The last two specs are the exception — they use
 * `withTenant` precisely because they must not bypass the policy.
 */
describeIntegration('invite tokens', () => {
  // Memoised rather than built in `beforeAll`: the DataSources do not exist yet
  // while jest is still collecting this file, and `??=` keeps the binding
  // genuinely reassigned.
  let cached: InviteTokenService | undefined;
  const getService = (): InviteTokenService => {
    cached ??= (() => {
      const refreshTokenService = new RefreshTokenService(
        getAdminDataSource(),
        new JwtService({ secret: 'integration-secret' }),
        // Minimal stand-in: the TTL and expiry keys fall back to service defaults.
        { get: <T>(_key: string, fallback: T) => fallback } as unknown as ConfigService,
      );
      return new InviteTokenService(
        getAdminDataSource(),
        refreshTokenService,
        { get: <T>(_key: string, fallback: T) => fallback } as unknown as ConfigService,
        // MELIPAYAMAK_INVITE_BODY_ID is unset here, so `create` logs and skips the
        // SMS — no test ever reaches a provider.
        { verify: async () => ({ success: false }) } as unknown as SmsService,
      );
    })();
    return cached;
  };

  /** Seeds a tenant and an inviter; both are prerequisites for an invite row. */
  const seedParty = async (tenantId: string, userId: string, role: string) => {
    await queryAsAdmin(
      `INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [tenantId, `t-${tenantId.slice(0, 8)}`],
    );
    await queryAsAdmin(
      `INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [userId, tenantId, `0911000${userId.slice(-4)}`, role],
    );
  };

  /**
   * Rows the redemption of a `specialist` invite leaves behind.
   *
   * `accept` now auto-creates the `specialists` row (ADR-010 follow-up), so the
   * spec files that redeem specialist invites have to clear it — but this file
   * deliberately owns no cleanup of its own: its invites target ephemeral
   * `0912999…` phones and are dealt with in `beforeAll`. The helper exists so
   * the other specs do not have to grow their own copy of the FK order.
   */
  const deleteSpecialistsFor = (phone: string) =>
    queryAsAdmin(
      `DELETE FROM specialists WHERE user_id IN (SELECT id FROM users WHERE phone LIKE $1)`,
      [`${phone}%`],
    );

  const rows = (tenantId = TENANT_A) =>
    queryAsAdmin<InviteRow>(
      `SELECT id, role, tenant_id, phone, token_hash, invited_by, used_at, used_by
       FROM invite_tokens WHERE tenant_id = $1 ORDER BY created_at`,
      [tenantId],
    );

  beforeAll(async () => {
    // Previous runs leave invitee users behind (there is no tenant to cascade
    // from), and the phone counter restarts each run — clear them first so the
    // unique index on `phone` cannot fail an otherwise valid spec. A redeemed
    // `specialist` invite also leaves a `specialists` row, and that row
    // references the user, so it must go first or the user delete is refused.
    await deleteSpecialistsFor('0912999%');
    await queryAsAdmin(`DELETE FROM users WHERE phone LIKE '0912999%'`);
    await seedParty(TENANT_A, OWNER, 'salon_owner');
    await seedParty(TENANT_A, MANAGER, 'line_manager');
    await seedParty(TENANT_B, OWNER, 'salon_owner');
  });

  // The specs below redeem real invites, and `accept` reuses an existing
  // same-phone account rather than creating a second one. The fixtures those
  // redemptions leave behind (a user and, for a specialist, a `specialists`
  // row) are therefore keyed by the phone and removed here, in FK order — the
  // alternative is a suite that only passes on the first run.
  afterEach(async () => {
    await deleteSpecialistsFor('0912999%');
    await queryAsAdmin(`DELETE FROM users WHERE phone LIKE '0912999%'`);
  });

  beforeEach(async () => {
    await queryAsAdmin(`DELETE FROM invite_tokens`);
  });

  it('stores only the hash, and returns the plaintext exactly once', async () => {
    const phone = nextPhone();
    const issued = await getService().create({ role: 'specialist', phone }, OWNER, TENANT_A);

    expect(issued.token).toMatch(/^[0-9a-f]{64}$/);
    expect(issued.role).toBe('specialist');

    const stored = await rows();
    expect(stored).toHaveLength(1);
    expect(stored[0].token_hash).toBe(createHash('sha256').update(issued.token).digest('hex'));
    // The plaintext must not be recoverable from the row.
    expect(JSON.stringify(stored[0])).not.toContain(issued.token);
    expect(stored[0].used_at).toBeNull();
    // Default is seven days out.
    const days = (new Date(issued.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it('binds the new user to the invite role inside the inviter tenant', async () => {
    const phone = nextPhone();
    const issued = await getService().create({ role: 'line_manager', phone }, OWNER, TENANT_A);

    const accepted = await getService().accept(issued.token, phone);

    expect(accepted.user.role).toBe('line_manager');
    expect(accepted.user.tenantId).toBe(TENANT_A);
    expect(accepted.user.phoneNumber).toBe(phone);
    expect(accepted.user.isNewUser).toBe(true);
    // A real session, not a bare id.
    expect(accepted.accessToken).toEqual(expect.any(String));
    expect(accepted.refreshToken).toEqual(expect.any(String));
    expect(accepted.refreshExpiresAt).toBeInstanceOf(Date);

    const users = await queryAsAdmin<{ id: string; role: string; tenant_id: string }>(
      `SELECT id, role, tenant_id FROM users WHERE phone = $1`,
      [phone],
    );
    expect(users[0].role).toBe('line_manager');
    expect(users[0].tenant_id).toBe(TENANT_A);

    // and the invite is now spent, pointing at the user it created
    const stored = await rows();
    expect(stored[0].used_at).not.toBeNull();
    expect(stored[0].used_by).toBe(users[0].id);
  });

  it('grants salon_owner with the inviter tenant, not a body-supplied one', async () => {
    const phone = nextPhone();
    const issued = await getService().create({ role: 'salon_owner', phone }, OWNER, TENANT_A);

    const accepted = await getService().accept(issued.token, phone);

    expect(accepted.user.role).toBe('salon_owner');
    expect(accepted.user.tenantId).toBe(TENANT_A);

    const users = await queryAsAdmin<{ tenant_id: string }>(
      `SELECT tenant_id FROM users WHERE phone = $1`,
      [phone],
    );
    expect(users[0].tenant_id).toBe(TENANT_A);
  });

  it('rejects an expired token', async () => {
    const phone = nextPhone();
    const issued = await getService().create({ role: 'specialist', phone }, OWNER, TENANT_A);
    // Rewind rather than wait seven days.
    await queryAsAdmin(
      `UPDATE invite_tokens SET expires_at = NOW() - INTERVAL '1 minute' WHERE token_hash = $1`,
      [InviteTokenService.hashToken(issued.token)],
    );

    await expect(getService().accept(issued.token, phone)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    // Nothing may be created on a failed redemption.
    const users = await queryAsAdmin(`SELECT id FROM users WHERE phone = $1`, [phone]);
    expect(users).toHaveLength(0);
  });

  it('rejects a replayed token', async () => {
    const phone = nextPhone();
    const issued = await getService().create({ role: 'specialist', phone }, OWNER, TENANT_A);

    await getService().accept(issued.token, phone);

    // The second attempt must be refused even though the phone is still valid:
    // one token, one account.
    await expect(getService().accept(issued.token, phone)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an unknown token', async () => {
    await expect(getService().accept('f'.repeat(64), nextPhone())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuses to repurpose an existing customer account', async () => {
    const phone = nextPhone();
    // Someone who already signed in through the customer path.
    await queryAsAdmin(`INSERT INTO users (tenant_id, phone, role) VALUES (NULL, $1, 'customer')`, [
      phone,
    ]);

    const issued = await getService().create({ role: 'salon_owner', phone }, OWNER, TENANT_A);
    await expect(getService().accept(issued.token, phone)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    // The customer is untouched — no silent promotion.
    const users = await queryAsAdmin<{ role: string }>(
      `SELECT role FROM users WHERE phone = $1`,
      [phone],
    );
    expect(users[0].role).toBe('customer');
  });

  it('lists only pending invites for the tenant', async () => {
    const usedPhone = nextPhone();
    const pendingPhone = nextPhone();
    const expiredPhone = nextPhone();

    const used = await getService().create({ role: 'specialist', phone: usedPhone }, OWNER, TENANT_A);
    await getService().create({ role: 'line_manager', phone: pendingPhone }, MANAGER, TENANT_A);
    const expired = await getService().create({ role: 'specialist', phone: expiredPhone }, OWNER, TENANT_A);
    await getService().accept(used.token, usedPhone);
    await queryAsAdmin(
      `UPDATE invite_tokens SET expires_at = NOW() - INTERVAL '1 day' WHERE token_hash = $1`,
      [InviteTokenService.hashToken(expired.token)],
    );

    const list = await getService().listByTenant(TENANT_A);
    // The redeemed and the expired one are both gone; the open one remains.
    expect(list).toHaveLength(1);
    expect(list[0].phone).toBe(pendingPhone);
    expect(list[0].role).toBe('line_manager');
    expect(list[0].invitedBy).toBe(MANAGER);
  });

  it('lets the inviter revoke, and refuses everyone else', async () => {
    const a = await getService().create({ role: 'specialist', phone: nextPhone() }, MANAGER, TENANT_A);
    const b = await getService().create({ role: 'specialist', phone: nextPhone() }, MANAGER, TENANT_A);
    // A real UUID: `invited_by` is typed `uuid`, so a made-up string would be
    // rejected by Postgres before the authorisation check ever ran.
    const ADMIN = '55555555-5555-5555-8555-5555555555a9';

    // A different manager did not issue it.
    expect(await getService().revoke(a.id, TENANT_A, OWNER, false)).toBe(false);
    // The issuing manager can.
    expect(await getService().revoke(a.id, TENANT_A, MANAGER, false)).toBe(true);
    // An admin override can.
    expect(await getService().revoke(b.id, TENANT_A, ADMIN, true)).toBe(true);
    // Revoking twice is a no-op, not a second success.
    expect(await getService().revoke(b.id, TENANT_A, ADMIN, true)).toBe(false);
  });

  it('does not let a revoked token be redeemed', async () => {
    const phone = nextPhone();
    const issued = await getService().create({ role: 'specialist', phone }, OWNER, TENANT_A);
    await getService().revoke(issued.id, TENANT_A, OWNER, false);

    await expect(getService().accept(issued.token, phone)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('isolates tenants: salon A cannot see salon B invites', async () => {
    const inA = await getService().create({ role: 'specialist', phone: nextPhone() }, OWNER, TENANT_A);
    const inB = await getService().create({ role: 'specialist', phone: nextPhone() }, OWNER, TENANT_B);

    const seenFromA = await withTenant(TENANT_A, (query) =>
      query<Array<{ id: string }>>(`SELECT id FROM invite_tokens`),
    );
    const ids = seenFromA.map((r) => r.id);
    expect(ids).toContain(inA.id);
    expect(ids).not.toContain(inB.id);

    // And a write cannot escape the tenant either: the policy hides B's row, so
    // the UPDATE matches nothing. TypeORM answers an UPDATE with
    // `[rows, rowCount]`, so assert on the affected count, not the array length.
    const updated = await withTenant(TENANT_A, (query) =>
      query<[unknown[], number]>(
        `UPDATE invite_tokens SET used_at = NOW() WHERE id = $1`,
        [inB.id],
      ),
    );
    expect(updated[1]).toBe(0);
  });

  it('exposes a tenant-isolation policy', async () => {
    const policies = await queryAsAdmin<{ policyname: string }>(
      `SELECT policyname FROM pg_policies WHERE tablename = 'invite_tokens'`,
    );
    expect(policies.map((p) => p.policyname)).toContain('invite_tokens_tenant_isolation');
  });

  it('sees every tenant through the owner connection (production uses the app role)', async () => {
    // Documents the service's contract: `create`/`listByTenant`/`revoke` are
    // written tenant-explicit (`WHERE tenant_id = $1`), so even on a
    // BYPASSRLS owner connection they only ever touch the caller's salon.
    // Reads/writes that rely on the policy alone are covered by the RLS specs
    // above through `withTenant`.
    const inA = await getService().create({ role: 'specialist', phone: nextPhone() }, OWNER, TENANT_A);
    const inB = await getService().create({ role: 'specialist', phone: nextPhone() }, OWNER, TENANT_B);

    const seenA = await getService().listByTenant(TENANT_A);
    const seenB = await getService().listByTenant(TENANT_B);
    expect(seenA.map((i) => i.id)).toEqual([inA.id]);
    expect(seenB.map((i) => i.id)).toEqual([inB.id]);

    // ...and revoking across tenants stays a miss, even for an admin override.
    const ADMIN = '55555555-5555-5555-8555-5555555555a9';
    expect(await getService().revoke(inB.id, TENANT_A, ADMIN, true)).toBe(false);
  });

  // The SMS half of `create`. `getService()` deliberately leaves the template
  // unset so nothing reaches a provider, so these specs build their own service
  // with a map-backed ConfigService and a recording SmsService to see the
  // bodyId and link `resolveInviteTemplate` actually hands Melipayamak.
  describe('invite SMS template resolution', () => {
    /** Builds a service whose `verify` calls are captured into `sent`. */
    const serviceWith = (
      env: Record<string, string>,
    ): {
      service: InviteTokenService;
      sent: Array<{ to: string; template: string; token: string }>;
    } => {
      const sent: Array<{ to: string; template: string; token: string }> = [];
      const service = new InviteTokenService(
        getAdminDataSource(),
        new RefreshTokenService(
          getAdminDataSource(),
          new JwtService({ secret: 'integration-secret' }),
          { get: <T>(_key: string, fallback: T) => fallback } as unknown as ConfigService,
        ),
        { get: <T>(key: string, fallback: T): T => (key in env ? (env[key] as unknown as T) : fallback) } as unknown as ConfigService,
        {
          verify: async (message: { to: string; template: string; tokens: Record<string, string> }) => {
            sent.push({ to: message.to, template: message.template, token: String(message.tokens.token) });
            return { success: true } as never;
          },
        } as unknown as SmsService,
      );
      return { service, sent };
    };

    it('falls back to the generic template for every role when no override is set', async () => {
      const { service, sent } = serviceWith({
        MELIPAYAMAK_INVITE_BODY_ID: '1001',
        INVITE_BASE_URL: 'https://staging.boya.ir',
      });

      for (const role of ['salon_owner', 'line_manager', 'specialist'] as const) {
        sent.length = 0;
        const phone = nextPhone();
        const issued = await service.create({ role, phone }, OWNER, TENANT_A);
        expect(sent).toHaveLength(1);
        expect(sent[0].template).toBe('1001');
        // INVITE_BASE_URL shapes the link; without it the SMS carries only the
        // bare hex token, which nothing can open.
        expect(sent[0].token).toBe(`https://staging.boya.ir?token=${issued.token}`);
      }
    });

    it('prefers the per-role template, and falls back when the override is blank', async () => {
      const { service, sent } = serviceWith({
        MELIPAYAMAK_INVITE_BODY_ID: '1001',
        // Set for owner, deliberately blank for specialist: blank means "no
        // opinion", so specialist still resolves to the generic pattern.
        MELIPAYAMAK_INVITE_OWNER_BODY_ID: '1002',
        MELIPAYAMAK_INVITE_SPECIALIST_BODY_ID: '',
      });

      const ownerPhone = nextPhone();
      await service.create({ role: 'salon_owner', phone: ownerPhone }, OWNER, TENANT_A);
      expect(sent[0].template).toBe('1002');

      const specialistPhone = nextPhone();
      await service.create({ role: 'specialist', phone: specialistPhone }, OWNER, TENANT_A);
      expect(sent[1].template).toBe('1001');
    });

    it('skips the SMS when no template is configured at all', async () => {
      const { service, sent } = serviceWith({ INVITE_BASE_URL: 'https://staging.boya.ir' });

      await service.create({ role: 'specialist', phone: nextPhone() }, OWNER, TENANT_A);
      // The invite is still persisted and still returned — the missing template
      // only suppresses the send; it never fails the request.
      expect(sent).toHaveLength(0);
      expect(await rows()).toHaveLength(1);
    });

    it('sends only the bare token when INVITE_BASE_URL is unset', async () => {
      const { service, sent } = serviceWith({ MELIPAYAMAK_INVITE_BODY_ID: '1001' });

      const phone = nextPhone();
      const issued = await service.create({ role: 'specialist', phone }, OWNER, TENANT_A);
      expect(sent[0].token).toBe(issued.token);
    });
  });
});