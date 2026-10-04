import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'line_id', type: 'uuid', nullable: true })
  lineId!: string | null;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'duration_minutes', type: 'int' })
  durationMinutes!: number;

  @Column({ type: 'decimal', precision: 12, scale: 0 })
  price!: string;

  @Column({ name: 'deposit_required', type: 'boolean', default: false })
  depositRequired!: boolean;

  @Column({ name: 'deposit_amount', type: 'decimal', precision: 12, scale: 0, nullable: true })
  depositAmount!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
