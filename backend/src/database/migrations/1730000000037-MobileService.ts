import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * On-site (mobile) services, Phase 1 (ADR-011).
 *
 * Three independent switches, deliberately not derived from one another:
 *
 *  - `specialists.offers_mobile_service` — the person decides they are willing
 *    to travel. Without this nothing they offer can be booked on-site.
 *  - `services.is_mobile_available` — the salon/owner decides *per service*
 *    that it can leave the salon (some services simply cannot, e.g. anything
 *    needing fixed equipment). Both must be true for one booking.
 *  - `bookings.is_mobile` + the customer's address/coordinates — the request
 *    itself. Coords are optional: the address is what the specialist acts on;
 *    lat/lng only power map display and are nullable for callers without them.
 *
 * No travel-time estimate and no dynamic pricing here; both are out of Phase 1.
 */
export class MobileService1730000000037 implements MigrationInterface {
  name = 'MobileService1730000000037';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // متخصص: آیا خدمات سیار ارائه می‌دهد؟
    await queryRunner.query(`
      ALTER TABLE specialists
      ADD COLUMN offers_mobile_service BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // خدمت: آیا این خدمت را می‌تواند سیار ارائه بدهد؟
    await queryRunner.query(`
      ALTER TABLE services
      ADD COLUMN is_mobile_available BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // رزرو: آیا سیار است؟
    await queryRunner.query(`
      ALTER TABLE bookings
      ADD COLUMN is_mobile BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await queryRunner.query(`
      ALTER TABLE bookings
      ADD COLUMN customer_address TEXT
    `);
    await queryRunner.query(`
      ALTER TABLE bookings
      ADD COLUMN customer_latitude NUMERIC(10,7)
    `);
    await queryRunner.query(`
      ALTER TABLE bookings
      ADD COLUMN customer_longitude NUMERIC(10,7)
    `);

    // Partial index for the `?mobile=true` salon feed: only the rows that can
    // ever satisfy `offers_mobile_service` matter, so the index is kept to them.
    await queryRunner.query(`
      CREATE INDEX idx_specialists_mobile
      ON specialists(tenant_id, offers_mobile_service)
      WHERE offers_mobile_service = TRUE AND is_active = TRUE
    `);
    await queryRunner.query(`
      CREATE INDEX idx_services_mobile
      ON services(tenant_id, is_mobile_available)
      WHERE is_mobile_available = TRUE AND is_active = TRUE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_services_mobile`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_specialists_mobile`);
    await queryRunner.query(`ALTER TABLE bookings DROP COLUMN IF EXISTS customer_longitude`);
    await queryRunner.query(`ALTER TABLE bookings DROP COLUMN IF EXISTS customer_latitude`);
    await queryRunner.query(`ALTER TABLE bookings DROP COLUMN IF EXISTS customer_address`);
    await queryRunner.query(`ALTER TABLE bookings DROP COLUMN IF EXISTS is_mobile`);
    await queryRunner.query(`ALTER TABLE services DROP COLUMN IF EXISTS is_mobile_available`);
    await queryRunner.query(`ALTER TABLE specialists DROP COLUMN IF EXISTS offers_mobile_service`);
  }
}
