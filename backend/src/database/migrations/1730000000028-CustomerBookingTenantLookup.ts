import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BUG-5 — `confirmVisitByCustomer` needs the tenant of a booking the caller
 * owns, but the customer's JWT carries `tenantId = null`.
 *
 * `bookings` is `ENABLE + FORCE ROW LEVEL SECURITY` behind
 * `bookings_tenant_isolation`, so a customer cannot read the row to learn its
 * `tenant_id` without first setting the GUC to that very tenant — a
 * chicken-and-egg dead end. Resolved the same way the other customer-facing
 * reads do (`get_customer_bookings`, 1730000000014): a narrow SECURITY DEFINER
 * function that returns the booking's tenant **only when the booking belongs to
 * the given customer**.
 *
 * It widens nothing. It is executable by the backend role alone (not PUBLIC),
 * takes both the booking and the customer id, and returns the tenant for that
 * one owned row or nothing at all. Once the service has the tenant it sets the
 * GUC and does the ordinary RLS-scoped read + update, so the write is still
 * gated by the policy's WITH CHECK.
 */
export class CustomerBookingTenantLookup1730000000028 implements MigrationInterface {
  name = 'CustomerBookingTenantLookup1730000000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION get_customer_booking_tenant(
        p_booking_id UUID,
        p_customer_id UUID
      )
      RETURNS UUID
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT b.tenant_id
        FROM bookings b
        WHERE b.id = p_booking_id
          AND b.customer_id = p_customer_id
      $$;
    `);

    await queryRunner.query(`REVOKE ALL ON FUNCTION get_customer_booking_tenant(UUID, UUID) FROM PUBLIC;`);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION get_customer_booking_tenant(UUID, UUID) TO beauty_app;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS get_customer_booking_tenant(UUID, UUID)`);
  }
}