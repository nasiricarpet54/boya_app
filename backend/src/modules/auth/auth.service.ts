import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from './guards/jwt-auth.guard';
import { AcceptedInvite, InviteTokenService } from './invite-token.service';
import { IssuedTokens, RefreshTokenService } from './refresh-token.service';
import { OtpService } from './otp.service';
import { UserRole } from '../user/entities/user.entity';

export interface AuthUser {
  id: string;
  phoneNumber: string;
  fullName: string | null;
  role: string;
  isNewUser: boolean;
  tenantId: string | null;
}

/** Reply of `GET /auth/me`: the JWT identity plus the onboarding flag. */
export interface CurrentUserProfile {
  id: string;
  phoneNumber: string;
  fullName: string | null;
  role: string;
  tenantId: string | null;
  /**
   * False while this account still owes the panel a profile, so the app can
   * route into the onboarding screens instead of the dashboard. Resolved per
   * role: a `specialist` reads their own `specialists` row, a salon owner or
   * line manager reads `tenants.profile_completed` (migration 1730000000033).
   * Always `true` for roles that have no onboarding form.
   */
  profileCompleted: boolean;
}

export interface AuthResponse {
  /**
   * Short-lived JWT for API calls. ADR-009: previously this field was called
   * `token`; it is now explicitly the *access* token because a long-lived
   * `refreshToken` accompanies it and the two have very different lifetimes.
   */
  accessToken: string;
  /** Long-lived, single-use, rotatable. Only its SHA-256 hash is stored. */
  refreshToken: string;
  refreshExpiresAt: Date;
  /** The role this session acts under. Signed into the access token. */
  activeRole: UserRole;
  /**
   * Every role the account is recorded with. One user row carries one role
   * today, so this is always a single-entry list; the client renders a role
   * picker from it regardless, so a future multi-role account changes data,
   * not contract.
   */
  allowedRoles: UserRole[];
  /**
   * Where the client lands after login for [activeRole]. Staff roles share the
   * single salon panel (ADR-003/ADR-008: the specialist app was folded into it
   * and role separation happens inside the panel through role-scoped APIs and
   * the router's role guard), so they all point at the panel's dashboard.
   */
  redirectRoute: string;
  user: AuthUser;
}

/**
 * The post-login destination per role. Kept server-side so the client cannot be
 * tricked into routing a `specialist` token to an owner screen: the route it
 * is handed is the route its role earns.
 */
export function redirectRouteFor(role: UserRole): string {
  switch (role) {
    case 'customer':
      return '/';
    case 'admin':
    case 'super_admin':
      // The platform back-office is a separate web app; neither mobile panel
      // admits these roles (the salon panel's role guard shows its forbidden
      // page), so no panel route is promised here.
      return '/';
    default:
      // salon_owner, line_manager, specialist, employed, booth_renter,
      // freelance_mobile — one salon panel, role-scoped inside it.
      return '/dashboard';
  }
}


@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly inviteTokenService: InviteTokenService,
  ) {}

  async verifyOtpAndIssueToken(
    phoneNumber: string,
    code: string,
  ): Promise<AuthResponse> {
    // 1. Verify the OTP (throws on failure)
    await this.otpService.verifyOtp(phoneNumber, code);

    // 2. Normalize the phone the same way OtpService does.
    //    OtpService.normalizePersianPhone is private; we redo a
    //    minimal version here. Use the same rules: Persian/Arabic
    //    digits to Latin, strip non-digit, ensure leading 0.
    const normalized = this.normalizePhone(phoneNumber);

    // 3. Find or create the user via the SECURITY DEFINER lookup function.
    //    `users` is FORCE ROW LEVEL SECURITY on app.current_tenant_id and a
    //    login request has no tenant context, so the tenant_id can only come
    //    from that function (see migration 1730000000013). It is NULL for
    //    customers and set for salon_owner / line_manager / specialist / admin.
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        phone: string;
        full_name: string | null;
        role: string;
        is_new: boolean;
        tenant_id: string | null;
      }>
    >(`SELECT id, phone, full_name, role, is_new, tenant_id FROM find_or_create_customer_by_phone($1)`, [normalized]);

    const row = rows[0];
    if (!row) {
      throw new Error('find_or_create_customer_by_phone returned no rows');
    }

    const tenantId = row.tenant_id ?? null;

    // 4. Open a refresh session (ADR-009) and take its access token from it.
    //    The claims match what `JwtAuthGuard` expects: `sub` and `role` drive
    //    every authorisation decision, and salon-side routes (e.g.
    //    POST /bookings/:id/approve) read `tenantId` to pick the salon they
    //    act on, so it must come from the DB — it is null for customers.
    const issued = await this.refreshTokenService.issue({
      userId: row.id,
      tenantId,
      phone: row.phone,
      role: row.role,
    });

    return this.toAuthResponse(issued, row, row.is_new);
  }

  /**
   * `POST /auth/switch-role` — re-mints the session for another role the
   * account actually holds, so the active role always comes from the database
   * and never from what the caller claims.
   *
   * A hand-edited token can carry any `role` it likes; that claim is what
   * `JwtAuthGuard` reads, so without this lookup switching would be a
   * self-issued privilege escalation. Here the requested role is compared to
   * the row, and a mismatch is a 403 — the same rule the charter states as
   * "role selection happens among the roles recorded in the database only".
   * The token is re-issued rather than patched because `role` is a signed
   * claim: mutating it in place is exactly the tampering the guard rejects.
   *
   * `users` is FORCE ROW LEVEL SECURITY on `app.current_tenant_id`, which
   * `TenantRlsInterceptor` mirrors from the verified JWT for tenant users —
   * the same exception `currentUser()` documented for its own lookup.
   */
  async switchRole(user: AuthenticatedUser, requestedRole: UserRole): Promise<AuthResponse> {
    const rows = await this.dataSource.query<
      Array<{
        id: string;
        phone: string;
        full_name: string | null;
        role: string;
        tenant_id: string | null;
      }>
    >(`SELECT id, phone, full_name, role, tenant_id FROM users WHERE id = $1`, [user.userId]);

    const row = rows[0];
    if (!row) throw new UnauthorizedException('حساب کاربری یافت نشد');
    if (row.role !== requestedRole) {
      throw new ForbiddenException('این نقش برای حساب شما تعریف نشده است');
    }

    const issued = await this.refreshTokenService.issue({
      userId: row.id,
      tenantId: row.tenant_id ?? null,
      phone: row.phone,
      role: row.role,
    });

    return this.toAuthResponse(issued, row, false);
  }

  /**
   * The login/refresh/switch-role reply: the tokens plus the role routing the
   * client needs. `allowedRoles` mirrors what the account is recorded with —
   * one row, one role today, so the role-picker the spec describes will only
   * ever show a single entry until accounts can hold several roles; the field
   * is already here so that change is additive.
   */
  private toAuthResponse(
    issued: IssuedTokens,
    row: { id: string; phone: string; full_name: string | null; role: string; tenant_id: string | null },
    isNewUser: boolean,
  ): AuthResponse {
    const role = row.role as UserRole;
    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      refreshExpiresAt: issued.refreshExpiresAt,
      activeRole: role,
      allowedRoles: [role],
      redirectRoute: redirectRouteFor(role),
      user: {
        id: row.id,
        phoneNumber: row.phone,
        fullName: row.full_name,
        role,
        isNewUser,
        tenantId: row.tenant_id ?? null,
      },
    };
  }

  private normalizePhone(input: string): string {
    const map: Record<string, string> = {
      '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
      '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
      '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
      '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    };
    let p = input.replace(/[۰-۹٠-٩]/g, (d) => map[d] ?? d);
    p = p.replace(/\s|-|\(|\)/g, '');
    if (p.startsWith('+98')) p = '0' + p.slice(3);
    if (p.startsWith('98') && p.length === 12) p = '0' + p.slice(2);
    return p;
  }

  /**
   * Redeem an invite: verify the OTP under the **invite** purpose, then let the
   * invite service mint the account and session.
   *
   * Deliberately separate from `verifyOtpAndIssueToken`. That path runs
   * `find_or_create_customer_by_phone`, which hard-codes `role = 'customer'`, so
   * routing an invited phone through it would hand out a customer account and
   * defeat the invite entirely. The purpose string is what keeps the two
   * credential spaces apart: a code sent for a customer login lives under
   * `otp:login:<phone>` and cannot be spent here.
   */
  async verifyInviteOtpAndIssueToken(
    inviteToken: string,
    phone: string,
    code: string,
  ): Promise<AcceptedInvite> {
    await this.otpService.verifyOtp(phone, code, 'invite');
    return this.inviteTokenService.accept(inviteToken, phone);
  }

  /**
   * `GET /auth/me` — who the bearer token belongs to, plus the onboarding flag.
   *
   * The identity comes straight from the verified JWT (`sub`, `role`,
   * `tenantId`), so this cannot be pointed at another account. Only the
   * *profile* half needs a query, and it reads the live row the onboarding
   * flag lives on:
   *
   *  - `specialist` → their own `specialists` row (matched on the JWT user id
   *    *and* the JWT tenant, so a stale token cannot read a row in a salon the
   *    person has since left). The row may legitimately be missing — a user
   *    promoted to `specialist` before the invite auto-created rows — and that
   *    is treated as "profile incomplete" rather than an error, because the
   *    setup screen is exactly where that person should go.
   *  - `salon_owner` / `line_manager` → `tenants.profile_completed` for the
   *    JWT tenant.
   *  - anything else (`admin`, and any role with no salon) → `true`: there is no
   *    onboarding form to send them to.
   *
   * The phone and full name are read from `users` on the owner connection. That
   * table is FORCE ROW LEVEL SECURITY on `app.current_tenant_id`, and an admin
   * JWT carries no tenant, so a `withTenant`-scoped read would come back empty
   * for exactly the accounts that need no onboarding. The lookup is keyed by
   * the verified `sub`, never by a request parameter, which is the same
   * trade-off `refresh-token.service` documents for its own user lookup.
   */
  async currentUser(user: AuthenticatedUser): Promise<CurrentUserProfile> {
    const rows = await this.dataSource.query<
      Array<{ phone: string; full_name: string | null }>
    >(`SELECT phone, full_name FROM users WHERE id = $1`, [user.userId]);
    const row = rows[0];

    return {
      id: user.userId,
      phoneNumber: row?.phone ?? user.phoneNumber,
      fullName: row?.full_name ?? null,
      role: user.role,
      tenantId: user.tenantId ?? null,
      profileCompleted: await this.isProfileComplete(user),
    };
  }

  /** See [currentUser] for why each role reads a different row. */
  private async isProfileComplete(user: AuthenticatedUser): Promise<boolean> {
    if (!user.tenantId) return true;

    if (user.role === 'specialist') {
      const rows = await this.dataSource.query<Array<{ profile_completed: boolean }>>(
        `SELECT profile_completed FROM specialists WHERE tenant_id = $1 AND user_id = $2`,
        [user.tenantId, user.userId],
      );
      // No row yet means the onboarding form has never been submitted.
      return rows[0]?.profile_completed ?? false;
    }

    if (user.role === 'salon_owner' || user.role === 'line_manager') {
      const rows = await this.dataSource.query<Array<{ profile_completed: boolean }>>(
        `SELECT profile_completed FROM tenants WHERE id = $1`,
        [user.tenantId],
      );
      return rows[0]?.profile_completed ?? true;
    }

    return true;
  }
}
