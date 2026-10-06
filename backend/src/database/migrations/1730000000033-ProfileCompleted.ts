import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `profile_completed` onboarding flags (onboarding UI follow-up).
 *
 * A newly created salon owner or an invited specialist lands on the panel with
 * no profile data at all: the salon has only the registry `name` (the invite
 * carries none) and the specialist row was auto-created by
 * `ensureSpecialistRecord` (ADR-010) with empty `bio`/`skills`. The panel
 * needs a flag that says "this account still owes us a profile", independent
 * of the moderation state of the row itself — the tenant is perfectly usable
 * (`is_active`) while its name is still the placeholder.
 *
 * Default `false` because the flag answers "has this account filled the form",
 * and a freshly created row has not. Backfill below flips that for salons that
 * are already live: an `approved` tenant went through the onboarding door
 * before this column existed, and bouncing its owner into the setup screen on
 * upgrade would be a regression, not a feature. Salons still awaiting first
 * review keep `false` — their owner will submit the profile form as part of
 * this flow, and the staged fields still land in `pending_changes` for admin
 * review (the flag and the approval workflow stay independent).
 *
 * Same default-then-backfill reasoning for `specialists`: rows created through
 * the panel's `POST /salon/me/specialists` were filled in at creation time,
 * while rows auto-created by an invite accept have empty profiles — but both
 * kinds existed before this flag, and neither owner nor specialist has ever
 * seen an onboarding form. Backfilling every *approved* specialist to `true`
 * keeps the change safe for the installed base; only future invites start at
 * `false` and route the specialist into the setup screen once.
 *
 * `working_hours` on specialists: the specialist had no working-hours storage
 * of their own — the only schedule the booking engine reads is the salon's
 * `tenants.working_hours`. This column is the panel's own (non-authoritative)
 * record of the specialist's stated hours, captured by the onboarding form
 * for the profile; nothing in the booking path reads it yet.
 */
export class ProfileCompleted1730000000033 implements MigrationInterface {
  name = 'ProfileCompleted1730000000033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenants ADD COLUMN profile_completed BOOLEAN NOT NULL DEFAULT FALSE`);
    await queryRunner.query(`ALTER TABLE specialists ADD COLUMN profile_completed BOOLEAN NOT NULL DEFAULT FALSE`);
    await queryRunner.query(`ALTER TABLE specialists ADD COLUMN working_hours JSONB NULL`);

    // See the doc comment: already-live rows predate the flag and must not be
    // bounced into onboarding on upgrade. Only never-reviewed salons and
    // specialists stay at the default.
    await queryRunner.query(`UPDATE tenants SET profile_completed = TRUE WHERE status = 'approved'`);
    await queryRunner.query(`UPDATE specialists SET profile_completed = TRUE WHERE status = 'approved'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE specialists DROP COLUMN IF EXISTS working_hours`);
    await queryRunner.query(`ALTER TABLE specialists DROP COLUMN IF EXISTS profile_completed`);
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS profile_completed`);
  }
}
