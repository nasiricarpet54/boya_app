import { getRequestConfig } from 'next-intl/server';

import { isLocale, routing } from './routing';

/**
 * Loads the message catalogue for the active locale.
 *
 * The plugin in `next.config.js` points at this file, which is also what lets
 * `NextIntlClientProvider` and `getTranslations` share one cache entry.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
