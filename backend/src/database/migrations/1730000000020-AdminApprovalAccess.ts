import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin approval reads and writes across every tenant.
 *
 * `tenants` and `specialists` carry no row-level security, so the admin
 * endpoints in `modules/admin/approvals` can read and update them with plain
 * SQL. `service_lines` cannot: migration 1730000000003 put it behind
 * `ENABLE + FORCE ROW LEVEL SECURITY` with
 * `service_lines_tenant_isolation` (`tenant_id = app.tenant_id`).
 *
 * An admin's JWT carries `tenantId = null` — admins are not tenant-scoped —
 * so with no setting on the connection PostgreSQL filters the table down to
 * zero rows. Both the SELECT and the UPDATE would then "succeed" while
 * silently affecting nothing, which is worse than an error for a moderation
 * queue: a pending line would never be reviewable or approvable.
 *
 * The fix widens nothing and follows the pattern migrations 1730000000008,
 * 1730000000009 and 1730000000014 already established: the cross-tenant work
 * happens inside SECURITY DEFINER functions owned by the migration role, which
 * bypasses the policy the API role is subject to. Each function is
 * non-executable by PUBLIC and granted only to `beauty_app`, and each one
 * touches exactly the approval columns.
 *
 * `admin_apply_service_line_approval` is deliberately the only way to write:
 * it takes the target status as a parameter and stamps `approved_at` /
 * `approved_by` itself, so the approved-by column cannot be forged by a caller
 * that forgets it.
 */
export class AdminApprovalAccess1730000000020 implements MigrationInterface {
  name = 'AdminApprovalAccess1730000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The queue, oldest first so the admin works the backlog in arrival order.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION admin_list_service_line_approvals(
        p_status approval_status
      )
      RETURNS TABLE (
        id UUID,
        tenant_id UUID,
        name VARCHAR,
        description TEXT,
        status approval_status,
        rejection_reason TEXT,
        approved_at TIMESTAMPTZ,
        approved_by UUID,
        created_at TIMESTAMPTZ
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT sl.id,
               sl.tenant_id,
               sl.name,
               sl.description,
               sl.status,
               sl.rejection_reason,
               sl.approved_at,
               sl.approved_by,
               sl.created_at
        FROM service_lines sl
        WHERE sl.status = p_status
        ORDER BY sl.created_at ASC, sl.id ASC
      $$;
    `);
    await queryRunner.query(
      `REVOKE ALL ON FUNCTION admin_list_service_line_approvals(approval_status) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION admin_list_service_line_approvals(approval_status) TO beauty_app;`,
    );

    // Single-row read behind GET /admin/approvals/:type/:id.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION admin_get_service_line_approval(
        p_id UUID
      )
      RETURNS TABLE (
        id UUID,
        tenant_id UUID,
        name VARCHAR,
        description TEXT,
        status approval_status,
        rejection_reason TEXT,
        approved_at TIMESTAMPTZ,
        approved_by UUID,
        created_at TIMESTAMPTZ
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT sl.id,
               sl.tenant_id,
               sl.name,
               sl.description,
               sl.status,
               sl.rejection_reason,
               sl.approved_at,
               sl.approved_by,
               sl.created_at
        FROM service_lines sl
        WHERE sl.id = p_id
      $$;
    `);
    await queryRunner.query(
      `REVOKE ALL ON FUNCTION admin_get_service_line_approval(UUID) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION admin_get_service_line_approval(UUID) TO beauty_app;`,
    );
    // Approve / reject. Returns FALSE when the id does not exist so the caller
    // can turn that into a 404 instead of reporting a success that changed
    // nothing. service_lines has no pending_changes column (1730000000018 adds
    // it to tenants only), so there is nothing to merge here: approving a line
    // is the status flip and nothing more.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION admin_apply_service_line_approval(
        p_id UUID,
        p_status approval_status,
        p_approved_by UUID DEFAULT NULL,
        p_rejection_reason TEXT DEFAULT NULL
      )
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      DECLARE
        v_affected INTEGER;
      BEGIN
        UPDATE service_lines sl
           SET status = p_status,
               rejection_reason = CASE
                 WHEN p_status = 'rejected' THEN p_rejection_reason
                 ELSE NULL
               END,
               -- Only stamping on approve; on reject the previous approval is
               -- left in place, exactly as ApprovalsService.reject does for
               -- tenants. A denial of this request is not a retraction of an
               -- earlier one.
               approved_at = CASE
                 WHEN p_status = 'approved' THEN NOW()
                 ELSE sl.approved_at
               END,
               approved_by = CASE
                 WHEN p_status = 'approved' THEN p_approved_by
                 ELSE sl.approved_by
               END
         WHERE sl.id = p_id;

        GET DIAGNOSTICS v_affected = ROW_COUNT;
        RETURN v_affected > 0;
      END;
      $$;
    `);
    await queryRunner.query(
      `REVOKE ALL ON FUNCTION admin_apply_service_line_approval(UUID, approval_status, UUID, TEXT) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION admin_apply_service_line_approval(UUID, approval_status, UUID, TEXT) TO beauty_app;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS admin_apply_service_line_approval(UUID, approval_status, UUID, TEXT)`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS admin_get_service_line_approval(UUID)`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS admin_list_service_line_approvals(approval_status)`,
    );
  }
}