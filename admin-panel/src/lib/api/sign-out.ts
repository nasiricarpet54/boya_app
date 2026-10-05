'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { authApi } from './auth';
import { useAuthStore } from '../stores/auth';

/**
 * Signing out that actually ends the session.
 *
 * `logout()` on the store only clears local state, which leaves the refresh
 * token valid on the server for the rest of its lifetime — a copy taken from the
 * machine would still work. So the token is revoked first, and the local state
 * is cleared either way: an admin who is trying to leave must never be trapped
 * by a failing network call.
 */
export function useSignOut(): () => Promise<void> {
  const router = useRouter();
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const logout = useAuthStore((state) => state.logout);

  return useCallback(async () => {
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // Best effort — see above.
    }
    logout();
    router.replace('/login');
  }, [refreshToken, logout, router]);
}