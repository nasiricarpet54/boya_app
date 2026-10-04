import { setRequestLocale } from 'next-intl/server';

import { redirect } from '@/lib/navigation';

/**
 * `/fa` has nothing to show on its own, so it forwards to the dashboard.
 * `redirect` from `@/lib/navigation` keeps the active locale prefix; the plain
 * `next/navigation` one would drop it and bounce through the middleware.
 */
export default function LocaleIndexPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);

  redirect({ href: '/dashboard', locale: params.locale });
}
