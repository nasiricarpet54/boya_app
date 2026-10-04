import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Customer name/phone for the salon panel's booking screens.
 *
 * `GET /salon/me/bookings` has to show who a booking is for, and the only place
 * a customer's name lives is `users`. That table is `ENABLE + FORCE ROW LEVEL
 * SECURITY` behind `users_tenant_isolation`
 * (`tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`),
 * and customers carry `tenant_id IS NULL` since migration 1730000000007 — they
 * are not tenant-scoped, because one customer books at several salons. So the
 * panel transaction, which does set `app.current_tenant_id` to the staff user's
 * salon in order to read `bookings`, filters every customer row out of that
 * join and the list would render nameless cards.
 *
 * Relaxing the `users` policy to `tenant_id IS NULL OR tenant_id = ...` would
 * hand the backend the phone numbers of every customer in the platform on
 * every tenant-scoped query. Instead this function resolves names for exactly
 * the customer ids the caller passes, and only when that customer actually has
 * a booking inside the salon being asked about — so a caller cannot use it to
 * read the directory. It is the same escape hatch `get_customer_bookings()`
 * (1730000000014) and `find_or_create_customer_by_phone()` (1730000000008)
 * use, for the same reason: SECURITY DEFINER, not executable by PUBLIC, granted
 * only to the backend role. No RLS policy is created, altered or relaxed here.
 */
export class PanelBookingsLookup1730000000021 implements MigrationInterface {
  name = 'PanelBookingsLookup1730000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
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

    await queryRunner.query(
      `REVOKE ALL ON FUNCTION salon_panel_customer_contacts(UUID, UUID[]) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION salon_panel_customer_contacts(UUID, UUID[]) TO beauty_app;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS salon_panel_customer_contacts(UUID, UUID[])`,
    );
  }
}
