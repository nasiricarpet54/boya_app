import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../../auth/guards/jwt-auth.guard';
import { ADMIN_ROLES } from '../../user/entities/user.entity';
import { setTenantContext } from '../../database/tenant-context';
import { PlatformSetting, SettingScope } from '../entities/platform-setting.entity';
import { UpsertSettingDto } from '../dto/setting.dto';

/** Admin-facing settings. `beauty_app` rows are tenant-scoped; super_admin bypasses. */
@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(PlatformSetting)
    private readonly settingsRepo: Repository<PlatformSetting>,
    private readonly dataSource: DataSource,
  ) {}

  private requireAdmin(user: AuthenticatedUser): void {
    if (!user || !ADMIN_ROLES.includes(user.role as never)) {
      throw new ForbiddenException('این بخش فقط برای مدیر سامانه است');
    }
  }

  /**
   * Reads a setting row for a tenant. Admins and super_admins may read any
   * tenant; a salon owner may read only their own.
   */
  async get(user: AuthenticatedUser, id: string, tenantId?: string): Promise<PlatformSetting> {
    this.requireAdmin(user);

    const setting = await this.settingsRepo.findOne({ where: { id } });
    if (!setting) throw new NotFoundException('تنظیمات یافت نشد');

    if (user.role !== 'super_admin' && setting.tenantId !== user.tenantId) {
      throw new ForbiddenException('دسترسی به این تنظیمات ندارید');
    }

    return setting;
  }

  /** Lists the settings visible to the requesting admin. */
  async list(user: AuthenticatedUser, scope?: SettingScope): Promise<PlatformSetting[]> {
    this.requireAdmin(user);

    const where: { tenantId?: string; scope?: SettingScope } = {};
    if (user.role !== 'super_admin') where.tenantId = user.tenantId;
    if (scope) where.scope = scope;

    return this.settingsRepo.find({ where, order: { scope: 'ASC', updatedAt: 'DESC' } });
  }

  /** Creates or replaces a setting row. Runs in a transaction-local tenant scope. */
  async upsert(user: AuthenticatedUser, dto: UpsertSettingDto): Promise<PlatformSetting> {
    this.requireAdmin(user);

    const targetTenantId = user.role === 'super_admin' ? dto.tenantId : user.tenantId;
    if (!targetTenantId) throw new ForbiddenException('سالنی انتخاب نشده است');

    const existing = await this.settingsRepo.findOne({
      where: { tenantId: targetTenantId, scope: dto.scope },
    });

    return this.dataSource.transaction(async (qr) => {
      await setTenantContext(qr, targetTenantId);

      const payload = (dto.payload as Record<string, unknown>) ?? {};
      if (existing) {
        existing.payload = payload;
        existing.updatedAt = new Date();
        await qr.save(existing);
        return existing;
      }

      const created = qr.create(PlatformSetting, {
        tenantId: targetTenantId,
        scope: dto.scope,
        payload,
      });
      await qr.save(created);
      return created;
    });
  }
}