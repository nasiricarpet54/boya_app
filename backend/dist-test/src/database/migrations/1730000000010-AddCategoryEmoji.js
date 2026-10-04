"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddCategoryEmoji1730000000010 = void 0;
class AddCategoryEmoji1730000000010 {
    name = 'AddCategoryEmoji1730000000010';
    static EMOJI = [
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
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS emoji VARCHAR(10)`);
        for (const [slug, emoji] of AddCategoryEmoji1730000000010.EMOJI) {
            await queryRunner.query(`UPDATE service_categories SET emoji = $1 WHERE slug = $2`, [emoji, slug]);
        }
        await queryRunner.query(`UPDATE service_categories SET emoji = '💇' WHERE emoji IS NULL`);
        await queryRunner.query(`ALTER TABLE service_categories ALTER COLUMN emoji SET NOT NULL`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE service_categories ALTER COLUMN emoji DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE service_categories DROP COLUMN IF EXISTS emoji`);
    }
}
exports.AddCategoryEmoji1730000000010 = AddCategoryEmoji1730000000010;
