import { EntityManager, QueryRunner } from 'typeorm';

/**
 * Opens the tenant scope for a transaction.
 */
export async function setTenantContext(
  qr: QueryRunner | EntityManager,
  tenantId: string,
): Promise<void> {
  await qr.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
}

/**
 * Opens the *user* scope, used by user-scoped tables such as `refresh_tokens` and RLS isolation policies.
 */
export async function setUserContext(
  qr: QueryRunner | EntityManager,
  userId: string,
): Promise<void> {
  await qr.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
}

/**
 * Opens the *role* scope to let RLS differentiate between owner/admin and specialist roles.
 */
export async function setRoleContext(
  qr: QueryRunner | EntityManager,
  role: string,
): Promise<void> {
  await qr.query(`SELECT set_config('app.current_role', $1, true)`, [role]);
}
