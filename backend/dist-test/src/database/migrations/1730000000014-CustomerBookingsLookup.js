"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerBookingsLookup1730000000014 = void 0;
class CustomerBookingsLookup1730000000014 {
    name = 'CustomerBookingsLookup1730000000014';
    async up(queryRunner) {
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
        await queryRunner.query(`REVOKE ALL ON FUNCTION get_customer_bookings(UUID) FROM PUBLIC;`);
        await queryRunner.query(`GRANT EXECUTE ON FUNCTION get_customer_bookings(UUID) TO beauty_app;`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP FUNCTION IF EXISTS get_customer_bookings(UUID)`);
    }
}
exports.CustomerBookingsLookup1730000000014 = CustomerBookingsLookup1730000000014;
