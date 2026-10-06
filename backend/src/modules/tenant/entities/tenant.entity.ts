import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { APPROVAL_STATUSES, ApprovalStatus } from '../../../common/approval-status';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'name_en', type: 'varchar', length: 255, nullable: true })
  nameEn!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  slug!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /**
   * Moderation state of the salon. The column is the `approval_status` enum
   * created by migration 1730000000018, declared through `enumName` because
   * that is how TypeORM models a Postgres enum — `type: 'approval_status'`
   * is not a `ColumnType` and does not compile.
   */
  @Column({
    name: 'status',
    type: 'enum',
    enumName: 'approval_status',
    enum: [...APPROVAL_STATUSES],
    default: 'draft',
  })
  status!: ApprovalStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy!: string | null;

  @Column({ name: 'pending_changes', type: 'jsonb', nullable: true })
  pendingChanges!: Record<string, unknown> | null;

  /**
   * Onboarding flag (migration 1730000000033): true once the owner has
   * submitted the salon profile form. Independent of [status], which is the
   * moderation lifecycle — a salon can be `pending_approval` with its profile
   * prompt already answered.
   */
  @Column({ name: 'profile_completed', type: 'boolean', default: false })
  profileCompleted!: boolean;
}
