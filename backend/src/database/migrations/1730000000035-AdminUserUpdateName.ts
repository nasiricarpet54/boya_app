import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin user name edit (PATCH /admin/users/:id).
 *
 * `users` is FORCE ROW LEVEL SECURITY on `app.current_tenant_id`, and an admin
 * JWT carries no tenant (admins have `tenant_id = NULL`), so a plain UPDATE
 * from the API role would be filtered to zero rows — the same reason
 * migrations 1730000000024 and 1730000000034 route the read/write surface
 * through SECURITY DEFINER functions. `full_name` is the only editable field
 * here: `role`, `is_active` and `tenant_id` each already have a dedicated
 * endpoint with their own guardrails (self-edit refusal, last-admin
 * protection), so this function deliberately stays narrow.
 *
 * Returns whether a `users` row was actually hit, mirroring the boolean
 * contract of `admin_apply_user_status` / `admin_soft_delete_user`, so the
 * caller can turn a missing user into a 404 rather than a silent success.
 * `audit_logs` carries no RLS, so the trail row stays plain SQL in the service.
 */
export class AdminUserUpdateName1730000000035 implements MigrationInterface {
  name = 'AdminUserUpdateName1730000000035';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION admin_update_user_full_name(
        p_id UUID,
        p_full_name VARCHAR
      )
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      DECLARE
        v_affected INTEGER;
      BEGIN
        UPDATE users u
           SET full_name = p_full_name
         WHERE u.id = p_id;

        GET DIAGNOSTICS v_affected = ROW_COUNT;
        RETURN v_affected > 0;
      END;
      $$;
    `);
    await queryRunner.query(
      `REVOKE ALL ON FUNCTION admin_update_user_full_name(UUID, VARCHAR) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION admin_update_user_full_name(UUID, VARCHAR) TO beauty_app;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS admin_update_user_full_name(UUID, VARCHAR)`,
    );
  }
}
