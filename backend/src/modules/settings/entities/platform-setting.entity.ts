import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** How a salon presents itself and runs its business. */
export enum SettingScope {
  General = 'general',
  WorkingHours = 'working_hours',
  Fees = 'fees',
  Notifications = 'notifications',
}

/**
 * Per-tenant platform settings.
 *
 * One row per tenant per scope; `payload` holds the scope-specific keys as
 * JSONB so a new setting can be added without a migration. `tenant_id` is the
 * isolation key — `beauty_app` sees only its own rows.
 */
@Entity('platform_settings')
@Index('idx_platform_settings_tenant_id', ['tenantId'])
@Index('idx_platform_settings_tenant_scope', ['tenantId', 'scope'])
@Check('platform_settings_scope_check', `"scope" IN ('general','working_hours','fees','notifications')`)
export class PlatformSetting {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 20, default: SettingScope.General })
  scope!: SettingScope;

  /** Scope-specific keys. `general` holds name/slug/address/phone/logo. */
  @Column({ type: 'jsonb', default: '{}' })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}