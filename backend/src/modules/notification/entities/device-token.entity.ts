import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type DevicePlatform = 'android' | 'ios' | 'web';

/** One row per FCM registration token, owned by the user who registered it. */
@Entity('device_tokens')
@Index('idx_device_tokens_user_id', ['userId'])
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text', unique: true })
  token!: string;

  @Column({ type: 'varchar', length: 20, default: 'android' })
  platform!: DevicePlatform;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  /** Bumped on re-registration; the oldest row is what pruning drops first. */
  @Column({ name: 'last_seen_at', type: 'timestamptz', default: () => 'NOW()' })
  lastSeenAt!: Date;
}