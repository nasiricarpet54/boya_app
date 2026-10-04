import { EntityManager, QueryRunner } from 'typeorm';

/**
 * Single place that opens the tenant scope for a transaction.
 *
 * Standard GUC is `app.tenant_id` (migration 1730000000026 unified every
 * tenant policy onto it). Transaction-local (`set_config(..., true)`) so the
 * value never leaks onto the pooled connection.
 */
export async function setTenantContext(
  qr: QueryRunner | EntityManager,
  tenantId: string,
): Promise<void> {
  await qr.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
}
