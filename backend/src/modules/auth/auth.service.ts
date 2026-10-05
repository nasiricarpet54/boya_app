import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { OtpService } from './otp.service';

export interface AuthUser {
  id: string;
  phoneNumber: string;
  fullName: string | null;
  role: string;
  isNewUser: boolean;
  tenantId: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
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

    // 4. Sign JWT with the real tenantId from the DB (customers have null).
    //    Salon-side routes (e.g. POST /bookings/:id/approve) read this claim to
    //    pick the tenant they act on; a missing claim locks staff out of them.
    const token = await this.jwtService.signAsync({
      sub: row.id,
      phone: row.phone,
      role: row.role,
      tenantId,
    });

    return {
      token,
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
}
