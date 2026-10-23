import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TicketStatus {
  Open = 'open',
  Investigating = 'investigating',
  Resolved = 'resolved',
  Closed = 'closed',
}

export enum TicketPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

/**
 * Tickets module for customer complaints and support.
 * Supports multi-tenant isolation:
 * - admin sees all tickets
 * - salon_owner sees tickets with tenant_id = user.tenantId
 * - specialist sees tickets with specialist_id = user.id
 * - customer sees tickets with customer_id = user.id
 */
@Entity('tickets')
@Index('idx_tickets_customer_id', ['customerId', 'createdAt'])
@Index('idx_tickets_tenant_id', ['tenantId', 'createdAt'])
@Index('idx_tickets_specialist_id', ['specialistId', 'createdAt'])
@Index('idx_tickets_status', ['status'])
@Index('idx_tickets_tracking_code', ['trackingCode'])
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tracking_code', type: 'varchar', unique: true, nullable: true })
  trackingCode!: string | null;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @Column({ name: 'specialist_id', type: 'uuid', nullable: true })
  specialistId!: string | null;

  @Column({ name: 'booking_id', type: 'uuid', nullable: true })
  bookingId!: string | null;

  @Column({ type: 'varchar', length: 20, default: TicketStatus.Open })
  status!: TicketStatus;

  @Column({ type: 'varchar', length: 10, default: TicketPriority.Medium })
  priority!: TicketPriority;

  @Column({ type: 'text' })
  message!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
