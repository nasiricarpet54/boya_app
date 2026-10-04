import axios from 'axios';

import { DEFAULT_API_URL, TOKEN_STORAGE_KEY } from '../constants';
import { defaultLocale, isLocale } from '../../routing';

/**
 * Reads the access token out of storage.
 *
 * The key holds the whole Zustand-persist envelope (`{"state":{"token":…}}`),
 * but a bare token is accepted too: the interceptor must keep working if the
 * value is ever written by hand or by a future token-only migration.
 */
export function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed === 'string') return parsed || null;

    if (parsed && typeof parsed === 'object') {
      const envelope = parsed as { state?: { token?: unknown }; token?: unknown };
      const token = envelope.state?.token ?? envelope.token;
      return typeof token === 'string' && token ? token : null;
    }
  } catch {
    // Not JSON — the key holds a raw token.
    return raw;
  }

  return null;
}

/** Locale of the page the panel is currently on, so a redirect stays prefixed. */
function currentLocale(): string {
  if (typeof window === 'undefined') return defaultLocale;

  const segment = window.location.pathname.split('/').filter(Boolean)[0];
  return segment && isLocale(segment) ? segment : defaultLocale;
}

/**
 * Sends the browser to the login page of the current locale.
 *
 * `replace` rather than `assign` so the guarded URL does not stay in history
 * and a back-button press cannot bounce the admin into the redirect loop. The
 * guard against re-entering `/login` keeps the 401 → redirect → 401 cycle from
 * spinning on the login request itself.
 */
function redirectToLogin(): void {
  if (typeof window === 'undefined') return;

  const locale = currentLocale();
  const path = window.location.pathname;

  if (path === `/${locale}/login` || path === '/login') return;

  window.location.replace(`/${locale}/login`);
}

export const api = axios.create({
  baseURL: (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, ''),
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = readStoredToken();

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    // `JwtAuthGuard` answers 401 for a missing, malformed or expired token.
    // Every other failure (403 for a non-admin, 400 for a bad OTP, 429 for the
    // rate limit) is a real answer to a real question and must reach the UI.
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      redirectToLogin();
    }

    return Promise.reject(error);
  },
);

export default api;
