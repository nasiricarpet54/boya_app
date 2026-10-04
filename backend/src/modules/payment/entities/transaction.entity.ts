import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type PaymentStatus = 'pending' | 'captured' | 'refunded' | 'failed';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'booking_id', type: 'uuid', unique: true })
  bookingId!: string;

  @Column({ type: 'varchar', length: 20 })
  provider!: string;

  @Column({ name: 'provider_intent_id', type: 'varchar', length: 255 })
  providerIntentId!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: PaymentStatus;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 0 })
  totalAmount!: string;

  @Column({ name: 'platform_fee', type: 'decimal', precision: 12, scale: 0, default: 0 })
  platformFee!: string;

  @Column({ name: 'specialist_share', type: 'decimal', precision: 12, scale: 0, default: 0 })
  specialistShare!: string;

  @Column({ name: 'salon_share', type: 'decimal', precision: 12, scale: 0, default: 0 })
  salonShare!: string;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 12, scale: 0, default: 0 })
  refundAmount!: string;

  @Column({ name: 'provider_refund_id', type: 'varchar', length: 255, nullable: true })
  providerRefundId!: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'captured_at', type: 'timestamptz', nullable: true })
  capturedAt!: Date | null;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt!: Date | null;
}
