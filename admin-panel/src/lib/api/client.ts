import axios from 'axios';

import { DEFAULT_API_URL, TOKEN_STORAGE_KEY } from '../constants';
import { defaultLocale, isLocale } from '../../routing';

/**
 * Reads the persisted session out of storage.
 *
 * The key holds the whole Zustand-persist envelope
 * (`{"state":{"accessToken":…,"refreshToken":…}}`), so the interceptors read
 * storage directly rather than importing the store — the axios instance is
 * created at module scope, before any React context exists, and a bare token
 * is still accepted for a future token-only migration.
 */
export function readStoredTokens(): {
  accessToken: string | null;
  refreshToken: string | null;
  refreshExpiresAt: string | null;
} {
  const empty = { accessToken: null, refreshToken: null, refreshExpiresAt: null };
  if (typeof window === 'undefined') return empty;

  const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return empty;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed === 'string') return { ...empty, accessToken: parsed || null };

    if (parsed && typeof parsed === 'object') {
      const envelope = parsed as {
        state?: { accessToken?: unknown; token?: unknown; refreshToken?: unknown; refreshExpiresAt?: unknown };
        accessToken?: unknown;
        token?: unknown;
        refreshToken?: unknown;
        refreshExpiresAt?: unknown;
      };
      const state = envelope.state ?? envelope;
      const access = state.accessToken ?? state.token;
      const refresh = state.refreshToken;
      return {
        accessToken: typeof access === 'string' && access ? access : null,
        refreshToken: typeof refresh === 'string' && refresh ? refresh : null,
        refreshExpiresAt:
          typeof state.refreshExpiresAt === 'string' ? state.refreshExpiresAt : null,
      };
    }
  } catch {
    // Not JSON — the key holds a raw token.
    return { ...empty, accessToken: raw };
  }

  return empty;
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

/** A bare client for the refresh call, so it cannot re-enter this interceptor. */
const refreshClient = axios.create({
  baseURL: (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, ''),
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Non-null while a rotation is in flight. Concurrent 401s must share one
 * refresh: refresh tokens are single-use, so two parallel rotations make the
 * second look like a reuse of the first and the server revokes the whole family
 * — signing the admin out for no reason.
 */
let refreshInFlight: Promise<string> | null = null;

interface RefreshPayload {
  accessToken?: string;
  refreshToken?: string;
  refreshExpiresAt?: string;
}

async function rotateOnce(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;

  const run = (async () => {
    const { refreshToken } = readStoredTokens();
    if (!refreshToken) throw new Error('no refresh token');

    const response = await refreshClient.post<RefreshPayload>('/auth/refresh', {
      refreshToken,
    });

    const data = response.data;
    if (!data?.accessToken || !data.refreshToken) throw new Error('incomplete rotation');

    // Written straight to the persist envelope: the interceptor lives outside
    // React, so the Zustand store is not in scope here. `setTokens` on the store
    // is the same write, done through the normal path on the next render.
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      let user: unknown = null;
      if (raw) {
        try {
          user = (JSON.parse(raw) as { state?: { user?: unknown } })?.state?.user ?? null;
        } catch {
          user = null;
        }
      }
      window.localStorage.setItem(
        TOKEN_STORAGE_KEY,
        JSON.stringify({
          state: {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            refreshExpiresAt: data.refreshExpiresAt ?? null,
            user,
          },
          version: 1,
        }),
      );
    }

    return data.accessToken;
  })();

  refreshInFlight = run;
  try {
    return await run;
  } finally {
    refreshInFlight = null;
  }
}

export const api = axios.create({
  baseURL: (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, ''),
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const { accessToken } = readStoredTokens();

  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    // `JwtAuthGuard` answers 401 for a missing, malformed or expired token.
    // Every other failure (403 for a non-admin, 400 for a bad OTP, 429 for the
    // rate limit) is a real answer to a real question and must reach the UI.
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // The auth endpoints are excluded: a 401 from `/auth/refresh` is the
    // answer itself, and the OTP paths answer 401 for a wrong code.
    const url = error.config?.url ?? '';
    if (url.startsWith('/auth/')) {
      return Promise.reject(error);
    }

    try {
      await rotateOnce();
      // The rotated token is in storage now, so replaying through the same
      // instance re-runs the request interceptor and picks it up.
      const original = error.config;
      if (!original) return Promise.reject(error);
      original.headers = original.headers ?? {};
      if (typeof original.headers.set === 'function') {
        original.headers.set('Authorization', `Bearer ${readStoredTokens().accessToken ?? ''}`);
      }
      return api.request(original);
    } catch (refreshError) {
      // No refresh token, or the server rejected it (including reuse
      // detection, which revokes the family). The session is gone.
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  },
);

export default api;
