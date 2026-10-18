import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantHierarchyGuard } from '../auth/guards/tenant-hierarchy.guard';
import { UseGuards,  Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { SupportService } from './support.service';

/**
 * Customer-facing support. Every signed-in user may file a ticket about a
 * booking, so the routes are open to the three roles the customer app and the
 * salon panel share; `admin` reaches the same rows through the admin panel
 * instead, which is where tickets are answered.
 */
@ApiTags('support')
@Roles('customer', 'salon_owner', 'specialist')
@UseGuards(RolesGuard, TenantHierarchyGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('tickets')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ثبت تیکت پشتیبانی (سوال، شکایت، پیشنهاد)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTicketDto) {
    return this.support.create(user.userId, dto);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'فهرست تیکت‌های کاربر واردشده' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return { data: this.support.listMine(user.userId) };
  }
}
