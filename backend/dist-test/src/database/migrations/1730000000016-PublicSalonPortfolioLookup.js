"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicSalonPortfolioLookup1730000000016 = void 0;
class PublicSalonPortfolioLookup1730000000016 {
    name = 'PublicSalonPortfolioLookup1730000000016';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS portfolio_images JSONB NOT NULL DEFAULT '[]'::jsonb`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS get_public_salon_portfolio(UUID)`);
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
        await queryRunner.query(`REVOKE ALL ON FUNCTION get_public_salon_portfolio(UUID) FROM PUBLIC;`);
        await queryRunner.query(`GRANT EXECUTE ON FUNCTION get_public_salon_portfolio(UUID) TO beauty_app;`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP FUNCTION IF EXISTS get_public_salon_portfolio(UUID)`);
    }
}
exports.PublicSalonPortfolioLookup1730000000016 = PublicSalonPortfolioLookup1730000000016;
