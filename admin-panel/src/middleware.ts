import createMiddleware from 'next-intl/middleware';

import { routing } from './routing';

/**
 * Puts a locale prefix on every request and keeps `/fa` as the landing page.
 * See `routing.localePrefix` for why `Accept-Language` is not consulted.
 */
export default createMiddleware(routing);

export const config = {
  matcher: [
    // Everything except Next internals and files with an extension (assets,
    // `favicon.ico`, `robots.txt`). A path without a dot is a route.
    '/((?!_next|.*\\..*).*)',
  ],
};
