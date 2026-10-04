import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin users management (GET /admin/users, GET /admin/users/:id,
 * PATCH /admin/users/:id/role, PATCH /admin/users/:id/status).
 *
 * `users` and `bookings` are both FORCE ROW LEVEL SECURITY on tenant
 * settings an admin JWT does not carry, so plain SELECT/UPDATE from the API
 * role would silently see and affect zero rows. Following the pattern of
 * migrations 1730000000020/22/23, the cross-tenant work happens inside
 * SECURITY DEFINER functions granted only to `beauty_app`.
 *
 * `audit_logs` carries no RLS, so the trail read and the transition writes
 * stay plain SQL in the service. `old_status`/`new_status` are typed as the
 * `approval_status` enum, which cannot hold a user role — role transitions
 * are recorded with action `user.role_changed` / `user.status_changed` and
 * the before/after payload in `reason`, with both status columns NULL.
 */
export class AdminUsers1730000000024 implements MigrationInterface {
  name = 'AdminUsers1730000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION admin_users_all()
      RETURNS TABLE (
        id UUID,
        phone VARCHAR,
        full_name VARCHAR,
        avatar_url TEXT,
        role VARCHAR,
        is_active BOOLEAN,
        tenant_id UUID,
        tenant_name VARCHAR,
        created_at TIMESTAMPTZ,
        bookings_count BIGINT
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT
          u.id,
          u.phone,
          u.full_name,
          u.avatar_url,
          u.role,
          u.is_active,
          u.tenant_id,
          t.name::VARCHAR AS tenant_name,
          u.created_at,
          (SELECT COUNT(*) FROM bookings b WHERE b.customer_id = u.id)
          FROM users u
          LEFT JOIN tenants t ON t.id = u.tenant_id
      $$;
    `);
    await queryRunner.query(
      `REVOKE ALL ON FUNCTION admin_users_all() FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION admin_users_all() TO beauty_app;`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION admin_user_recent_bookings(p_user_id UUID)
      RETURNS TABLE (
        id UUID,
        status TEXT,
        start_at TIMESTAMPTZ,
        end_at TIMESTAMPTZ,
        total_price NUMERIC,
        service_name TEXT,
        specialist_name TEXT,
        tenant_name TEXT,
        created_at TIMESTAMPTZ
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT
          b.id,
          b.status::TEXT,
          lower(b.time_slot)::TIMESTAMPTZ AS start_at,
          upper(b.time_slot)::TIMESTAMPTZ AS end_at,
          b.total_price,
          sv.name::TEXT AS service_name,
          cu.full_name::TEXT AS specialist_name,
          t.name::TEXT AS tenant_name,
          b.created_at
          FROM bookings b
          LEFT JOIN services sv ON sv.id = b.service_id
          LEFT JOIN specialists sp ON sp.id = b.specialist_id
          LEFT JOIN users cu ON cu.id = sp.user_id
          LEFT JOIN tenants t ON t.id = b.tenant_id
         WHERE b.customer_id = p_user_id
         ORDER BY b.created_at DESC, b.id DESC
         LIMIT 5
      $$;
    `);
    await queryRunner.query(
      `REVOKE ALL ON FUNCTION admin_user_recent_bookings(UUID) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION admin_user_recent_bookings(UUID) TO beauty_app;`,
    );
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION admin_apply_user_role(
        p_id UUID,
        p_role VARCHAR,
        p_tenant_id UUID DEFAULT NULL
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
           SET role = p_role,
               tenant_id = p_tenant_id
         WHERE u.id = p_id;

        GET DIAGNOSTICS v_affected = ROW_COUNT;
        RETURN v_affected > 0;
      END;
      $$;
    `);
    await queryRunner.query(
      `REVOKE ALL ON FUNCTION admin_apply_user_role(UUID, VARCHAR, UUID) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION admin_apply_user_role(UUID, VARCHAR, UUID) TO beauty_app;`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION admin_apply_user_status(
        p_id UUID,
        p_active BOOLEAN
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
           SET is_active = p_active
         WHERE u.id = p_id;

        GET DIAGNOSTICS v_affected = ROW_COUNT;
        RETURN v_affected > 0;
      END;
      $$;
    `);
    await queryRunner.query(
      `REVOKE ALL ON FUNCTION admin_apply_user_status(UUID, BOOLEAN) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION admin_apply_user_status(UUID, BOOLEAN) TO beauty_app;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS admin_apply_user_status(UUID, BOOLEAN)`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS admin_apply_user_role(UUID, VARCHAR, UUID)`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS admin_user_recent_bookings(UUID)`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS admin_users_all()`);
  }
}
