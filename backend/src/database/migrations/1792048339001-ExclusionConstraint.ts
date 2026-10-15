import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExclusionConstraint1792048339001 implements MigrationInterface {
  name = 'ExclusionConstraint' + String(Date.now()); // Fallback name

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Check if the constraint already exists
    const res = await queryRunner.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'bookings'::regclass AND contype = 'x'
    `);

    if (res.length === 0) {
      await queryRunner.query(`
        ALTER TABLE bookings
        ADD CONSTRAINT no_double_booking
        EXCLUDE USING gist (
          specialist_id WITH =,
          time_slot WITH &&
        ) WHERE (status NOT IN ('cancelled', 'no_show'))
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bookings DROP CONSTRAINT IF EXISTS no_double_booking`);
  }
}
