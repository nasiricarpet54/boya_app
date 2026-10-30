import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminSupportService, SupportTicketListPage } from './admin-support.service';
import { AdminUpdateTicketDto } from './dto/admin-update-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { SupportTicket } from './support-ticket.entity';

@ApiTags('admin/support')
@ApiBearerAuth()
@Roles('admin', 'super_admin')
@UseGuards(RolesGuard)
@Controller('admin/support/tickets')
export class AdminSupportController {
  constructor(private readonly support: AdminSupportService) {}

  @Get()
  @ApiOperation({ summary: 'List support tickets (filtered)' })
  list(@Query() query: ListTicketsQueryDto): Promise<SupportTicketListPage> {
    return this.support.listAll(query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ticket (status, priority, admin response)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateTicketDto,
  ): Promise<SupportTicket> {
    return this.support.update(id, user.userId, dto);
  }
}