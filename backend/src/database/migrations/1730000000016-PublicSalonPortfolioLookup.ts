import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Portfolio photos of one salon's active specialists, backing
 * `GET /salons/:id/portfolio` (the customer app's «نمونه‌کارها» tab).
 *
 * `specialists.portfolio_images` already existed but no lookup returned it:
 * `get_public_salon_specialists()` (1730000000015) exposes only id, full_name,
 * avatar_url, bio, skills and commission_rate, so the JSONB column was
 * invisible to the public catalogue. This migration adds
 * `get_public_salon_portfolio()` — `get_public_salon_specialists()` is
 * deliberately NOT redefined, so its `RETURNS TABLE` shape, and every caller
 * that depends on it, stays exactly as it is.
 *
 * The new function has to expand the JSONB and name the specialist, and
 * `users` is `ENABLE + FORCE ROW LEVEL SECURITY` behind `users_tenant_isolation`
 * (`tenant_id = app.tenant_id`). A public request carries no tenant
 * context, so a plain `JOIN users` would return empty names — the same problem
 * 1730000000015 describes. The join therefore stays inside a SECURITY DEFINER
 * function, the escape hatch `get_public_salon_tags()` (1730000000009),
 * `get_customer_bookings()` (1730000000014) and `get_public_salon_specialists()`
 * (1730000000015) already use. It is not executable by PUBLIC, only by the
 * backend role, it takes one tenant id and returns nothing but that salon's
 * active specialists' images. No RLS policy is created, altered or relaxed.
 *
 * Two element shapes are accepted, because the column is free-form JSONB and
 * nothing writes it yet:
 *   - a bare URL string: `["https://cdn/before.jpg"]`
 *   - an object:         `[{"url": "https://cdn/before.jpg"}]`
 * (`url`, `image_url` and `src` are all read as the object's URL key; an
 * element with no usable URL is skipped rather than returned as a blank tile.)
 *
 * `id` is the element's own `id`/`imageId` when present, otherwise a key derived
 * from the specialist and the element's position, so a client always has a
 * stable value for a grid key or a photo-viewer page.
 */
export class PublicSalonPortfolioLookup1730000000016
  implements MigrationInterface
{
  name = 'PublicSalonPortfolioLookup1730000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // portfolio_images is only assumed, not required: on a database that never
    // got it, the column is created as an empty JSONB array so the function
    // below can be defined and the endpoint answers `{ "data": [] }`.
    await queryRunner.query(
      `ALTER TABLE specialists ADD COLUMN IF NOT EXISTS portfolio_images JSONB NOT NULL DEFAULT '[]'::jsonb`,
    );

    // Drop first so a partially-created earlier version can never win over
    // this one; the transaction rolls both statements back together.
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS get_public_salon_portfolio(UUID)`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION get_public_salon_portfolio(
        p_tenant_id UUID
      )
      RETURNS TABLE (
        id UUID,
        image_url TEXT,
        specialist_id UUID,
        specialist_name TEXT
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT CASE
                 WHEN COALESCE(img.item ->> 'id', img.item ->> 'imageId') ~
                      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                   THEN COALESCE(img.item ->> 'id', img.item ->> 'imageId')::uuid
                 ELSE md5(sp.id::text || ':portfolio:' || img.ord::text)::uuid
               END AS id,
               CASE
                 WHEN jsonb_typeof(img.item) = 'string' THEN img.item #>> '{}'
                 ELSE COALESCE(
                   img.item ->> 'url',
                   img.item ->> 'image_url',
                   img.item ->> 'src'
                 )
               END AS image_url,
               sp.id AS specialist_id,
               u.full_name::TEXT AS specialist_name
        FROM specialists sp
        LEFT JOIN users u ON u.id = sp.user_id
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(sp.portfolio_images) = 'array' THEN sp.portfolio_images
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS img(item, ord)
        WHERE sp.tenant_id = p_tenant_id
          AND sp.is_active = true
          AND length(btrim(COALESCE(
                CASE
                  WHEN jsonb_typeof(img.item) = 'string' THEN img.item #>> '{}'
                  ELSE COALESCE(
                    img.item ->> 'url',
                    img.item ->> 'image_url',
                    img.item ->> 'src'
                  )
                END,
                ''
              ))) > 0
        ORDER BY u.full_name ASC NULLS LAST, sp.created_at ASC, sp.id ASC, img.ord ASC
      $$;
    `);

    await queryRunner.query(
      `REVOKE ALL ON FUNCTION get_public_salon_portfolio(UUID) FROM PUBLIC;`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION get_public_salon_portfolio(UUID) TO beauty_app;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS get_public_salon_portfolio(UUID)`,
    );
    // portfolio_images is not dropped: the column predates this migration on
    // every real database, and dropping it would destroy the salons' images.
  }
}
