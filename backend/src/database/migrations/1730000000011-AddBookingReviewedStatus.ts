import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 lifecycle support: the `reviewed` state, the reviews table, the
 * reminder bookkeeping, and the Phase 2 subscription columns.
 *
 * The status CHECK is replaced rather than dropped and recreated so the new
 * definition lives in exactly one place. `down()` restores the Phase 0 set and
 * removes the new objects; rows already in `reviewed` are moved back to
 * `completed` first so the old constraint can be re-applied without failing.
 *
 * The `is_featured` / `featured_until` / `subscription_tier` / `boost_weight`
 * columns are schema-only preparation. Nothing reads them until Phase 2, and
 * no endpoint exposes them to customers.
 */
export class AddBookingReviewedStatus1730000000011 implements MigrationInterface {
  name = 'AddBookingReviewedStatus1730000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check`,
    );
    await queryRunner.query(
      `ALTER TABLE bookings ADD CONSTRAINT bookings_status_check ` +
        `CHECK ("status" IN ('pending','confirmed','cancelled','completed','no_show','reviewed'))`,
    );

    await queryRunner.query(
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS feedback_reminder_sent_at TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_reminder_sent_at TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS visit_confirmed_by_customer_at TIMESTAMPTZ`,
    );

    // The no-show sweep counts misses per customer.
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS no_show_count INT NOT NULL DEFAULT 0`,
    );

    await this.createReviews(queryRunner);
    await this.addPremiumColumns(queryRunner);
  }

  /**
   * Post-visit feedback. The unique index on booking_id is what makes the
   * completed → reviewed transition idempotent. RLS follows the same shape as
   * bookings: tenant-scoped, with the app role granted access.
   */
  private async createReviews(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        specialist_id UUID NOT NULL REFERENCES specialists(id) ON DELETE CASCADE,
        rating SMALLINT NOT NULL,
        comment TEXT,
        photo_url VARCHAR(500),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_reviews_booking UNIQUE (booking_id),
        CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_reviews_tenant_id ON reviews(tenant_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_reviews_specialist_id ON reviews(specialist_id)`,
    );
  }

  /**
   * Phase 2 premium placement. `boost_weight` multiplies the match score;
   * `is_featured` pins a salon to the top of discovery. Deliberately unused in
   * Phase 1 so no customer can buy a ranking yet.
   */
  private async addPremiumColumns(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free'`,
    );
    await queryRunner.query(
      `ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS boost_weight DECIMAL(3,2) NOT NULL DEFAULT 1.00`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS premium_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        price_monthly DECIMAL(12,0) NOT NULL DEFAULT 0,
        features JSONB NOT NULL DEFAULT '{}'::jsonb,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_premium_plans_slug UNIQUE (slug)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 'reviewed' is not a legal value once the old constraint is back.
    await queryRunner.query(
      `UPDATE bookings SET status = 'completed' WHERE status = 'reviewed'`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS premium_plans`);
    await queryRunner.query(
      `ALTER TABLE service_categories DROP COLUMN IF EXISTS boost_weight`,
    );
    await queryRunner.query(
      `ALTER TABLE tenants DROP COLUMN IF EXISTS subscription_tier`,
    );
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS featured_until`);
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS is_featured`);

    await queryRunner.query(`DROP TABLE IF EXISTS reviews`);

    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS no_show_count`);
    await queryRunner.query(
      `ALTER TABLE bookings DROP COLUMN IF EXISTS visit_confirmed_by_customer_at`,
    );
    await queryRunner.query(
      `ALTER TABLE bookings DROP COLUMN IF EXISTS booking_reminder_sent_at`,
    );
    await queryRunner.query(
      `ALTER TABLE bookings DROP COLUMN IF EXISTS feedback_reminder_sent_at`,
    );

    await queryRunner.query(
      `ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check`,
    );
    await queryRunner.query(
      `ALTER TABLE bookings ADD CONSTRAINT bookings_status_check ` +
        `CHECK ("status" IN ('pending','confirmed','cancelled','completed','no_show'))`,
    );
  }
}