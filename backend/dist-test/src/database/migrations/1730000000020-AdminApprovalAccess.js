"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminApprovalAccess1730000000020 = void 0;
class AdminApprovalAccess1730000000020 {
    name = 'AdminApprovalAccess1730000000020';
    async up(queryRunner) {
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
        await queryRunner.query(`REVOKE ALL ON FUNCTION admin_list_service_line_approvals(approval_status) FROM PUBLIC;`);
        await queryRunner.query(`GRANT EXECUTE ON FUNCTION admin_list_service_line_approvals(approval_status) TO beauty_app;`);
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
        await queryRunner.query(`REVOKE ALL ON FUNCTION admin_get_service_line_approval(UUID) FROM PUBLIC;`);
        await queryRunner.query(`GRANT EXECUTE ON FUNCTION admin_get_service_line_approval(UUID) TO beauty_app;`);
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
        await queryRunner.query(`REVOKE ALL ON FUNCTION admin_apply_service_line_approval(UUID, approval_status, UUID, TEXT) FROM PUBLIC;`);
        await queryRunner.query(`GRANT EXECUTE ON FUNCTION admin_apply_service_line_approval(UUID, approval_status, UUID, TEXT) TO beauty_app;`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP FUNCTION IF EXISTS admin_apply_service_line_approval(UUID, approval_status, UUID, TEXT)`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS admin_get_service_line_approval(UUID)`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS admin_list_service_line_approvals(approval_status)`);
    }
}
exports.AdminApprovalAccess1730000000020 = AdminApprovalAccess1730000000020;
