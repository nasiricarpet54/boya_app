import { createNavigation } from 'next-intl/navigation';

import { routing } from '../routing';

/**
 * Locale-aware replacements for `next/link` and `next/navigation`.
 *
 * Callers write `href="/dashboard"` and get `/fa/dashboard`; switching locale
 * is `router.replace(pathname, { locale: 'en' })` instead of hand-rolled string
 * concatenation. Using the plain Next.js versions anywhere would silently drop
 * the locale prefix and bounce through the middleware.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
