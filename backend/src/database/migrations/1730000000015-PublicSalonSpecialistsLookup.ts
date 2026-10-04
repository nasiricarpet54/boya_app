import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Public read of one salon's active specialists, backing
 * `GET /salons/:id/specialists` and the `specialists` field of
 * `GET /salons/:id` (the customer booking form's specialist picker).
 *
 * `specialists` itself has no RLS, but the display name and avatar live in
 * `users`, which is `ENABLE + FORCE ROW LEVEL SECURITY` behind
 * `users_tenant_isolation` (`tenant_id = app.current_tenant_id`). A public
 * request has no tenant context, so a plain `LEFT JOIN users` would come back
 * with empty names — the same problem 1730000000014 describes for booking
 * reads.
 *
 * The fix widens nothing: the join stays inside a SECURITY DEFINER function,
 * the same escape hatch `get_public_salon_tags()` (1730000000009) and
 * `get_customer_bookings()` (1730000000014) use. It is not executable by
 * PUBLIC, only by the backend role, it takes one tenant id and returns only
 * that salon's active specialists. No RLS policy is created, altered or
 * relaxed here.
 */
export class PublicSalonSpecialistsLookup1730000000015
  implements MigrationInterface
{
  name = 'PublicSalonSpecialistsLookup1730000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION get_public_salon_specialists(
        p_tenant_id UUID
      )
      RETURNS TABLE (
        id UUID,
        full_name TEXT,
        avatar_url TEXT,
        bio TEXT,
        skills JSONB,
        commission_rate NUMERIC
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT sp.id,
               u.full_name::TEXT,
               u.avatar_url::TEXT,
               sp.bio,
               sp.skills,
               sp.commission_rate
        FROM specialists sp
        LEFT JOIN users u ON u.id = sp.user_id
        WHERE sp.tenant_id = p_tenant_id
          AND sp.is_active = true
        ORDER BY u.full_name ASC NULLS LAST, sp.created_at ASC, sp.id ASC
      $$;
    `);

    await queryRunner.query(
      `REVOKE ALL ON FUNCTION get_public_salon_specialists(UUID) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION get_public_salon_specialists(UUID) TO beauty_app;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS get_public_salon_specialists(UUID)`,
    );
  }
}
