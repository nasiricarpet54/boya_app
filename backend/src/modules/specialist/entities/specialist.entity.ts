import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { APPROVAL_STATUSES, ApprovalStatus } from '../../../common/approval-status';

@Entity('specialists')
export class Specialist {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  skills!: string[];

  @Column({ name: 'commission_rate', type: 'decimal', precision: 5, scale: 2, default: 50 })
  commissionRate!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  // --- Approval workflow (migration 1730000000018) ---
  // Adding or editing a specialist is free per the approval policy, so a new
  // row lands here as 'draft' and its creator decides whether it needs review.
  // These four columns exist only because the migration adds them to the table.
  // See Tenant.status for why the enum is declared with `enumName`.
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
}
