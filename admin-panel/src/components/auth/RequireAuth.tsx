'use client';

import { useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';

import { isAdminSession, useAuthStore } from '@/lib/stores/auth';
import { useRouter } from '@/lib/navigation';

/**
 * Client-side gate for the `(protected)` group.
 *
 * Two rules, in order:
 *
 * 1. Wait for `persist` to rehydrate. On the first client render the store is
 *    empty even for a signed-in admin, so redirecting before hydration would
 *    bounce a real session to `/login` on every hard refresh.
 * 2. Require a token *and* the `admin` role. Holding a token is not enough —
 *    the backend rejects every other role inside
 *    `ApprovalsService.requireAdmin`, so letting them in would only produce a
 *    wall of 403s.
 *
 * This is a UX gate, not a security boundary. The API re-checks the JWT on
 * every request regardless of what this component decides.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const tCommon = useTranslations('common');
  const router = useRouter();

  const isHydrated = useAuthStore((state) => state.isHydrated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);

  const canAccess = isAdminSession({ accessToken, user });

  useEffect(() => {
    if (!isHydrated || canAccess) return;

    router.replace('/login');
  }, [isHydrated, canAccess, router]);

  if (!isHydrated || !canAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="text-caption text-ink-muted">{tCommon('loading')}</p>
      </div>
    );
  }

  return <>{children}</>;
}
