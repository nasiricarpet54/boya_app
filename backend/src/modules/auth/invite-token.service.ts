import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from '@mirad-work/sms-nestjs';
import { createHash, randomBytes } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';

import { RefreshTokenService } from './refresh-token.service';

/** Kept in step with the `invite_role` enum in migration 1730000000032. */
export const INVITE_ROLES = ['salon_owner', 'line_manager', 'specialist'] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

/** Roles allowed to issue an invite; `admin` is the support override. */
export const INVITE_ISSUERS: ReadonlyArray<InviteRole | 'admin'> = [
  'salon_owner',
  'line_manager',
  'admin',
];

const INVITE_TOKEN_BYTES = 32;
const DEFAULT_EXPIRY_DAYS = 7;

export interface CreateInviteInput {
  role: InviteRole;
  phone?: string;
  email?: string;
}

export interface IssuedInvite {
  /** Row id — what `listByTenant` and `revoke` refer to. */
  id: string;
  /** Plaintext. Returned once; only its hash is recoverable. */
  token: string;
  role: InviteRole;
  tenantId: string;
  expiresAt: Date;
}

export interface PendingInvite {
  id: string;
  role: InviteRole;
  phone: string | null;
  email: string | null;
  invitedBy: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface AcceptedInvite {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: {
    id: string;
    phoneNumber: string;
    fullName: string | null;
    role: InviteRole;
    isNewUser: boolean;
    tenantId: string;
  };
}

interface InviteRow {
  id: string;
  role: InviteRole;
  tenant_id: string;
  phone: string | null;
  email: string | null;
  invited_by: string;
  expires_at: Date;
  used_at: Date | null;
  created_at?: Date;
}

interface UserRow {
  id: string;
  phone: string;
  full_name: string | null;
  role: string;
}

/**
 * Issues and redeems staff invites (ADR-010).
 *
 * The customer login path creates `role = 'customer'` and nothing else, which is
 * the right default but leaves no way in for salon staff. An invite is that way
 * in: the inviter states the role, and redemption binds an OTP-proven phone to
 * that role inside the inviter's tenant.
 *
 * One rule above all: `tenantId` comes from the caller's JWT, never from the
 * request body. An invite grants access to one salon, so letting the request
 * pick which salon would turn "make me a salon owner" into one crafted POST.
 */
@Injectable()
export class InviteTokenService {
  private readonly logger = new Logger(InviteTokenService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly config: ConfigService,
    private readonly sms: SmsService,
  ) {}

  /** SHA-256 hex. Public so tests can assert what was persisted. */
  static hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private expiry(): Date {
    const days = Number(
      this.config.get<string>('INVITE_EXPIRY_DAYS', String(DEFAULT_EXPIRY_DAYS)),
    );
    const safe = Number.isFinite(days) && days > 0 ? days : DEFAULT_EXPIRY_DAYS;
    return new Date(Date.now() + safe * 86_400_000);
  }

  async create(input: CreateInviteInput, invitedBy: string, tenantId: string): Promise<IssuedInvite> {
    if (!INVITE_ROLES.includes(input.role)) {
      throw new ForbiddenException('نقش دعوت‌نامه معتبر نیست');
    }
    if (!input.phone && !input.email) {
      throw new BadRequestException('شماره موبایل یا ایمیل الزامی است');
    }

    const raw = randomBytes(INVITE_TOKEN_BYTES).toString('hex');
    const expiresAt = this.expiry();

    const inserted = await this.dataSource.query<Array<{ id: string }>>(
      `INSERT INTO invite_tokens (token_hash, role, tenant_id, phone, email, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        InviteTokenService.hashToken(raw),
        input.role,
        tenantId,
        input.phone ?? null,
        input.email ?? null,
        invitedBy,
        expiresAt,
      ],
    );

    // Best-effort, exactly like KavenegarAlertService: the inviter already gets
    // the plaintext in the response, so a provider outage must not turn a saved
    // invite into a 502 — the admin panel can always resend from the list.
    if (input.phone) {
      await this.sendInviteSms(input.phone, input.role, raw);
    }

    return { id: inserted[0].id, token: raw, role: input.role, tenantId, expiresAt };
  }

  /**
   * Sends the invite link. The link is `INVITE_BASE_URL?token=…`, so the
   * recipient's app can pick the token straight out of the deep link.
   *
   * Failures are logged, never thrown: `create` has already persisted the row
   * and the caller is holding the one-time plaintext, so aborting here would
   * only hide a working invite behind a messaging error.
   */
  private async sendInviteSms(phone: string, role: InviteRole, token: string): Promise<void> {
    const template = this.config.get<string>('KAVENEGAR_INVITE_TEMPLATE');
    if (!template) {
      this.logger.warn('KAVENEGAR_INVITE_TEMPLATE is unset; invite SMS skipped');
      return;
    }

    const baseUrl = this.config.get<string>('INVITE_BASE_URL', '');
    const link = baseUrl ? `${baseUrl}?token=${token}` : token;

    try {
      const sent = await this.sms.verify({ to: phone, template, tokens: { token: link } });
      if (!sent.success) {
        this.logger.warn(`Kavenegar invite SMS was not accepted for role=${role}`);
      }
    } catch (cause) {
      this.logger.warn(`invite SMS failed for role=${role}: ${String(cause)}`);
    }
  }

  /** Open invites for one salon, oldest first. Expiry is filtered in SQL. */
  async listByTenant(tenantId: string): Promise<PendingInvite[]> {
    const rows = await this.dataSource.query<InviteRow[]>(
      `SELECT id, role, tenant_id, phone, email, invited_by, expires_at, created_at
       FROM invite_tokens
       WHERE tenant_id = $1 AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at`,
      [tenantId],
    );
    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      phone: row.phone,
      email: row.email,
      invitedBy: row.invited_by,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at ?? Date.now()),
    }));
  }

  /**
   * Revokes an open invite.
   *
   * The actor must be the inviter, unless they are an `admin` — so a line
   * manager cannot revoke an owner's invite. Returns false when nothing matched
   * (already used, expired, or someone else's) so the controller can answer 404
   * without revealing which of those it was.
   */
  async revoke(
    inviteId: string,
    tenantId: string,
    actorId: string,
    isAdmin: boolean,
  ): Promise<boolean> {
    const result = await this.dataSource.query(
      `UPDATE invite_tokens
       SET used_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND used_at IS NULL AND ($3::boolean OR invited_by = $4)`,
      [inviteId, tenantId, isAdmin, actorId],
    );
    // TypeORM answers an UPDATE with `[rows, rowCount]`, not a bare row array —
    // `result.length > 0` would therefore be true even for a statement that
    // matched nothing, and "revoke someone else's invite" would have succeeded.
    const affected = Array.isArray(result) ? (result[1] as number | undefined) : undefined;
    return typeof affected === 'number' && affected > 0;
  }

  /**
   * Redeems an invite and opens a session for the invited person.
   *
   * The row is locked `FOR UPDATE` so two concurrent redemptions of the same
   * token cannot both pass the `used_at IS NULL` check and mint two accounts —
   * the second would then look like a replay of its own sibling.
   *
   * The OTP is the caller's job: the invite proves *what role* the person gets,
   * the OTP proves *the phone is theirs*. Neither alone is enough, so this takes
   * the phone the caller already proved rather than trusting the invite row.
   */
  async accept(token: string, provenPhone: string): Promise<AcceptedInvite> {
    const hash = InviteTokenService.hashToken(token);

    // Phase 1 — consume the invite and ensure the account exists.
    //
    // This must be *closed* before the session is issued: `issue()` opens its
    // own transaction on the shared DataSource, so it runs on a different
    // connection and cannot see an uncommitted `users` row. Calling it from in
    // here makes `refresh_tokens_user_id` fail with a foreign-key violation
    // every time. Committing first is also what keeps the single-use guarantee:
    // the `FOR UPDATE` lock is released, and any later attempt finds `used_at`
    // already set.
    const { user, tenantId } = await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<InviteRow[]>(
        `SELECT id, role, tenant_id, phone, email, invited_by, expires_at, used_at
         FROM invite_tokens
         WHERE token_hash = $1
         FOR UPDATE`,
        [hash],
      );
      const invite = rows[0];
      if (!invite) {
        throw new UnauthorizedException('کد دعوت‌نامه نامعتبر است');
      }
      if (invite.used_at) {
        throw new UnauthorizedException('این دعوت‌نامه قبلاً استفاده شده است');
      }
      if (new Date(invite.expires_at).getTime() <= Date.now()) {
        throw new UnauthorizedException('این دعوت‌نامه منقضی شده است');
      }

      const found = await this.findOrCreateInvitedUser(
        manager,
        provenPhone,
        invite.role,
        invite.tenant_id,
      );

      await manager.query(`UPDATE invite_tokens SET used_at = NOW(), used_by = $1 WHERE id = $2`, [
        found.id,
        invite.id,
      ]);

      return { user: found, tenantId: invite.tenant_id };
    });

    // Phase 2 — open the session. Outside the transaction, so a failure here
    // cannot roll the invite back into a reusable state; the account already
    // exists and a normal OTP login will hand the same person a session.
    const issued = await this.refreshTokenService.issue({
      userId: user.id,
      tenantId,
      phone: user.phone,
      role: user.role,
    });

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      refreshExpiresAt: issued.refreshExpiresAt,
      user: {
        id: user.id,
        phoneNumber: user.phone,
        fullName: user.full_name,
        role: user.role as InviteRole,
        isNewUser: user.is_new,
        tenantId,
      },
    };
  }

  /**
   * Finds the phone's user or creates the staff row, refusing to repurpose an
   * existing account.
   *
   * Mirrors `SpecialistService.inviteSpecialist`: an existing `customer` on the
   * same number is a 400 rather than a silent promotion, so an invite can never
   * take over a real person's account.
   */
  private async findOrCreateInvitedUser(
    manager: EntityManager,
    phone: string,
    role: InviteRole,
    tenantId: string,
  ): Promise<UserRow & { is_new: boolean }> {
    const existing = await manager.query<Array<{ id: string; role: string }>>(
      `SELECT id, role FROM users WHERE phone = $1`,
      [phone],
    );
    const found = existing[0];

    if (found) {
      if (found.role === role) {
        // Re-inviting someone who already joined is a no-op, not an error.
        const full = await manager.query<UserRow[]>(
          `SELECT id, phone, full_name, role FROM users WHERE id = $1`,
          [found.id],
        );
        return { ...full[0], is_new: false };
      }
      throw new BadRequestException(
        'این شماره قبلاً با نقش دیگری ثبت شده است؛ امکان تغییر نقش وجود ندارد',
      );
    }

    // Created directly rather than through `find_or_create_customer_by_phone`,
    // which hard-codes `role = 'customer'` and would defeat the whole point.
    const inserted = await manager.query<UserRow[]>(
      `INSERT INTO users (tenant_id, phone, role) VALUES ($1, $2, $3)
       RETURNING id, phone, full_name, role`,
      [tenantId, phone, role],
    );
    return { ...inserted[0], is_new: true };
  }
}