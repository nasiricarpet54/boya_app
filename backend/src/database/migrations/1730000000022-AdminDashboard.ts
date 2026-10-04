import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin dashboard aggregates across every tenant.
 *
 * `bookings` cannot be counted with plain SQL: migration 1730000000000 put it
 * behind `ENABLE + FORCE ROW LEVEL SECURITY` with `bookings_tenant_isolation`
 * (`tenant_id = app.tenant_id`), and an admin's JWT carries no tenant — so a
 * plain `COUNT(*)` would return zero and the dashboard would look permanently
 * empty. `service_lines` has the same problem (migration 1730000000003), which
 * is why the pending-approvals total cannot just sum three plain counts.
 *
 * The fix follows the pattern migration 1730000000020 established for the
 * approval queue: the cross-tenant aggregation happens inside SECURITY
 * DEFINER functions owned by the migration role, which bypass the policies
 * the API role is subject to. Each function is non-executable by PUBLIC and
 * granted only to `beauty_app`, and each one only counts — it exposes no row
 * contents at all.
 *
 * Days are resolved in `Asia/Tehran` (the charter's product timezone), never
 * in the database's own timezone, so "today" and the 7-day series agree with
 * what the panel displays.
 */
export class AdminDashboard1730000000022 implements MigrationInterface {
  name = 'AdminDashboard1730000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Headline figures: tenant totals, the three pending-approval queues
    // summed, booking totals and today's bookings. Revenue stays out of the
    // query entirely — Phase 1 takes no money, so the service hard-codes 0.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION admin_dashboard_counts()
      RETURNS TABLE (
        total_tenants BIGINT,
        active_tenants BIGINT,
        pending_approvals BIGINT,
        total_bookings BIGINT,
        today_bookings BIGINT
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT
          (SELECT COUNT(*) FROM tenants),
          (SELECT COUNT(*) FROM tenants WHERE status = 'approved'),
          (SELECT COUNT(*) FROM tenants WHERE status = 'pending_approval')
            + (SELECT COUNT(*) FROM service_lines WHERE status = 'pending_approval')
            + (SELECT COUNT(*) FROM specialists WHERE status = 'pending_approval'),
          (SELECT COUNT(*) FROM bookings),
          (SELECT COUNT(*)
             FROM bookings b
            WHERE (lower(b.time_slot) AT TIME ZONE 'Asia/Tehran')::date
              = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tehran')::date)
      $$;
    `);
    await queryRunner.query(
      `REVOKE ALL ON FUNCTION admin_dashboard_counts() FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION admin_dashboard_counts() TO beauty_app;`,
    );

    // Bookings per day for the last 7 Tehran days, oldest first, labelled with
    // the Persian weekday name the panel chart renders. Days without bookings
    // still return a row with zero so the chart always has 7 columns.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION admin_dashboard_weekly()
      RETURNS TABLE (
        day TEXT,
        bookings BIGINT
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        WITH days AS (
          SELECT ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tehran')::date
                   - (s.n || ' days')::interval)::date AS d
            FROM generate_series(6, 0, -1) AS s(n)
        )
        SELECT
          CASE EXTRACT(DOW FROM days.d)::int
            WHEN 6 THEN 'شنبه'
            WHEN 0 THEN 'یکشنبه'
            WHEN 1 THEN 'دوشنبه'
            WHEN 2 THEN 'سه‌شنبه'
            WHEN 3 THEN 'چهارشنبه'
            WHEN 4 THEN 'پنجشنبه'
            ELSE 'جمعه'
          END,
          COUNT(b.id)
          FROM days
          LEFT JOIN bookings b
            ON (lower(b.time_slot) AT TIME ZONE 'Asia/Tehran')::date = days.d
         GROUP BY days.d
         ORDER BY days.d ASC;
      $$;
    `);
    await queryRunner.query(
      `REVOKE ALL ON FUNCTION admin_dashboard_weekly() FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION admin_dashboard_weekly() TO beauty_app;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS admin_dashboard_weekly()`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS admin_dashboard_counts()`);
  }
}
