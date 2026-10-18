import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantHierarchyGuard } from '../auth/guards/tenant-hierarchy.guard';
import { UseGuards,  Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { InAppNotificationService } from './services/in-app-notification.service';

class NotificationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

/**
 * A customer has no tenant, so their notifications are read across every
 * tenant they have been booked into. Clients send no userId: the acting user
 * always comes from the token.
 */
@ApiTags('notifications')
@UseGuards(RolesGuard, TenantHierarchyGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly inApp: InAppNotificationService) {}

  @Get()
  list(@Query() query: NotificationQuery, @CurrentUser() user: AuthenticatedUser) {
    return this.inApp.listForUser(user.userId, query.page, query.limit);
  }

  @Get('unread-count')
  async unread(@CurrentUser() user: AuthenticatedUser) {
    return { count: await this.inApp.unreadCountForUser(user.userId) };
  }

  @Patch('read-all')
  async readAll(@CurrentUser() user: AuthenticatedUser) {
    return { updated: await this.inApp.markAllReadForUser(user.userId) };
  }

  @Patch(':id/read')
  async readOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.inApp.markReadForUser(user.userId, id);
    return { success: true };
  }
}

