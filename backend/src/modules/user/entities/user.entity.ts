import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type UserRole = 'customer' | 'salon_owner' | 'line_manager' | 'specialist' | 'admin';

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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
