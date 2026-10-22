import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { QueryProvider } from '@/components/providers/QueryProvider';
import { ThemeProvider, THEME_STORAGE_KEY } from '@/components/providers/ThemeProvider';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { isLocale, routing } from '@/routing';
import '../globals.css';

/**
 * Vazirmatn is the product UI font for every BOYA surface. It is bundled from
 * `src/fonts` with `next/font/local` rather than `next/font/google` for two
 * reasons: the design system allows exactly these four weights, and a local
 * build makes no network call at build time, so CI and the offline VPS deploy
 * never depend on Google Fonts being reachable.
 *
 * The files are the official `webfonts` builds from the rastikerdar/vazirmatn
 * release, and each covers both the Arabic and Latin ranges, so Persian text
 * and the Persian numerals rendered here share one family.
 */
const vazirmatn = localFont({
  src: [
    { path: '../../fonts/Vazirmatn-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../fonts/Vazirmatn-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../fonts/Vazirmatn-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../../fonts/Vazirmatn-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-vazirmatn',
  display: 'swap',
  fallback: ['Vazirmatn', 'system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'بویا | پنل مدیریت',
  description: 'پنل مدیریت پلتفرم بویا',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8F9FA' },
    { media: '(prefers-color-scheme: dark)', color: '#12121C' },
  ],
};

/** Pre-paint theme application, mirroring `readInitialTheme` in ThemeProvider. */
const THEME_SCRIPT = `(function(){try{var k=${JSON.stringify(
  THEME_STORAGE_KEY,
)};var s=localStorage.getItem(k);var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

/** Renders both locales ahead of time; `dynamicParams` rejects anything else. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  // Next 14 passes a plain object here; it becomes a Promise in Next 15.
  params: { locale: string };
}) {
  if (!isLocale(params.locale)) {
    notFound();
  }

  // Opts these pages into static rendering instead of a per-request
  // `getRequestConfig` call.
  setRequestLocale(params.locale);

  const messages = await getMessages();

  return (
    <html
      lang={params.locale}
      // Persian is RTL, English LTR. Hard-coding `rtl` would break the `en`
      // catalogue, so direction follows the locale.
      dir={params.locale === 'fa' ? 'rtl' : 'ltr'}
      className={vazirmatn.variable}
      // The script below mutates `className` before React hydrates.
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-cream font-vazirmatn text-ink antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />

        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <ThemeProvider>
              <ToastProvider>{children}</ToastProvider>
            </ThemeProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
