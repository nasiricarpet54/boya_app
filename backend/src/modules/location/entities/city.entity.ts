import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Province } from './province.entity';

/**
 * A city belonging to a province (migration 1730000000038, seeded by
 * 1730000000039).
 *
 * Tenant-agnostic reference data, so no RLS. The `(province_id, code)` pair is
 * unique in the schema; the entity leaves that to the migration rather than
 * duplicating it as a decorator, the way `Province.code` carries its own
 * single-column uniqueness.
 */
@Entity('cities')
export class City {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'province_id' })
  provinceId!: string;

  @ManyToOne(() => Province)
  @JoinColumn({ name: 'province_id' })
  province!: Province;

  /** Unique within the province, e.g. `THR-TEH`. */
  @Column({ length: 10 })
  code!: string;

  @Column({ name: 'name_fa', length: 100 })
  nameFa!: string;

  @Column({ name: 'name_en', length: 100 })
  nameEn!: string;

  /** The province's seat, listed first in every city picker. */
  @Column({ name: 'is_capital', default: false })
  isCapital!: boolean;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  latitude!: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  longitude!: string | null;

  /** Position inside this city's own province. */
  @Column({ name: 'display_order', default: 0 })
  displayOrder!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
