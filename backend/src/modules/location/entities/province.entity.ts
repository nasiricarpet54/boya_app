import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * An Iranian province, a tenant-agnostic reference table (migration
 * 1730000000038, seeded by 1730000000039).
 *
 * Like `service_categories`, `provinces` carries no RLS: every session reads the
 * full list, and nothing in it is tenant-scoped. `synchronize` is off, so the
 * columns here mirror the migration one for one.
 */
@Entity('provinces')
export class Province {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** The stable human key, e.g. `THR`. Unique across the table. */
  @Column({ length: 5, unique: true })
  code!: string;

  @Column({ name: 'name_fa', length: 100 })
  nameFa!: string;

  @Column({ name: 'name_en', length: 100 })
  nameEn!: string;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  latitude!: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  longitude!: string | null;

  /** Where the province sits in the Home / profile lists. */
  @Column({ name: 'display_order', default: 0 })
  displayOrder!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
