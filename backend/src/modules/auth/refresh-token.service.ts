import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { DataSource, EntityManager } from 'typeorm';

import { setUserContext } from '../../database/tenant-context';

/** What the client receives from login, refresh, and OTP verification alike. */
export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  /** The rotation family; equal on every token of one signed-in device. */
  familyId: string;
  refreshExpiresAt: Date;
}

export interface IssueOptions {
  userId: string;
  tenantId: string | null;
  phone: string;
  role: string;
  deviceInfo?: string;
  /** Omit to start a new family (login); pass the old family to rotate. */
  familyId?: string;
}

interface RefreshRow {
  id: string;
  user_id: string;
  tenant_id: string | null;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
}

interface UserRow {
  id: string;
  phone: string;
  role: string;
  tenant_id: string | null;
}

const REFRESH_TOKEN_BYTES = 32;
const DEFAULT_REFRESH_TTL = '30d';

/**
 * Parses an `ms`-style duration into milliseconds.
 *
 * Implemented locally instead of importing `ms` at runtime: the package is only
 * used as a type elsewhere, so it is not a direct dependency and `require`-ing
 * it would break a future install that drops the transitive copy.
 */
export function msDuration(value: string): number | undefined {
  const match = /^(\d+)(ms|s|m|h|d|w|y)$/.exec(value.trim());
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unitMs: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
    y: 31_536_000_000,
  };
  return amount * unitMs[match[2]];
}

/**
 * Issues, rotates and revokes refresh tokens (ADR-009).
 *
 * Only the SHA-256 hash of a refresh token is stored, so a database dump yields
 * nothing an attacker can present. The token is 32 bytes of `randomBytes`, which
 * carries far more entropy than a hash could collide on, so a plain hash is
 * both exact and safe to index.
 *
 * Rotation is mandatory: every refresh returns a new token and revokes its
 * predecessor. That is what makes reuse detectable — a token presented after it
 * was revoked is either a replay or a stolen copy, and since the server cannot
 * tell those apart it revokes the entire family and forces a fresh login.
 * Revoking only the presented token would leave the stolen copy usable.
 */
@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** SHA-256 hex. Public so tests can assert what was persisted. */
  static hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private newRawToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  }

  private expiry(): Date {
    // A malformed TTL must not mint an already-expired token, so it falls back
    // to the documented default rather than producing NaN.
    const ms =
      msDuration(this.config.get<StringValue>('JWT_REFRESH_TTL', DEFAULT_REFRESH_TTL)) ??
      msDuration(DEFAULT_REFRESH_TTL)!;
    return new Date(Date.now() + ms);
  }

  private async signAccessToken(user: {
    userId: string;
    tenantId: string | null;
    phone: string;
    role: string;
  }): Promise<string> {
    // Claim names mirror `JwtAuthGuard`: `sub` and `role` are what every
    // authorisation decision reads, and salon-side routes need `tenantId` to
    // pick the salon they act on.
    return this.jwtService.signAsync({
      sub: user.userId,
      phone: user.phone,
      role: user.role,
      tenantId: user.tenantId,
    });
  }

  private async loadUser(manager: EntityManager, userId: string): Promise<UserRow> {
    const rows = await manager.query<UserRow[]>(
      `SELECT id, phone, role, tenant_id FROM users WHERE id = $1`,
      [userId],
    );
    const user = rows[0];
    if (!user) {
      // The column is ON DELETE CASCADE, so this means the account was deleted
      // between issuing and refreshing. Fail like an expired token.
      throw new UnauthorizedException('کاربر یافت نشد');
    }
    return user;
  }

  /**
   * Starts a new session (login) or continues one (rotation, by passing the
   * existing `familyId`).
   */
  async issue(options: IssueOptions): Promise<IssuedTokens> {
    const raw = this.newRawToken();
    // `randomUUID`, not `randomBytes(16)`: the column is `uuid`, so Postgres hands
// back the canonical dashed form. Generating the same shape keeps the value the
// caller receives from `issue` byte-identical to the one `rotate` reads back —
// otherwise a client comparing them across a refresh sees a phantom change.
const familyId = options.familyId ?? randomUUID();
    const expiresAt = this.expiry();

    await this.dataSource.transaction(async (manager) => {
      await setUserContext(manager, options.userId);
      await manager.query(
        `INSERT INTO refresh_tokens (user_id, tenant_id, token_hash, family_id, device_info, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          options.userId,
          options.tenantId,
          RefreshTokenService.hashToken(raw),
          familyId,
          options.deviceInfo ?? null,
          expiresAt,
        ],
      );
    });

    return {
      accessToken: await this.signAccessToken(options),
      refreshToken: raw,
      familyId,
      refreshExpiresAt: expiresAt,
    };
  }

  /**
   * Exchanges a live refresh token for a fresh pair.
   *
   * The row is locked `FOR UPDATE` for the whole transaction so two concurrent
   * refreshes of the same token cannot both pass the `revoked_at IS NULL` check
   * and mint two successors — the second would otherwise look like a reuse of
   * its own brand-new sibling and wrongly kill the family.
   */
  async rotate(refreshToken: string, deviceInfo?: string): Promise<IssuedTokens> {
    const hash = RefreshTokenService.hashToken(refreshToken);

    // The transaction only ever *returns* a verdict; the throw happens outside
    // it. Throwing from inside would roll the transaction back — which on the
    // reuse path would discard the family revocation that is the whole point of
    // the check, leaving the attacker's copy alive.
    const outcome = await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<RefreshRow[]>(
        `SELECT id, user_id, tenant_id, family_id, expires_at, revoked_at
         FROM refresh_tokens
         WHERE token_hash = $1
         FOR UPDATE`,
        [hash],
      );
      const row = rows[0];
      if (!row) {
        return { kind: 'unknown' } as const;
      }

      if (row.revoked_at) {
        // Already rotated away from: a replay or a stolen token. Kill the whole
        // family so neither copy survives.
        await manager.query(
          `UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = $1 AND revoked_at IS NULL`,
          [row.family_id],
        );
        return { kind: 'reused' } as const;
      }

      if (new Date(row.expires_at).getTime() <= Date.now()) {
        return { kind: 'expired' } as const;
      }

      const user = await this.loadUser(manager, row.user_id);
      const raw = this.newRawToken();
      const expiresAt = this.expiry();

      const inserted = await manager.query<Array<{ id: string }>>(
        `INSERT INTO refresh_tokens (user_id, tenant_id, token_hash, family_id, device_info, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          row.user_id,
          row.tenant_id,
          RefreshTokenService.hashToken(raw),
          row.family_id,
          deviceInfo ?? null,
          expiresAt,
        ],
      );
      const successorId = inserted[0].id;

      await manager.query(
        `UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = $1 WHERE id = $2`,
        [successorId, row.id],
      );

      return {
        kind: 'ok',
        tokens: {
          accessToken: await this.signAccessToken({
            userId: user.id,
            tenantId: user.tenant_id,
            phone: user.phone,
            role: user.role,
          }),
          refreshToken: raw,
          familyId: row.family_id,
          refreshExpiresAt: expiresAt,
        },
      } as const;
    });

    if (outcome.kind === 'unknown') {
      throw new UnauthorizedException('توکن تازه‌سازی نامعتبر است');
    }
    if (outcome.kind === 'reused') {
      throw new UnauthorizedException(
        'توکن تازه‌سازی قبلاً استفاده شده است؛ به دلایل امنیتی همه نشست‌های این دستگاه باطل شد',
      );
    }
    if (outcome.kind === 'expired') {
      throw new UnauthorizedException('توکن تازه‌سازی منقضی شده است');
    }
    return outcome.tokens;
  }

  /** Signs out one device. Idempotent: revoking twice is not an error. */
  async revoke(refreshToken: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
      [RefreshTokenService.hashToken(refreshToken)],
    );
  }

  /** Signs out every device. Returns how many live tokens were killed. */
  async revokeAll(userId: string): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      await setUserContext(manager, userId);
      const rows = await manager.query<Array<{ count: string }>>(
        `WITH killed AS (
           UPDATE refresh_tokens SET revoked_at = NOW()
           WHERE user_id = $1 AND revoked_at IS NULL
           RETURNING 1
         )
         SELECT count(*)::text AS count FROM killed`,
        [userId],
      );
      return Number(rows[0].count);
    });
  }

  /** Kills every live token in one family, used by reuse detection. */
  async revokeFamily(familyId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = $1 AND revoked_at IS NULL`,
      [familyId],
    );
  }
}