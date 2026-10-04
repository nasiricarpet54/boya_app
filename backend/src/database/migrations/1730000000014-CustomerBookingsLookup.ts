import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `GET /bookings` returns the signed-in customer's appointments together with
 * the salon name, the service name and the specialist's name.
 *
 * That read cannot run as a plain query on `beauty_app`:
 *
 * - `bookings` is `ENABLE + FORCE ROW LEVEL SECURITY` behind
 *   `bookings_tenant_isolation` (`tenant_id = app.current_tenant_id`) and a customer's
 *   JWT carries `tenantId = null` — customers are not tenant-scoped. One
 *   customer books at several salons, so no single tenant setting could make
 *   all of their rows visible anyway.
 * - `users`, the only place a specialist's name lives, is FORCE ROW LEVEL
 *   SECURITY behind `users_tenant_isolation` (`tenant_id = app.current_tenant_id`),
 *   so the joined name would come back empty for the same reason.
 *
 * The fix widens nothing: the join stays inside a SECURITY DEFINER function,
 * the same escape hatch `find_or_create_customer_by_phone()` (1730000000008) and
 * `get_public_salon_tags()` (1730000000009) use. It is not executable by PUBLIC,
 * only by the backend role, it takes the customer id as a parameter and returns
 * nothing but that customer's own bookings. No RLS policy is created, altered or
 * relaxed here.
 */
export class CustomerBookingsLookup1730000000014 implements MigrationInterface {
  name = 'CustomerBookingsLookup1730000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION get_customer_bookings(
        p_customer_id UUID
      )
      RETURNS TABLE (
        id UUID,
        tenant_id UUID,
        status TEXT,
        starts_at TIMESTAMPTZ,
        ends_at TIMESTAMPTZ,
        total_price NUMERIC,
        salon_name TEXT,
        service_name TEXT,
        specialist_name TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT b.id,
               b.tenant_id,
               b.status::TEXT,
               lower(b.time_slot),
               upper(b.time_slot),
               b.total_price,
               t.name::TEXT,
               s.name::TEXT,
               u.full_name::TEXT,
               b.notes,
               b.created_at
        FROM bookings b
        JOIN tenants t ON t.id = b.tenant_id
        LEFT JOIN services s ON s.id = b.service_id
        LEFT JOIN specialists sp ON sp.id = b.specialist_id
        LEFT JOIN users u ON u.id = sp.user_id
        WHERE b.customer_id = p_customer_id
      $$;
    `);

    await queryRunner.query(
      `REVOKE ALL ON FUNCTION get_customer_bookings(UUID) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION get_customer_bookings(UUID) TO beauty_app;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS get_customer_bookings(UUID)`);
  }
}
