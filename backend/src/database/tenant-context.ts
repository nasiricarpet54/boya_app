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
  await qr.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
}

/**
 * Opens the *user* scope, used by user-scoped tables such as `refresh_tokens`.
 *
 * ADR-001 unified every tenant policy onto `app.current_tenant_id`, but a
 * customer has no tenant (ADR-005 made `users.tenant_id` nullable), so a
 * tenant-only key cannot express "the rows that belong to this caller". Policies
 * on user-scoped tables therefore read `app.current_user_id`, set here with the
 * same transaction-local semantics as the tenant GUC so the value never leaks
 * onto the pooled connection.
 *
 * Empty is stored as '' and every policy wraps it in NULLIF, matching the
 * tenant convention, so an unset scope reads as "no rows" instead of raising on
 * a bad uuid cast.
 */
export async function setUserContext(
  qr: QueryRunner | EntityManager,
  userId: string,
): Promise<void> {
  await qr.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
}
