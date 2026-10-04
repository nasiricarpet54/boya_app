import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export type ReferralStatus = 'pending' | 'completed' | 'expired';

/**
 * User-to-user referral. There is no `tenant_id`: a referral belongs to the two
 * users, not to a salon, so this table intentionally has no RLS policy. The
 * tenant that completed the referral travels on the `referral.completed` event
 * instead, because the payment event carries it.
 *
 * Rewards are stored per referral so old rows keep the policy of their day.
 */
@Entity('referrals')
@Unique('uq_referrals_code', ['referralCode'])
@Check('chk_referrals_status', `"status" IN ('pending','completed','expired')`)
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_referrals_referrer')
  @Column({ name: 'referrer_id', type: 'uuid' })
  referrerId!: string;

  /** NULL until a new user applies the code; bound to exactly one user afterwards. */
  @Index('idx_referrals_referred')
  @Column({ name: 'referred_id', type: 'uuid', nullable: true })
  referredId!: string | null;

  @Column({ name: 'referral_code', type: 'varchar', length: 20 })
  referralCode!: string;

  /** Whole rials, like every other amount in this schema. Precision 0, scale 0. */
  @Column({ name: 'referrer_reward', type: 'decimal', precision: 12, scale: 0, default: 0 })
  referrerReward!: string;

  @Column({ name: 'referred_reward', type: 'decimal', precision: 12, scale: 0, default: 0 })
  referredReward!: string;

  @Index('idx_referrals_status')
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: ReferralStatus;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
