import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantHierarchyGuard } from '../auth/guards/tenant-hierarchy.guard';
import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { PaymentFeatureFlag } from './payment-flag.guard';
import { PaymentService } from './payment.service';

/**
 * Body of POST /payments/initiate. `tenantId` is deliberately absent: it is
 * taken from the token so a caller cannot start a payment for a salon they do
 * not belong to by editing the request.
 */
class InitiatePaymentDto {
  @IsUUID()
  bookingId!: string;
}

@ApiTags('payments')
@UseGuards(RolesGuard, TenantHierarchyGuard)
@Controller('payments')
@UseGuards(PaymentFeatureFlag)
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Post('initiate')
  @ApiOperation({ summary: 'شروع پرداخت آنلاین برای یک رزرو (tenant از توکن)' })
  initiate(@Body() body: InitiatePaymentDto, @CurrentUser() user: AuthenticatedUser) {
    // The salon is whoever the token says; never the request body. A customer's
    // token carries no tenant and may not start a salon payment.
    if (!user?.tenantId) {
      throw new ForbiddenException('این عملیات فقط برای سالن مجاز است');
    }
    return this.payments.initiate(user.tenantId, body.bookingId);
  }

  @Get('zarinpal/callback')
  callback(@Query('Authority') authority = '', @Query('Status') status = '') {
    return this.payments.completeZarinpalReturn(authority, status);
  }
}

