"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Referrals1730000000006 = void 0;
class Referrals1730000000006 {
    name = 'Referrals1730000000006';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        referred_id UUID REFERENCES users(id) ON DELETE SET NULL,
        referral_code VARCHAR(20) NOT NULL,
        referrer_reward DECIMAL(12,0) NOT NULL DEFAULT 0,
        referred_reward DECIMAL(12,0) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        completed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_referrals_code UNIQUE (referral_code),
        CONSTRAINT chk_referrals_status CHECK (status IN ('pending','completed','expired'))
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id)`);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_referrals_referred
        ON referrals(referred_id) WHERE referred_id IS NOT NULL
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status)`);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS loyalty_points (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        points INT NOT NULL,
        type VARCHAR(20) NOT NULL,
        source VARCHAR(30) NOT NULL,
        source_id UUID,
        description VARCHAR(255),
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_loyalty_points_type CHECK (type IN ('earned','spent','expired')),
        CONSTRAINT chk_loyalty_points_positive CHECK (points > 0)
      )
    `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_loyalty_points_user ON loyalty_points(user_id)`);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_loyalty_points_user_created
        ON loyalty_points(user_id, created_at DESC)
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_loyalty_points_expires
        ON loyalty_points(expires_at) WHERE expires_at IS NOT NULL
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_points_expiry_once
        ON loyalty_points(source_id, type) WHERE type = 'expired'
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS loyalty_points`);
        await queryRunner.query(`DROP TABLE IF EXISTS referrals`);
    }
}
exports.Referrals1730000000006 = Referrals1730000000006;
