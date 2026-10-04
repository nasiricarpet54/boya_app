import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { APPROVAL_STATUSES, ApprovalStatus } from '../../../common/approval-status';

@Entity('service_lines')
export class ServiceLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /** See Tenant.status — the same `approval_status` enum column. */
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
