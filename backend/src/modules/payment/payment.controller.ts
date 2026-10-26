import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantHierarchyGuard } from '../auth/guards/tenant-hierarchy.guard';
import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
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

  @Roles('salon_owner', 'line_manager', 'admin')
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

  /**
   * The Zarinpal return URL. The gateway calls this with `Authority`/`Status`
   * in the query string and no JWT of any kind, so it is the one payment route
   * that is `@Public`: the authority value is the credential here, and
   * `completeZarinpalReturn` verifies it against the provider before anything
   * is written.
   */
  @Public()
  @Get('zarinpal/callback')
  callback(@Query('Authority') authority = '', @Query('Status') status = '') {
    return this.payments.completeZarinpalReturn(authority, status);
  }
}

