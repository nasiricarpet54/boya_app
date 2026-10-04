import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Post-visit feedback. The charter makes it mandatory, so it is keyed on the
 * booking: one review per completed visit, which is also what makes the
 * completed → reviewed transition idempotent.
 */
@Entity('reviews')
@Index('idx_reviews_booking_id', ['bookingId'], { unique: true })
@Index('idx_reviews_tenant_id', ['tenantId'])
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Column({ name: 'specialist_id', type: 'uuid' })
  specialistId!: string;

  /** 1–5, the number the salon card shows. */
  @Column({ type: 'smallint' })
  rating!: number;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  /** Photo evidence is optional; the charter calls for it, not for every review. */
  @Column({ name: 'photo_url', type: 'varchar', nullable: true })
  photoUrl!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}