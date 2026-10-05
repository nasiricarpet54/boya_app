import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import {
  RefreshTokenService,
  msDuration,
} from '../../src/modules/auth/refresh-token.service';
import {
  describeIntegration,
  getAdminDataSource,
  queryAsAdmin,
  withTenant,
} from '../setup/integration.setup';

const TENANT = '44444444-4444-4444-8444-444444444444';
const USER = '44444444-4444-4444-8444-4444444444a1';

interface StoredRow {
  // `queryAsAdmin` is generic over `Record<string, unknown>`, which an
  // interface does not satisfy implicitly — hence the index signature.
  [key: string]: unknown;
  id: string;
  family_id: string;
  token_hash: string;
  device_info: string | null;
  revoked_at: Date | null;
  replaced_by: string | null;
}

/**
 * Refresh tokens against a real database (ADR-009).
 *
 * Runs on the migration-owner connection because that is the role the
 * application itself uses: `/auth/refresh` has to resolve `user_id` from the
 * presented token hash before any RLS context exists, so asserting this against
 * the NOBYPASSRLS role would test a path production does not have.
 */
describeIntegration('refresh tokens', () => {
  // Built in `beforeAll`, not inline: the DataSources do not exist yet while
  // jest is still collecting this file's tests.
  let service: RefreshTokenService;

  beforeAll(async () => {
    service = new RefreshTokenService(
      getAdminDataSource(),
      new JwtService({ secret: 'integration-secret' }),
      // Minimal ConfigService stand-in: only JWT_REFRESH_TTL is read.
      { get: <T>(_key: string, fallback: T) => fallback } as unknown as ConfigService,
    );
  });

  const issue = (deviceInfo?: string) =>
    service.issue({
      userId: USER,
      tenantId: TENANT,
      phone: '09120005501',
      role: 'salon_owner',
      deviceInfo,
    });

  const stored = () =>
    queryAsAdmin<StoredRow>(
      `SELECT id, family_id, token_hash, device_info, revoked_at, replaced_by
       FROM refresh_tokens WHERE user_id = $1 ORDER BY created_at`,
      [USER],
    );

  beforeAll(async () => {
    await queryAsAdmin(`DELETE FROM refresh_tokens WHERE user_id = $1`, [USER]);
    await withTenant(TENANT, async (query) => {
      await query(`INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
        TENANT,
        'IT Refresh Tenant',
      ]);
      await query(`DELETE FROM users WHERE id = $1`, [USER]);
      await query(`INSERT INTO users (id, tenant_id, phone, role) VALUES ($1, $2, $3, 'salon_owner')`, [
        USER,
        TENANT,
        '09120005501',
      ]);
    });
  });

  afterAll(async () => {
    await queryAsAdmin(`DELETE FROM refresh_tokens WHERE user_id = $1`, [USER]);
    await withTenant(TENANT, async (query) => {
      await query(`DELETE FROM users WHERE id = $1`, [USER]);
      await query(`DELETE FROM tenants WHERE id = $1`, [TENANT]);
    });
  });
it('issue stores only the SHA-256 hash, never the token itself', async () => {
    const issued = await issue('android-test');

    expect(issued.accessToken).toBeTruthy();
    expect(issued.refreshToken).toMatch(/^[0-9a-f]{64}$/);

    const rows = await stored();
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toBe(RefreshTokenService.hashToken(issued.refreshToken));
    expect(rows[0].device_info).toBe('android-test');
  });

  it('rotates: revokes the old token, keeps the family, links the successor', async () => {
    const first = await issue();
    const second = await service.rotate(first.refreshToken, 'android-test-2');

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.familyId).toBe(first.familyId);

    const rows = await stored();
    expect(rows).toHaveLength(2);
    const [old, successor] = rows;
    expect(old.revoked_at).not.toBeNull();
    expect(old.replaced_by).toBe(successor.id);
    expect(successor.revoked_at).toBeNull();
  });

  it('reuse detection: replaying a rotated token kills the whole family', async () => {
    const first = await issue();
    const second = await service.rotate(first.refreshToken);

    // The attacker replays the token the real client already spent.
    await expect(service.rotate(first.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    // Not just the replayed one: the live successor dies too, forcing a login.
    const rows = await stored();
    expect(rows.every((row) => row.revoked_at !== null)).toBe(true);
    await expect(service.rotate(second.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuses an expired token', async () => {
    const issued = await issue();
    await queryAsAdmin(
      `UPDATE refresh_tokens SET expires_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1`,
      [USER],
    );

    await expect(service.rotate(issued.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuses a token that was never issued', async () => {
    await expect(service.rotate('f'.repeat(64))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logout revokes only the presented token', async () => {
    const phone = await issue();
    const tablet = await issue();

    await service.revoke(phone.refreshToken);

    const rows = await stored();
    expect(rows.filter((row) => row.revoked_at !== null)).toHaveLength(1);
    // The other device keeps working.
    await expect(service.rotate(tablet.refreshToken)).resolves.toBeTruthy();
  });

  it('revokeAll kills every live token and reports the count', async () => {
    await issue();
    await issue();

    expect(await service.revokeAll(USER)).toBe(2);
    // Idempotent: a second call has nothing left to revoke.
    expect(await service.revokeAll(USER)).toBe(0);
    expect((await stored()).every((row) => row.revoked_at !== null)).toBe(true);
  });

  it('revokeFamily kills only that family', async () => {
    const first = await issue();
    const other = await issue();

    await service.revokeFamily(first.familyId);

    const rows = await stored();
    expect(rows.filter((r) => r.family_id === first.familyId && r.revoked_at !== null)).toHaveLength(1);
    expect(rows.filter((r) => r.family_id === other.familyId && r.revoked_at === null)).toHaveLength(1);
  });

  it('signs an access token the guard can use', async () => {
    const issued = await issue();
    const payload = new JwtService({ secret: 'integration-secret' }).verify<{
      sub: string;
      role: string;
      tenantId: string | null;
    }>(issued.accessToken, { secret: 'integration-secret' });

    expect(payload.sub).toBe(USER);
    expect(payload.role).toBe('salon_owner');
    expect(payload.tenantId).toBe(TENANT);
  });

  it('msDuration parses the configured TTL and rejects nonsense', () => {
    expect(msDuration('30d')).toBe(30 * 86_400_000);
    expect(msDuration('15m')).toBe(900_000);
    expect(msDuration('not-a-duration')).toBeUndefined();
  });
});

  beforeEach(async () => {
    await queryAsAdmin(`DELETE FROM refresh_tokens WHERE user_id = $1`, [USER]);
  });