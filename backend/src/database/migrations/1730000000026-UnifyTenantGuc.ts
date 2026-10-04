import { MigrationInterface } from 'typeorm';

/**
 * Superseded by 1730000000027.
 *
 * This migration used to re-create the four non-bookings tenant policies.
 * Tenant policies are now defined in exactly one place — 1730000000027
 * `UnifyTenantGuc` (ADR-001) — so this file is an intentional no-op. It is
 * kept because it may be recorded in the `migrations` table of databases
 * created before that cleanup.
 */
export class UnifyTenantGuc1730000000026 implements MigrationInterface {
  name = 'UnifyTenantGuc1730000000026';

  /** No-op: policies are defined by 1730000000027. */
  public async up(): Promise<void> {
    // intentionally empty
  }

  /** No-op: see up(). */
  public async down(): Promise<void> {
    // intentionally empty
  }
}
