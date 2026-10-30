'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { NAV_SECTIONS } from './nav-items';
import { useAuthStore } from '@/lib/stores/auth';
import { dashboardApi } from '@/lib/api/dashboard';
import { useSignOut } from '@/lib/api/sign-out';
import { Link, usePathname } from '@/lib/navigation';
import { cn } from '@/lib/utils/cn';
import { faNumber } from '@/lib/utils/persian';
import { BoyaLogo } from '@/components/ui/BoyaLogo';

/**
 * Right-hand sidebar. In an RTL document "right" is the *start* edge, which is
 * why the shell anchors it with `border-e` and the brand rail uses `border-s` —
 * logical properties, never left/right.
 */
export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const pathname = usePathname();
  const handleLogout = useSignOut();

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

  return (
    
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-ink/40 md:hidden" onClick={onClose} aria-hidden />
      )}
      <aside className={cn("fixed inset-y-0 right-0 z-50 flex h-screen w-72 shrink-0 flex-col overflow-hidden border-e border-line bg-surface transition-transform duration-300 ease-in-out md:sticky md:top-0 md:translate-x-0", isOpen ? "translate-x-0" : "translate-x-full")}>

      <div className="flex h-16 items-center gap-3 border-b border-line px-4 pe-6">
        <BoyaLogo className="h-10 w-auto max-w-[120px] shrink-0 object-contain" title={tCommon('appName')} />
        <div className="min-w-0">
          <p className="truncate text-title font-bold text-ink">{tCommon('appName')}</p>
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
                const child = item.children?.find((c) => pathname === c.href);
                const isActive = pathname === item.href || Boolean(child);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex h-11 items-center gap-3 rounded-md px-3 text-body transition-colors',
                        isActive
                          ? 'bg-brand-subtle font-semibold text-brand-primary'
                          : 'text-ink-muted hover:bg-brand-subtle/60 hover:text-ink',
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden />
                      <span className="flex-1 truncate">{tNav(item.labelKey)}</span>

                      {item.showsApprovalBadge && isFetched && pendingCount > 0 ? (
                        <span
                          className="min-w-6 rounded-full bg-brand-primary px-1.5 py-0.5 text-center text-overline font-semibold text-white"
                          title={tNav('approvals')}
                        >
                          {faNumber(pendingCount)}
                        </span>
                      ) : null}
                    </Link>

                    {item.children ? (
                      <ul className="mt-1 space-y-1 pe-4 ps-8">
                        {item.children.map((childItem) => {
                          const childIsActive = pathname === childItem.href;
                          const ChildIcon = childItem.icon;

                          return (
                            <li key={childItem.href}>
                              <Link
                                href={childItem.href}
                                aria-current={childIsActive ? 'page' : undefined}
                                className={cn(
                                  'flex h-10 items-center gap-3 rounded-md px-3 text-caption transition-colors',
                                  childIsActive
                                    ? 'bg-brand-subtle font-semibold text-brand-primary'
                                    : 'text-ink-muted hover:bg-brand-subtle/60 hover:text-ink',
                                )}
                              >
                                <ChildIcon className="h-4 w-4 shrink-0" aria-hidden />
                                <span className="flex-1 truncate">
                                  {tNav(childItem.labelKey)}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
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
    </>
  );
}
