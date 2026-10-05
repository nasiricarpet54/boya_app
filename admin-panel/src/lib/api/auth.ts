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

/** ADR-009: the two credentials, plus when the refresh one dies. */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: string;
  user: AuthUser;
}

/** What `POST /auth/refresh` answers with (no user block: the caller keeps it). */
export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: string;
}

export const authApi = {
  /** `POST /auth/otp/send` — `@Public()`, throttled to 3 sends / 10 min. */
  sendOtp(phoneNumber: string): Promise<{ message: string }> {
    return api
      .post<{ message: string }>('/auth/otp/send', { phoneNumber })
      .then((response) => response.data);
  },

  /** `POST /auth/otp/verify` — returns the token pair plus the resolved user. */
  verifyOtp(phoneNumber: string, code: string): Promise<AuthResponse> {
    return api
      .post<AuthResponse>('/auth/otp/verify', { phoneNumber, code })
      .then((response) => response.data);
  },

  /**
   * `POST /auth/refresh` — `@Public()`, single-use rotation.
   *
   * Exposed for a proactive refresh (e.g. on tab focus). The axios interceptor
   * already does this automatically on a 401, so a manual call is only for
   * refreshing *before* a request fails.
   */
  refresh(refreshToken: string): Promise<RefreshResponse> {
    return api
      .post<RefreshResponse>('/auth/refresh', { refreshToken })
      .then((response) => response.data);
  },

  /**
   * `POST /auth/logout` — `@Public()`, revokes this device's refresh token.
   *
   * Best effort by design: the caller clears local state either way, because
   * trapping an admin who is trying to leave is worse than a token that stays
   * valid until it expires.
   */
  logout(refreshToken: string): Promise<void> {
    return api.post('/auth/logout', { refreshToken }).then(() => undefined);
  },

  /** `POST /auth/logout-all` — needs a valid access token. */
  logoutAll(): Promise<{ revoked: number }> {
    return api
      .post<{ revoked: number }>('/auth/logout-all')
      .then((response) => response.data);
  },
};
