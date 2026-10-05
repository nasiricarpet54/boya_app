import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AcceptedInvite, InviteTokenService } from './invite-token.service';
import { OtpService } from './otp.service';
import { RefreshTokenService } from './refresh-token.service';

export interface AuthUser {
  id: string;
  phoneNumber: string;
  fullName: string | null;
  role: string;
  isNewUser: boolean;
  tenantId: string | null;
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
  user: AuthUser;
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

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      refreshExpiresAt: issued.refreshExpiresAt,
      user: {
        id: row.id,
        phoneNumber: row.phone,
        fullName: row.full_name,
        role: row.role,
        isNewUser: row.is_new,
        tenantId,
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
}
