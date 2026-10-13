import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TicketType {
  Question = 'question',
  Complaint = 'complaint',
  Suggestion = 'suggestion',
  Other = 'other',
}

export enum TicketStatus {
  Open = 'open',
  Answered = 'answered',
  Closed = 'closed',
}

export enum TicketPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

/**
 * A support ticket filed from the customer app's «پشتیبانی» page.
 *
 * `userId` is the ownership key — the customer who filed it — and every other
 * id on the row is optional context. See migration `1730000000041` for why the
 * reply lives on the row instead of in a child table.
 */
@Entity('support_tickets')
@Index('idx_support_tickets_user_id', ['userId', 'createdAt'])
@Index('idx_support_tickets_status', ['status'])
@Check(
  'support_tickets_type_check',
  `"type" IN ('question','complaint','suggestion','other')`,
)
@Check('support_tickets_status_check', `"status" IN ('open','answered','closed')`)
@Check('support_tickets_priority_check', `"priority" IN ('low','medium','high')`)
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 20, default: TicketType.Question })
  type!: TicketType;

  @Column({ type: 'varchar', length: 200 })
  subject!: string;

  @Column({ type: 'varchar', length: 5000 })
  message!: string;

  /** NULLs if the ticket is not about a specific booking; set NULL on delete. */
  @Column({ name: 'booking_id', type: 'uuid', nullable: true })
  bookingId!: string | null;

  /** NULLs if the ticket is not about a specific salon; set NULL on delete. */
  @Column({ name: 'salon_id', type: 'uuid', nullable: true })
  salonId!: string | null;

  @Column({ type: 'varchar', length: 20, default: TicketStatus.Open })
  status!: TicketStatus;

  @Column({ type: 'varchar', length: 10, default: TicketPriority.Medium })
  priority!: TicketPriority;

  /** The staff reply. Present once a ticket has been answered. */
  @Column({ name: 'admin_response', type: 'text', nullable: true })
  adminResponse!: string | null;

  /** The admin who wrote [adminResponse]. */
  @Column({ name: 'responded_by', type: 'uuid', nullable: true })
  respondedBy!: string | null;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
