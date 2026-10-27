import { createNavigation } from 'next-intl/navigation';

import { routing } from '../routing';

/**
 * Locale-aware replacements for `next/link` and `next/navigation`.
 *
 * Callers write `href="/dashboard"` and get `/fa/dashboard`; switching locale
 * is `router.replace(pathname, { locale: 'en' })` instead of hand-rolled string
 * concatenation. Using the plain Next.js versions anywhere would silently drop
 * the locale prefix and bounce through the middleware.
 *
 * `useSearchParams` is not locale-aware (query strings carry no locale), so it
 * is re-exported as-is for the pages that filter on them.
 */
export const { Link, redirect, usePathname, useRouter, getPathname, useSearchParams } =
  createNavigation(routing);
