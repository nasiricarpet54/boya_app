"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeedSpecialistPortfolioImages1730000000017 = void 0;
class SeedSpecialistPortfolioImages1730000000017 {
    name = 'SeedSpecialistPortfolioImages1730000000017';
    async up(queryRunner) {
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
    async down(queryRunner) {
        await queryRunner.query(`
      UPDATE specialists SET portfolio_images = '[]'::jsonb
    `);
    }
}
exports.SeedSpecialistPortfolioImages1730000000017 = SeedSpecialistPortfolioImages1730000000017;
