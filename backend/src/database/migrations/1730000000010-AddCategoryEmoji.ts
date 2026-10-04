import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the glyph the home category grid renders.
 *
 * The column is NOT NULL once the seeded rows are populated, so every future
 * insert has to carry an emoji. `down()` relaxes it again before dropping it,
 * which keeps this migration reversible without touching the other columns.
 */
export class AddCategoryEmoji1730000000010 implements MigrationInterface {
  name = 'AddCategoryEmoji1730000000010';

  /** slug → emoji, matching the catalog seeded in 1730000000009. */
  private static readonly EMOJI: ReadonlyArray<readonly [string, string]> = [
    ['hair-color', '🎨'],
    ['keratin', '💆‍♀️'],
    ['haircut', '✂️'],
    ['bridal-makeup', '👑'],
    ['lashes-brows', '👁️'],
    ['microblading', '✏️'],
    ['skincare', '✨'],
    ['nail-salon', '💅'],
    ['waxing', '🪒'],
    ['permanent-tattoo', '🖊️'],
    ['massage-spa', '💆'],
    ['mens-grooming', '🧔'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS emoji VARCHAR(10)`,
    );

    for (const [slug, emoji] of AddCategoryEmoji1730000000010.EMOJI) {
      await queryRunner.query(
        `UPDATE service_categories SET emoji = $1 WHERE slug = $2`,
        [emoji, slug],
      );
    }

    // A category added by hand is not in the list above; give it a neutral glyph
    // so the NOT NULL below can be applied.
    await queryRunner.query(
      `UPDATE service_categories SET emoji = '💇' WHERE emoji IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE service_categories ALTER COLUMN emoji SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE service_categories ALTER COLUMN emoji DROP NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE service_categories DROP COLUMN IF EXISTS emoji`);
  }
}
