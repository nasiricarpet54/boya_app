"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeedExistingAsApproved1730000000019 = void 0;
class SeedExistingAsApproved1730000000019 {
    name = 'SeedExistingAsApproved1730000000019';
    async up(queryRunner) {
        await queryRunner.query(`
      UPDATE tenants SET status = 'approved', approved_at = NOW(), approved_by = NULL
      WHERE status != 'approved'
    `);
        await queryRunner.query(`
      UPDATE service_lines SET status = 'approved', approved_at = NOW(), approved_by = NULL
      WHERE status != 'approved'
    `);
        await queryRunner.query(`
      UPDATE specialists SET status = 'approved', approved_at = NOW(), approved_by = NULL
      WHERE status != 'approved'
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      UPDATE tenants SET status = 'draft'
    `);
        await queryRunner.query(`
      UPDATE service_lines SET status = 'draft'
    `);
        await queryRunner.query(`
      UPDATE specialists SET status = 'draft'
    `);
    }
}
exports.SeedExistingAsApproved1730000000019 = SeedExistingAsApproved1730000000019;
