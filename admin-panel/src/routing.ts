import { defineRouting } from 'next-intl/routing';

/**
 * Locales for the BOYA panel. `fa` is the product default: the charter makes
 * Persian the UI language and RTL the product direction.
 */
export const locales = ['fa', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'fa';

export const routing = defineRouting({
  locales,
  defaultLocale,
  // `/` serves `/fa` so the middleware never has to guess a locale from the
  // Accept-Language header (a Persian phone opening the panel must land on
  // Persian, not on whatever the browser asked for).
  localePrefix: 'always',
});

/** Type guard for values coming from the dynamic `[locale]` segment. */
export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
