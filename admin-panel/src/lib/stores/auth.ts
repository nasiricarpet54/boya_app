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
  token: string | null;
  user: AdminUser | null;
  /**
   * `false` until `persist` has read storage. The protected layout waits for
   * this before deciding to redirect: on the first client render the store is
   * still empty, and treating that as "signed out" would bounce a signed-in
   * admin to `/login` on every hard refresh.
   */
  isHydrated: boolean;
  setAuth: (token: string, user: AdminUser) => void;
  logout: () => void;
  setHydrated: (isHydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isHydrated: false,

      setAuth: (token, user) => set({ token, user, isHydrated: true }),

      logout: () => {
        // Removed eagerly so the axios interceptor cannot read a stale token
        // during the in-flight requests the redirect triggers.
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
        set({ token: null, user: null, isHydrated: true });
      },

      setHydrated: (isHydrated) => set({ isHydrated }),
    }),
    {
      name: TOKEN_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // `isHydrated` is deliberately not persisted: it describes this tab's
      // relationship with storage, not the session itself.
      partialize: (state) => ({ token: state.token, user: state.user }),
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
export function isAdminSession(state: { token: string | null; user: AdminUser | null }): boolean {
  return Boolean(state.token) && state.user?.role === 'admin';
}
