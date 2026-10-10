import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { BookingService } from './booking.service';

class RejectBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(280)
  reason?: string;
}

/**
 * Body of POST /bookings. `customerId` is deliberately absent: it is taken
 * from the token so a caller cannot book on behalf of someone else.
 */
class CreateBookingDto {
  @IsUUID('loose')
  tenantId!: string;

  @IsUUID('loose')
  specialistId!: string;

  @IsUUID('loose')
  serviceId!: string;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  @MinLength(1)
  notes?: string;

  /** ADR-011: ask the specialist to come to the customer's address. */
  @IsOptional()
  @IsBoolean()
  isMobile?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerAddress?: string;

  @IsOptional()
  @IsNumber()
  customerLatitude?: number;

  @IsOptional()
  @IsNumber()
  customerLongitude?: number;
}

/**
 * Tenant and role come from the verified token, never from the request, so a
 * caller cannot act on a salon they do not belong to by editing a query string.
 */
@ApiTags('bookings')
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  /**
   * The current customer's bookings. Protected: the JWT decides whose rows
   * these are, never the query string.
   */
  @Get()
  @ApiOperation({ summary: 'رزروهای مشتری جاری (نوترین اول)' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.bookings.listForCustomer(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'ثبت درخواست رزرو توسط مشتری (pending)' })
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bookings.create({
      tenantId: dto.tenantId,
      specialistId: dto.specialistId,
      serviceId: dto.serviceId,
      // The customer is whoever the token says; never the request body.
      customerId: user.userId,
      startsAt: new Date(dto.startsAt),
      notes: dto.notes ?? null,
      isMobile: dto.isMobile ?? false,
      customerAddress: dto.customerAddress,
      customerLatitude: dto.customerLatitude,
      customerLongitude: dto.customerLongitude,
    });
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تأیید رزرو توسط سالن (pending → confirmed)' })
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookings.approve(user, id);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'رد رزرو توسط سالن (pending → cancelled)' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectBookingDto,
  ) {
    return this.bookings.reject(user, id, dto.reason ?? null);
  }

  @Post(':id/mark-visited')
  @ApiOperation({ summary: 'ثبت حضور مشتری (confirmed → completed)' })
  markVisited(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookings.markVisited(user, id);
  }

  @Post(':id/confirm-visit')
  @ApiOperation({ summary: 'تأیید حضور از سمت مشتری' })
  confirmVisit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookings.confirmVisitByCustomer(user, id);
  }
}
