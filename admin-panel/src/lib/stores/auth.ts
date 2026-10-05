import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { TOKEN_STORAGE_KEY } from '../constants';

/** Roles the API can put on a token; `backend/.../user.entity.ts` is canonical. */
export type UserRole = 'customer' | 'salon_owner' | 'line_manager' | 'specialist' | 'admin';

export interface AdminUser {
  id: string;
  phoneNumber: string;
  fullName: string | null;
  role: UserRole;
  tenantId: string | null;
}

interface AuthState {
  /** Short-lived, sent as `Authorization: Bearer`. Replaced on every 401. */
  accessToken: string | null;
  /** Long-lived, single-use, rotatable. Revoking it ends the session (ADR-009). */
  refreshToken: string | null;
  refreshExpiresAt: string | null;
  user: AdminUser | null;
  /**
   * `false` until `persist` has read storage. The protected layout waits for
   * this before deciding to redirect: on the first client render the store is
   * still empty, and treating that as "signed out" would bounce a signed-in
   * admin to `/login` on every hard refresh.
   */
  isHydrated: boolean;
  setAuth: (session: {
    accessToken: string;
    refreshToken: string;
    refreshExpiresAt: string | null;
    user: AdminUser;
  }) => void;
  /** Applies a rotation without touching the user. */
  setTokens: (tokens: {
    accessToken: string;
    refreshToken: string;
    refreshExpiresAt: string | null;
  }) => void;
  logout: () => void;
  setHydrated: (isHydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      refreshExpiresAt: null,
      user: null,
      isHydrated: false,

      setAuth: (session) =>
        set({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          refreshExpiresAt: session.refreshExpiresAt,
          user: session.user,
          isHydrated: true,
        }),

      setTokens: (tokens) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          refreshExpiresAt: tokens.refreshExpiresAt,
        }),

      logout: () => {
        // Removed eagerly so the axios interceptor cannot read a stale token
        // during the in-flight requests the redirect triggers.
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
        set({
          accessToken: null,
          refreshToken: null,
          refreshExpiresAt: null,
          user: null,
          isHydrated: true,
        });
      },

      setHydrated: (isHydrated) => set({ isHydrated }),
    }),
    {
      name: TOKEN_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      /**
       * Bumped for ADR-009. A pre-ADR-009 entry holds only `token`, and there
       * is no way to mint a refresh token for it — the admin has to sign in
       * again. `merge` drops the stale shape explicitly instead of letting a
       * half-populated store believe it still holds a session.
       */
      version: 1,
      migrate: (persisted, version) => {
        const legacy = persisted as
          | { token?: unknown; accessToken?: unknown; refreshToken?: unknown }
          | undefined;
        if (version === 0 || legacy?.accessToken == null) {
          return { accessToken: null, refreshToken: null, user: null } as never;
        }
        return persisted;
      },
      // `isHydrated` is deliberately not persisted: it describes this tab's
      // relationship with storage, not the session itself.
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        refreshExpiresAt: state.refreshExpiresAt,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

/**
 * Session guard shared by the protected layout and the login page.
 *
 * The store holding a token is necessary but not sufficient — the API rejects
 * any role but `admin` inside `ApprovalsService.requireAdmin`, so a customer
 * token that somehow reached storage must not open the panel.
 */
export function isAdminSession(state: { accessToken: string | null; user: AdminUser | null }): boolean {
  return Boolean(state.accessToken) && state.user?.role === 'admin';
}
