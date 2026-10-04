'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { useCallback } from 'react';

import { NAV_SECTIONS } from './nav-items';
import { useAuthStore } from '@/lib/stores/auth';
import { dashboardApi } from '@/lib/api/dashboard';
import { Link, usePathname, useRouter } from '@/lib/navigation';
import { cn } from '@/lib/utils/cn';
import { faNumber } from '@/lib/utils/persian';

/**
 * Right-hand sidebar. In an RTL document "right" is the *start* edge, which is
 * why the shell anchors it with `border-e` and the brand rail uses `border-s` —
 * logical properties, never left/right.
 */
export function Sidebar() {
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  // The badge is the one place the panel polls on a timer. It stays silent on
  // failure: a missing badge beats an error banner blocking the whole nav.
  // The query is shared with the dashboard page (`admin-dashboard`), so an
  // approve/reject that invalidates it refreshes this badge too.
  // `isFetched` gates the count so the item does not claim "zero waiting"
  // during the first request.
  const { data: dashboard, isFetched } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => dashboardApi.getDashboard(),
    retry: false,
    refetchInterval: 60_000,
  });

  const pendingCount = dashboard?.stats.pendingApprovals ?? 0;

  const handleLogout = useCallback(() => {
    logout();
    router.replace('/login');
  }, [logout, router]);

  return (
    <aside className="sticky top-0 flex h-screen w-72 shrink-0 flex-col overflow-hidden border-e border-line bg-surface">
      <div className="flex h-16 items-center gap-3 border-b border-line px-6">
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-copper text-body font-bold text-white"
        >
          ب
        </span>
        <div className="min-w-0">
          <p className="text-title font-bold text-ink">{tCommon('panelName')}</p>
          <p className="truncate text-overline text-ink-muted">{tCommon('tagline')}</p>
        </div>
      </div>

      <nav aria-label={tCommon('panelName')} className="flex-1 overflow-y-auto p-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.titleKey} className="mb-6 last:mb-0">
            <p className="px-3 pb-2 text-overline font-medium text-ink-muted">
              {tNav(section.titleKey)}
            </p>

            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex h-11 items-center gap-3 rounded-md px-3 text-body transition-colors',
                        isActive
                          ? 'bg-brand-subtle font-semibold text-brand-copper'
                          : 'text-ink-muted hover:bg-brand-subtle/60 hover:text-ink',
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden />
                      <span className="flex-1 truncate">{tNav(item.labelKey)}</span>

                      {item.showsApprovalBadge && isFetched && pendingCount > 0 ? (
                        <span
                          className="min-w-6 rounded-full bg-brand-copper px-1.5 py-0.5 text-center text-overline font-semibold text-white"
                          title={tNav('approvals')}
                        >
                          {faNumber(pendingCount)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-body text-ink-muted transition-colors hover:bg-error/10 hover:text-error"
        >
          <LogOut className="h-5 w-5 shrink-0" aria-hidden />
          <span>{tAuth('logout')}</span>
        </button>
      </div>
    </aside>
  );
}
