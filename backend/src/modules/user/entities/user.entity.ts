import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * The role a user plays on the platform (ADR-005/ADR-010 follow-ups).
 *
 * One list in one place — copied nowhere else, so a new role is added here and
 * every `Record<UserRole>` / guard allow-list that derives from it stays in
 * sync. The values are the lower-case strings stored in `users.role`, whose
 * `VARCHAR(20)` carries no CHECK constraint (migration 1730000000002), so a new
 * value needs no DDL: the migration that introduces it only has to backfill
 * seeding/definer logic if it changes behaviour.
 *
 * - `customer` books services.
 * - `salon_owner`/`line_manager`/`admin` staff a tenant (a salon *is* a tenant
 *   row — migration 1792406647600).
 * - `specialist`/`employed`/`booth_renter`/`freelance_mobile` are the provider
 *   roles; the last three are the specialist kinds the admin panel manages
 *   (`/admin/specialists`), `freelance_mobile` being the salon-independent
 *   one (mobile service, ADR-011).
 * - `super_admin` is the platform-level operator (see ADMIN_ROLES).
 */
export const USER_ROLES = [
  'customer',
  'salon_owner',
  'line_manager',
  'specialist',
  'employed',
  'booth_renter',
  'freelance_mobile',
  'admin',
  'super_admin',
] as const;

export type UserRole = 'customer' | 'salon_owner' | 'line_manager' | 'specialist' | 'employed' | 'booth_renter' | 'freelance_mobile' | 'admin' | 'super_admin';

/** Roles that may use the admin back-office (`/admin/*`). */
export const ADMIN_ROLES: readonly UserRole[] = ['admin', 'super_admin'];

/** Roles that provide services and therefore own a `specialists` row. */
export const SPECIALIST_ROLES: readonly UserRole[] = [
  'specialist',
  'employed',
  'booth_renter',
  'freelance_mobile',
];

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 20 })
  phone!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255, nullable: true })
  fullName!: string | null;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'customer' })
  role!: UserRole;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /** Times the customer missed a confirmed booking. Fed by the no-show sweep. */
  @Column({ name: 'no_show_count', type: 'int', default: 0 })
  noShowCount!: number;

  /**
   * The customer's default city (migration 1730000000038), used to pre-fill the
   * booking address. Optional and loosely linked for the same reason as
   * `tenants.city_id`: a user row outlives any city row.
   */
  @Column({ name: 'city_id', type: 'uuid', nullable: true })
  cityId!: string | null;

  @Column({ name: 'late_cancel_count', type: 'int', default: 0 })
  lateCancelCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
