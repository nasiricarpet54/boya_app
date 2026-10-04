import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds mock portfolio images for `GET /salons/:id/portfolio`
 * (migration 1730000000016), which currently answers `{ "data": [] }` for
 * every salon because no writer exists yet for the JSONB column.
 *
 * Specialists are seeded in 1730000000012 with three per tenant, so after
 * this migration the customer app's «نمونه‌کارها» tab has something to
 * render in development: three picsum photos per specialist, all
 * deterministic (seeded URLs, not random) so a re-run yields the same set.
 *
 * The whole block stays behind the same dev-only guard as the fixtures in
 * 1730000000009: a production deployment must never pick up mock CDN URLs.
 * The `WHERE portfolio_images = '[]'::jsonb` predicate is also required, so
 * a specialist whose images were filled in by hand (or by a later migration)
 * is left untouched — only empty rows are backfilled.
 *
 * `down()` clears every specialist's `portfolio_images` back to `'[]'`,
 * which is what the column's DEFAULT says and is what the lookup function
 * in 1730000000016 tolerates (it falls back to `'[]'::jsonb` when the
 * value is not an array).
 */
export class SeedSpecialistPortfolioImages1730000000017
  implements MigrationInterface
{
  name = 'SeedSpecialistPortfolioImages1730000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Mock CDN URLs must never reach a real deployment.
    if ((process.env.NODE_ENV ?? 'development') === 'production') {
      return;
    }

    await queryRunner.query(`
      UPDATE specialists
      SET portfolio_images = jsonb_build_array(
        jsonb_build_object(
          'url',
          'https://picsum.photos/seed/portfolio-' || id::text || '-1/400/500'
        ),
        jsonb_build_object(
          'url',
          'https://picsum.photos/seed/portfolio-' || id::text || '-2/400/500'
        ),
        jsonb_build_object(
          'url',
          'https://picsum.photos/seed/portfolio-' || id::text || '-3/400/500'
        )
      )
      WHERE portfolio_images = '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE specialists SET portfolio_images = '[]'::jsonb
    `);
  }
}
