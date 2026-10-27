import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantHierarchyGuard } from '../../auth/guards/tenant-hierarchy.guard';
import { ADMIN_ROLES } from '../../user/entities/user.entity';
import { PlatformSetting, SettingScope } from '../entities/platform-setting.entity';
import { SettingsService } from './settings.service';
import { UpsertSettingDto } from './dto/setting.dto';

/** Admin settings: salon identity, hours, fees and notifications. */
@ApiTags('admin/settings')
@Roles(...ADMIN_ROLES)
@UseGuards(RolesGuard, TenantHierarchyGuard)
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'فهرست تنظیمات',
    description: 'دریافت تنظیمات سالن ادمین (یا همه برای super_admin). فیلتر اختیاری بر اساس scope.',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('scope') scope?: SettingScope,
  ): Promise<PlatformSetting[]> {
    return this.settings.list(user, scope);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'جزئیات یک تنظیم' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<PlatformSetting> {
    return this.settings.get(user, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'ایجاد/به‌روزرسانی تنظیمات',
    description: 'اگر برای این tenant و scope ردیفی باشد به‌روز می‌شود، در غیر این صورت سطر جدیدی ساخته می‌شود.',
  })
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertSettingDto,
  ): Promise<PlatformSetting> {
    return this.settings.upsert(user, dto);
  }
}