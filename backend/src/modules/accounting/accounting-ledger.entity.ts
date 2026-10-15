import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('accounting_ledgers')
export class AccountingLedger {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'booking_id', type: 'uuid', nullable: true })
  bookingId!: string | null;

  @Column({ name: 'payment_method', type: 'varchar' })
  paymentMethod!: string;

  @Column({ name: 'total_amount', type: 'numeric', precision: 10, scale: 2 })
  totalAmount!: string;

  @Column({ name: 'specialist_share_percent', type: 'numeric', precision: 5, scale: 2 })
  specialistSharePercent!: string;

  @Column({ name: 'salon_share_percent', type: 'numeric', precision: 5, scale: 2 })
  salonSharePercent!: string;

  @Column({ name: 'specialist_share_amount', type: 'numeric', precision: 10, scale: 2 })
  specialistShareAmount!: string;

  @Column({ name: 'salon_share_amount', type: 'numeric', precision: 10, scale: 2 })
  salonShareAmount!: string;

  @Column({ name: 'is_settled_internally', type: 'boolean', default: false })
  isSettledInternally!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
