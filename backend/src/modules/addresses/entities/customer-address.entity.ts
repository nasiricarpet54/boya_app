import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Customer address entity
 * 
 * RLS must be enabled on this table with policy based on tenant_id.
 * The composite index should start with tenant_id for efficient tenant-scoped queries.
 */
@Entity('customer_addresses')
@Index(['tenantId', 'customerId'])
export class CustomerAddress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column()
  title: string;

  @Column()
  address: string;

  @Column({ name: 'postal_code', nullable: true })
  postalCode: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 11, scale: 7, nullable: true })
  longitude: number | null;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
