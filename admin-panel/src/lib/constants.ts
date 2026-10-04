/**
 * Shared constants that both the axios client and the auth store need.
 *
 * They live apart from `lib/api/client.ts` on purpose: the 401 interceptor has
 * to clear storage, and importing the Zustand store back into the client to do
 * that would close a cycle (store -> constants <- client, and store -> client).
 */

export const TOKEN_STORAGE_KEY = 'boya_admin_token';

/** Matches `API_PREFIX` in `backend/src/main.ts`, which defaults to `api/v1`. */
export const DEFAULT_API_URL = 'http://localhost:3000/api/v1';

/** The only role this panel accepts. `ApprovalsService.requireAdmin` agrees. */
export const ADMIN_ROLE = 'admin';
