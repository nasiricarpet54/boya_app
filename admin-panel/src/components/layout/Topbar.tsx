'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarDays, Check, Globe, LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuthStore } from '@/lib/stores/auth';
import { usePathname, useRouter } from '@/lib/navigation';
import { useTheme } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/utils/cn';
import { faNumber } from '@/lib/utils/persian';
import { jalaliDateWithWeekday } from '@/lib/utils/jalali';
import { locales, type Locale } from '@/routing';

const LOCALE_LABEL: Record<Locale, string> = { fa: 'فارسی', en: 'English' };

const MENU_ITEM =
  'flex h-10 w-full cursor-pointer select-none items-center gap-3 rounded-sm px-3 text-body text-ink outline-none transition-colors data-[highlighted]:bg-brand-subtle';

export function Topbar() {
  const tTopbar = useTranslations('topbar');
  const tAuth = useTranslations('auth');
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { theme, toggleTheme } = useTheme();

  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  // The calendar day is a function of the machine's time zone, so rendering it
  // during SSR and again on the client can disagree across the midnight line.
  // Waiting for mount keeps the markup identical on both passes.
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setToday(jalaliDateWithWeekday(new Date()));
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-6">
      <p className="flex items-center gap-2 text-caption text-ink-muted">
        <CalendarDays className="h-4 w-4" aria-hidden />
        {/* Reserved width keeps the bar from shifting once the date arrives. */}
        <span className="tabular-nums">{today ?? '—'}</span>
      </p>

      <div className="flex items-center gap-2">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="flex h-11 items-center gap-3 rounded-md px-3 text-body text-ink transition-colors hover:bg-brand-subtle"
            >
              <span
                aria-hidden
                className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-subtle text-ink-muted"
              >
                <UserRound className="h-4 w-4" />
              </span>
              <span className="hidden sm:inline">{faNumber(user?.phoneNumber ?? '')}</span>
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 min-w-56 rounded-lg border border-line bg-surface p-1 shadow-2"
            >
              <DropdownMenu.Label className="px-3 py-2 text-caption text-ink-muted">
                {tTopbar('loggedInAs', { phone: user?.phoneNumber ?? '' })}
              </DropdownMenu.Label>

              <DropdownMenu.Separator className="my-1 h-px bg-line" />

              <DropdownMenu.Item
                className={MENU_ITEM}
                onSelect={toggleTheme}
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <Moon className="h-4 w-4 shrink-0" aria-hidden />
                )}
                <span className="flex-1">
                  {tTopbar('theme')}:{' '}
                  {theme === 'dark' ? tTopbar('themeDark') : tTopbar('themeLight')}
                </span>
              </DropdownMenu.Item>

              <DropdownMenu.Label className="px-3 pb-1 pt-2 text-overline text-ink-muted">
                {tTopbar('language')}
              </DropdownMenu.Label>

              {locales.map((candidate) => (
                <DropdownMenu.Item
                  key={candidate}
                  className={cn(MENU_ITEM, 'h-9')}
                  // Keeps the current path and swaps only the prefix.
                  onSelect={() => router.replace(pathname, { locale: candidate })}
                >
                  <Globe className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="flex-1">{LOCALE_LABEL[candidate]}</span>
                  {candidate === locale ? (
                    <Check className="h-4 w-4 text-brand-copper" aria-hidden />
                  ) : null}
                </DropdownMenu.Item>
              ))}

              <DropdownMenu.Separator className="my-1 h-px bg-line" />

              <DropdownMenu.Item
                className={cn(MENU_ITEM, 'text-error data-[highlighted]:bg-error/10')}
                onSelect={() => {
                  logout();
                  router.replace('/login');
                }}
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                <span>{tAuth('logout')}</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
