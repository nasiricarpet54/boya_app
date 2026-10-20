import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum BookingStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Cancelled = 'cancelled',
  Completed = 'completed',
  NoShow = 'no_show',
  Reviewed = 'reviewed',
}

export const APPROVER_ROLES = ['salon_owner', 'line_manager', 'specialist'] as const;
export type ApproverRole = (typeof APPROVER_ROLES)[number];

@Entity('bookings')
@Index('idx_bookings_tenant_id', ['tenantId'])
@Check(
  'bookings_status_check',
  `"status" IN ('pending','confirmed','cancelled','completed','no_show','reviewed')`,
)
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'specialist_id', type: 'uuid' })
  specialistId!: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId!: string;

  @Column({
    name: 'time_slot',
    type: 'tstzrange',
    transformer: {
      to: (value: { start: Date; end: Date } | string) =>
        typeof value === 'string' ? value : `[${value.start.toISOString()},${value.end.toISOString()})`,
      from: (value: string) => value,
    },
  })
  timeSlot!: string;

  @Column({ type: 'varchar', length: 20, default: BookingStatus.Pending })
  status!: BookingStatus;

  @Column({ name: 'total_price', type: 'numeric', precision: 10, scale: 2 })
  totalPrice!: string;

  @Column({ name: 'deposit_paid', type: 'numeric', precision: 10, scale: 2, default: 0 })
  depositPaid!: string;

  @Column({ name: 'flexible_specialist', type: 'boolean', default: false })
  flexibleSpecialist!: boolean;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'is_mobile', type: 'boolean', default: false })
  isMobile!: boolean;

  @Column({ name: 'customer_address', type: 'text', nullable: true })
  customerAddress!: string | null;

  @Column({ name: 'customer_latitude', type: 'numeric', precision: 10, scale: 7, nullable: true })
  customerLatitude!: string | null;

  @Column({ name: 'customer_longitude', type: 'numeric', precision: 10, scale: 7, nullable: true })
  customerLongitude!: string | null;

  @Column({ name: 'booking_reminder_sent_at', type: 'timestamptz', nullable: true })
  bookingReminderSentAt!: Date | null;

  @Column({ name: 'feedback_reminder_sent_at', type: 'timestamptz', nullable: true })
  feedbackReminderSentAt!: Date | null;

  @Column({ name: 'visit_confirmed_by_customer_at', type: 'timestamptz', nullable: true })
  visitConfirmedByCustomerAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
