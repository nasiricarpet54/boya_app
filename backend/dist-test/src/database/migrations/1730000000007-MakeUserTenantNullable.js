"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MakeUserTenantNullable1730000000007 = void 0;
class MakeUserTenantNullable1730000000007 {
    name = 'MakeUserTenantNullable1730000000007';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "tenant_id" DROP NOT NULL;`);
    }
    async down(queryRunner) {
    }
}
exports.MakeUserTenantNullable1730000000007 = MakeUserTenantNullable1730000000007;
