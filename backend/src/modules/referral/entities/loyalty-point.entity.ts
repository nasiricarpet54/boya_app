import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type LoyaltyPointType = 'earned' | 'spent' | 'expired';

export type LoyaltyPointSource =
  | 'booking'
  | 'referral'
  | 'review'
  | 'birthday'
  | 'redemption'
  | 'manual';

/**
 * Append-only ledger. Rows are never updated or deleted: a correction is a new
 * row. There is no balance column because the balance is a SUM, and no
 * `tenant_id` because points follow the user across salons, so no RLS here.
 *
 * Balance = SUM(live earned) - SUM(spent). 'expired' rows are bookkeeping for
 * the sweep — they do not subtract, because their 'earned' row already stopped
 * counting once it lapsed.
 */
@Entity('loyalty_points')
@Index('idx_loyalty_points_user_created', ['userId', 'createdAt'])
@Check('chk_loyalty_points_type', `"type" IN ('earned','spent','expired')`)
@Check('chk_loyalty_points_positive', `"points" > 0`)
export class LoyaltyPoint {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_loyalty_points_user')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  /** Always positive. `type` decides the sign when the balance is summed. */
  @Column({ type: 'int' })
  points!: number;

  @Column({ type: 'varchar', length: 20 })
  type!: LoyaltyPointType;

  @Column({ type: 'varchar', length: 30 })
  source!: LoyaltyPointSource;

  /** Points at the 'earned' row this entry cancels. Set on 'expired' rows only. */
  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  /** Set on 'earned' rows. 'spent' and 'expired' rows carry NULL. */
  @Index('idx_loyalty_points_expires')
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
