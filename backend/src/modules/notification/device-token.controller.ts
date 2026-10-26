import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantHierarchyGuard } from '../auth/guards/tenant-hierarchy.guard';
import { UseGuards,  Body, Controller, Delete, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { USER_ROLES } from '../user/entities/user.entity';
import { DevicePlatform } from './entities/device-token.entity';
import { PushNotificationService } from './services/push-notification.service';

/** Kept in step with `DevicePlatform`; `@IsIn` needs a runtime list. */
const PLATFORMS: DevicePlatform[] = ['android', 'ios', 'web'];

class RegisterDeviceDto {
  @IsString()
  @MinLength(8)
  @MaxLength(4096)
  token!: string;

  @IsIn(PLATFORMS)
  platform!: DevicePlatform;
}

/**
 * Device registration for FCM.
 *
 * The token is stored against the verified JWT user, never a body-supplied id,
 * so one account cannot claim another account's handset. Not marked `@Public`,
 * so the global JwtAuthGuard already rejects an anonymous call.
 */
@Roles(...USER_ROLES)
@ApiTags('devices')
@UseGuards(RolesGuard, TenantHierarchyGuard)
@Controller('devices')
export class DeviceTokenController {
  constructor(private readonly push: PushNotificationService) {}

  @Post()
  async register(@Body() dto: RegisterDeviceDto, @CurrentUser() user: AuthenticatedUser) {
    await this.push.register(user.userId, dto.token, dto.platform);
    return { success: true };
  }

  @Delete()
  async unregister(@Body() dto: RegisterDeviceDto, @CurrentUser() user: AuthenticatedUser) {
    await this.push.unregister(user.userId, dto.token);
    return { success: true };
  }
}