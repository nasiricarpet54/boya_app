import api from './client';
import type { UserRole } from '../stores/auth';

/** Mirrors `AuthService.AuthResponse` in `backend/src/modules/auth/auth.service.ts`. */
export interface AuthUser {
  id: string;
  phoneNumber: string;
  fullName: string | null;
  role: UserRole;
  isNewUser: boolean;
  tenantId: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export const authApi = {
  /** `POST /auth/otp/send` — `@Public()`, throttled to 3 sends / 10 min. */
  sendOtp(phoneNumber: string): Promise<{ message: string }> {
    return api
      .post<{ message: string }>('/auth/otp/send', { phoneNumber })
      .then((response) => response.data);
  },

  /** `POST /auth/otp/verify` — returns the JWT plus the resolved user row. */
  verifyOtp(phoneNumber: string, code: string): Promise<AuthResponse> {
    return api
      .post<AuthResponse>('/auth/otp/verify', { phoneNumber, code })
      .then((response) => response.data);
  },
};
