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
  /** Customer submitted the mandatory post-visit feedback. Terminal. */
  Reviewed = 'reviewed',
}

/** Roles allowed to act on a booking on the salon's side. */
export const APPROVER_ROLES = ['salon_owner', 'line_manager', 'specialist'] as const;
export type ApproverRole = (typeof APPROVER_ROLES)[number];

/**
 * A specialist appointment. `time_slot` is a UTC tstzrange.
 * Jalali is display-only and is formatted in the app, not stored.
 */
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

  /** Inclusive start, exclusive end. Half-open so back-to-back slots do not overlap. */
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

  /**
   * On-site services (ADR-011): the customer asked the specialist to come to
   * them. Requires `specialists.offers_mobile_service` *and*
   * `services.is_mobile_available`, and an address.
   */
  @Column({ name: 'is_mobile', type: 'boolean', default: false })
  isMobile!: boolean;

  /** Free-form; the address the specialist travels to when `is_mobile`. */
  @Column({ name: 'customer_address', type: 'text', nullable: true })
  customerAddress!: string | null;

  /**
   * Optional coordinates of `customer_address`. `numeric` arrives from Postgres
   * as a string, hence the entity type; the caller sends numbers.
   */
  @Column({ name: 'customer_latitude', type: 'numeric', precision: 10, scale: 7, nullable: true })
  customerLatitude!: string | null;

  @Column({ name: 'customer_longitude', type: 'numeric', precision: 10, scale: 7, nullable: true })
  customerLongitude!: string | null;

  /** When the "your visit is coming up" reminder was sent. Set by the cron job. */
  @Column({ name: 'booking_reminder_sent_at', type: 'timestamptz', nullable: true })
  bookingReminderSentAt!: Date | null;

  /** When the "how was it?" feedback reminder was sent. Set by the cron job. */
  @Column({ name: 'feedback_reminder_sent_at', type: 'timestamptz', nullable: true })
  feedbackReminderSentAt!: Date | null;

  /** Customer-side confirmation that the visit happened. Stops no-show sweep. */
  @Column({ name: 'visit_confirmed_by_customer_at', type: 'timestamptz', nullable: true })
  visitConfirmedByCustomerAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
