import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantHierarchyGuard } from '../auth/guards/tenant-hierarchy.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TicketService } from './ticket.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { AnswerTicketDto } from './dto/answer-ticket.dto';

@ApiTags('tickets')
@Controller('tickets')
@UseGuards(RolesGuard, TenantHierarchyGuard)
@Roles('customer', 'salon_owner', 'line_manager', 'specialist', 'admin', 'super_admin')
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'لیست تیکت‌ها بر اساس نقش کاربر' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.ticketService.listByUserId(user.userId, user.role, user.tenantId ?? undefined);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'دریافت جزئیات یک تیکت' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    // For now, just use service get with userId and role
    return this.ticketService.get(id, user.userId, user.role, user.tenantId ?? undefined);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'ثبت تیکت جدید' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTicketDto) {
    return this.ticketService.create(dto);
  }

  @Patch(':id/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ارجاع تیکت به متخصص یا سالن' })
  assign(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AssignTicketDto) {
    return this.ticketService.assign(id, dto, user.userId);
  }

  @Patch(':id/answer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ثبت پاسخ و تغییر وضعیت تیکت' })
  answer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AnswerTicketDto,
  ) {
    return this.ticketService.answer(id, dto, user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'حذف تیکت' })
  remove(@CurrentUser() _user: AuthenticatedUser, @Param('id') _id: string) {
    // Implement delete if needed
    return { msg: 'Deleted' };
  }
}
