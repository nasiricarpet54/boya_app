import { MigrationInterface, QueryRunner } from "typeorm";

export class BlockBookingSlots1792700000005 implements MigrationInterface {
  name = "BlockBookingSlots1792700000005";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add `booking_type` enum string to `bookings` to support blocking time.
    await queryRunner.query(`
      ALTER TABLE bookings
      ADD COLUMN booking_type VARCHAR(50) NOT NULL DEFAULT 'platform';
    `);

    // Validate booking_type values.
    await queryRunner.query(`
      ALTER TABLE bookings
      ADD CONSTRAINT chk_booking_type CHECK (booking_type IN ('platform', 'offline_client', 'personal_blocked'));
    `);

    // 2. Make `customer_id` and financial fields nullable for blocked slots.
    await queryRunner.query(
      `ALTER TABLE bookings ALTER COLUMN customer_id DROP NOT NULL;`,
    );
    await queryRunner.query(
      `ALTER TABLE bookings ALTER COLUMN service_id DROP NOT NULL;`,
    );
    await queryRunner.query(
      `ALTER TABLE bookings ALTER COLUMN total_price DROP NOT NULL;`,
    );

    // 3. Drop existing constraints that might break if customer is null.
    // The previous exclusion constraint prevents double booking:
    // EXCLUDE USING gist (specialist_id WITH =, time_slot WITH &&) WHERE (status NOT IN ('cancelled', 'no_show'))
    // It continues to work naturally with the new booking types as long as the status is not 'cancelled'/'no_show'.
    // If a blocked slot is 'confirmed' or 'pending', it occupies space.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE bookings ALTER COLUMN total_price SET NOT NULL;`,
    );
    await queryRunner.query(
      `ALTER TABLE bookings ALTER COLUMN service_id SET NOT NULL;`,
    );
    await queryRunner.query(`
      DELETE FROM bookings WHERE customer_id IS NULL;
    `);
    await queryRunner.query(
      `ALTER TABLE bookings ALTER COLUMN customer_id SET NOT NULL;`,
    );

    await queryRunner.query(
      `ALTER TABLE bookings DROP CONSTRAINT IF EXISTS chk_booking_type;`,
    );
    await queryRunner.query(
      `ALTER TABLE bookings DROP COLUMN IF EXISTS booking_type;`,
    );
  }
}
