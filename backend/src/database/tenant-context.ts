import { EntityManager, QueryRunner } from 'typeorm';

/**
 * Single place that opens the tenant scope for a transaction.
 *
 * Standard GUC is `app.current_tenant_id` (migration 1730000000026 unified every
 * tenant policy onto it). Transaction-local (`set_config(..., true)`) so the
 * value never leaks onto the pooled connection.
 */
export async function setTenantContext(
  qr: QueryRunner | EntityManager,
  tenantId: string,
): Promise<void> {
  // Using set_config(..., true) enforces the scope is strictly limited to the current
  // transaction, setting `is_local` to `true` to ensure the session variable DOES NOT
  // leak between connection pool requests.
  await qr.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
}

/**
 * Opens the *user* scope, used by user-scoped tables such as `refresh_tokens`.
 */
export async function setUserContext(
  qr: QueryRunner | EntityManager,
  userId: string,
): Promise<void> {
  await qr.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
}
