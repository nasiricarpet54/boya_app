import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * A blocked range in a provider's calendar (`schedule_blocks`).
 *
 * `tenantId` is the salon the block belongs to, or NULL when the block
 * belongs to a salon-independent mobile specialist (migration
 * 1792700000000); RLS tells the two apart by `app.current_user_id`.
 */
@Entity('schedule_blocks')
export class ScheduleBlock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** The salon (`tenants.id`), or NULL for a mobile specialist's block. */
  @Column({ name: 'tenant_id', nullable: true })
  @Column('uuid') // یا @Column({ type: 'uuid' })
  tenantId: string;

  /** NULL = the whole salon is blocked, not one specialist. */
  @Column({ name: 'specialist_id', nullable: true })
  specialistId!: string | null;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime!: Date;

  @Column({ nullable: true })
  reason!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
