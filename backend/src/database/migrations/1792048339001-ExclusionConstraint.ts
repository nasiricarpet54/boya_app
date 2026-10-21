import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExclusionConstraint1792048339001 implements MigrationInterface {
  // Fixed name. A name built at runtime (`'ExclusionConstraint' + Date.now()`)
  // is different on every boot, so TypeORM never recognises the migration as
  // applied and re-runs it on every deploy. This is the name already in the
  // migrations ledger.
  name = 'ExclusionConstraint1792554473159';

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
