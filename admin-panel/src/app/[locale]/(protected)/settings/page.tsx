'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Check, Moon, Sun } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { useTheme } from '@/components/providers/ThemeProvider';
import { usePathname, useRouter } from '@/lib/navigation';
import { useAuthStore } from '@/lib/stores/auth';
import { faDigits } from '@/lib/utils/persian';
import { locales, type Locale } from '@/routing';

const LOCALE_LABEL: Record<Locale, string> = { fa: 'فارسی', en: 'English' };

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const user = useAuthStore((s) => s.user);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="flex flex-col gap-4">
        <Card>
          <CardTitle>{t('profile.title')}</CardTitle>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-overline text-ink-muted">{t('profile.phone')}</p>
              <p className="mt-1 text-body text-ink" dir="ltr">
                {user?.phoneNumber ? faDigits(user.phoneNumber) : ''}
              </p>
            </div>
            <div>
              <p className="text-overline text-ink-muted">{t('profile.name')}</p>
              <p className="mt-1 text-body text-ink">
                {user?.fullName ?? t('profile.nameEmpty')}
              </p>
            </div>
            <div>
              <p className="text-overline text-ink-muted">{t('profile.role')}</p>
              <div className="mt-1">
                {user?.role ? (
                  <Badge tone="brand">{t(`roles.${user.role}`)}</Badge>
                ) : (
                  <span className="text-body text-ink"></span>
                )}
              </div>
            </div>
            <div>
              <p className="text-overline text-ink-muted">{t('profile.tenant')}</p>
              <p className="mt-1 text-body text-ink" dir="ltr">
                {user?.tenantId ?? t('profile.tenantEmpty')}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>{t('preferences.title')}</CardTitle>
          <div className="mt-3 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-body text-ink">{t('preferences.theme')}</p>
                <p className="text-caption text-ink-muted">
                  {theme === 'dark' ? t('preferences.themeDark') : t('preferences.themeLight')}
                </p>
              </div>
              <Button variant="secondary" onClick={toggleTheme}>
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4" aria-hidden />
                ) : (
                  <Moon className="h-4 w-4" aria-hidden />
                )}
                {t('preferences.toggleTheme')}
              </Button>
            </div>

            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <p className="text-body text-ink">{t('preferences.language')}</p>
              <div className="flex gap-2">
                {locales.map((candidate) => (
                  <Button
                    key={candidate}
                    size="sm"
                    variant={candidate === locale ? 'primary' : 'secondary'}
                    onClick={() => router.replace(pathname, { locale: candidate })}
                  >
                    {candidate === locale ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : null}
                    {LOCALE_LABEL[candidate]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle>{t('comingSoon.title')}</CardTitle>
          <p className="mt-2 text-body text-ink-muted">{t('comingSoon.description')}</p>
        </Card>
      </div>

      <p className="mt-6 text-center text-overline text-ink-muted">{tCommon('appName')}</p>
    </>
  );
}