"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PanelBookingsLookup1730000000021 = void 0;
class PanelBookingsLookup1730000000021 {
    name = 'PanelBookingsLookup1730000000021';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE OR REPLACE FUNCTION salon_panel_customer_contacts(
        p_tenant_id UUID,
        p_customer_ids UUID[]
      )
      RETURNS TABLE (
        customer_id UUID,
        full_name TEXT,
        phone TEXT
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT u.id,
               u.full_name::TEXT,
               u.phone::TEXT
        FROM users u
        WHERE u.id = ANY(p_customer_ids)
          -- The tenant is not a filter the caller can leave out: a customer id
          -- from another salon must resolve to no row, not to a name.
          AND EXISTS (
            SELECT 1
            FROM bookings b
            WHERE b.customer_id = u.id
              AND b.tenant_id = p_tenant_id
          )
      $$;
    `);
        await queryRunner.query(`REVOKE ALL ON FUNCTION salon_panel_customer_contacts(UUID, UUID[]) FROM PUBLIC;`);
        await queryRunner.query(`GRANT EXECUTE ON FUNCTION salon_panel_customer_contacts(UUID, UUID[]) TO beauty_app;`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP FUNCTION IF EXISTS salon_panel_customer_contacts(UUID, UUID[])`);
    }
}
exports.PanelBookingsLookup1730000000021 = PanelBookingsLookup1730000000021;
