import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin user create + soft-delete (POST /admin/users, DELETE /admin/users/:id).
 *
 * `users` is FORCE ROW LEVEL SECURITY on `app.current_tenant_id`, and an admin
 * JWT carries no tenant (admins have `tenant_id = NULL`), so a plain
 * INSERT/UPDATE from the API role would be filtered to zero rows — the same
 * reason migration 1730000000024 routes the read/write surface through SECURITY
 * DEFINER functions. `specialists` carries no RLS, but its write rides inside
 * the definer so the create/soft-delete pair stays atomic.
 *
 * `audit_logs` carries no RLS, so the trail rows stay plain SQL in the service.
 */
export class AdminUserCreateDelete1730000000034 implements MigrationInterface {
  name = 'AdminUserCreateDelete1730000000034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create a user of any role. When the role is `specialist` and a tenant is
    // named, the matching `specialists` row is created in the same call (the
    // auto-add pattern used by invite-accept and the panel): approved, active,
    // default commission. Returns the new user id.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION admin_create_user(
        p_phone VARCHAR,
        p_role VARCHAR,
        p_full_name VARCHAR DEFAULT NULL,
        p_tenant_id UUID DEFAULT NULL
      )
      RETURNS UUID
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      DECLARE
        v_user_id UUID;
      BEGIN
        INSERT INTO users (phone, role, full_name, tenant_id, is_active)
        VALUES (p_phone, p_role, p_full_name, p_tenant_id, true)
        RETURNING id INTO v_user_id;

        IF p_role = 'specialist' AND p_tenant_id IS NOT NULL THEN
          INSERT INTO specialists (tenant_id, user_id, commission_rate, is_active, status)
          VALUES (p_tenant_id, v_user_id, 50, true, 'approved');
        END IF;

        RETURN v_user_id;
      END;
      $$;
    `);
    await queryRunner.query(
      `REVOKE ALL ON FUNCTION admin_create_user(VARCHAR, VARCHAR, VARCHAR, UUID) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION admin_create_user(VARCHAR, VARCHAR, VARCHAR, UUID) TO beauty_app;`,
    );

    // Soft-delete: flip the user inactive and, if they are a specialist, the
    // matching `specialists` row too. Returns whether a `users` row was hit,
    // mirroring admin_apply_user_status's boolean contract.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION admin_soft_delete_user(p_id UUID)
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      DECLARE
        v_affected INTEGER;
      BEGIN
        UPDATE users u
           SET is_active = false
         WHERE u.id = p_id;

        GET DIAGNOSTICS v_affected = ROW_COUNT;
        IF v_affected > 0 THEN
          UPDATE specialists s
             SET is_active = false
           WHERE s.user_id = p_id;
        END IF;

        RETURN v_affected > 0;
      END;
      $$;
    `);
    await queryRunner.query(
      `REVOKE ALL ON FUNCTION admin_soft_delete_user(UUID) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION admin_soft_delete_user(UUID) TO beauty_app;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS admin_soft_delete_user(UUID)`);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS admin_create_user(VARCHAR, VARCHAR, VARCHAR, UUID)`,
    );
  }
}
