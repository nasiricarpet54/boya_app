import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin tenants management (GET /admin/tenants, GET /admin/tenants/:id,
 * PATCH /admin/tenants/:id/status).
 *
 * Why functions: `tenants` and `specialists` carry no RLS so they are plain
 * reads, but `bookings` is FORCE ROW LEVEL SECURITY on `app.tenant_id` and
 * `service_lines` on `app.tenant_id` — an admin JWT carries neither,
 * so plain COUNT / JOIN subqueries would silently return zero. The pattern
 * follows migrations 1730000000020 (approvals) and 1730000000022 (dashboard):
 * cross-tenant aggregation lives inside SECURITY DEFINER functions granted
 * only to `beauty_app`, exposing counts and narrow booking rows — never full
 * tables.
 *
 * Also creates `audit_logs`: every approve / suspend / reactivate transition
 * is recorded with actor, tenant, old/new status and reason.
 */
export class AdminTenants1730000000023 implements MigrationInterface {
  name = 'AdminTenants1730000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id UUID NULL,
        tenant_id UUID NULL REFERENCES tenants(id) ON DELETE SET NULL,
        action VARCHAR(60) NOT NULL,
        old_status approval_status NULL,
        new_status approval_status NULL,
        reason TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC)`,
    );

    // Per-tenant counters. bookings + lines go through the definer so RLS
    // cannot zero them; services + specialists have no RLS but counting them
    // here keeps one round trip per tenant instead of four.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION admin_tenant_counts(p_tenant_id UUID)
      RETURNS TABLE (
        bookings BIGINT,
        services BIGINT,
        specialists BIGINT,
        lines BIGINT
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT
          (SELECT COUNT(*) FROM bookings b WHERE b.tenant_id = p_tenant_id),
          (SELECT COUNT(*) FROM services s WHERE s.tenant_id = p_tenant_id),
          (SELECT COUNT(*) FROM specialists sp WHERE sp.tenant_id = p_tenant_id),
          (SELECT COUNT(*) FROM service_lines sl WHERE sl.tenant_id = p_tenant_id)
      $$;
    `);
    await queryRunner.query(
      `REVOKE ALL ON FUNCTION admin_tenant_counts(UUID) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION admin_tenant_counts(UUID) TO beauty_app;`,
    );

    // 10 most recent bookings of one tenant, newest first. Customer and
    // specialist names are resolved inside the definer because `users` is
    // FORCE RLS and a plain join from the API role would come back nameless
    // (same reason as salon_panel_customer_contacts in 1730000000021).
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION admin_tenant_recent_bookings(p_tenant_id UUID)
      RETURNS TABLE (
        id UUID,
        status TEXT,
        start_at TIMESTAMPTZ,
        end_at TIMESTAMPTZ,
        total_price NUMERIC,
        service_name TEXT,
        specialist_name TEXT,
        customer_name TEXT,
        customer_phone TEXT,
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
          c.full_name::TEXT AS customer_name,
          c.phone::TEXT AS customer_phone,
          b.created_at
          FROM bookings b
          LEFT JOIN services sv ON sv.id = b.service_id
          LEFT JOIN specialists sp ON sp.id = b.specialist_id
          LEFT JOIN users cu ON cu.id = sp.user_id
          LEFT JOIN users c ON c.id = b.customer_id
         WHERE b.tenant_id = p_tenant_id
         ORDER BY b.created_at DESC, b.id DESC
         LIMIT 10
      $$;
    `);
    await queryRunner.query(
      `REVOKE ALL ON FUNCTION admin_tenant_recent_bookings(UUID) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION admin_tenant_recent_bookings(UUID) TO beauty_app;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS admin_tenant_recent_bookings(UUID)`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS admin_tenant_counts(UUID)`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_tenant`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`);
  }
}
