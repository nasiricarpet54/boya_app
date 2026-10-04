import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

import { PaymentFeatureFlag } from './payment-flag.guard';
import { PaymentService } from './payment.service';

class InitiatePaymentDto {
  @IsUUID()
  tenantId!: string;

  @IsUUID()
  bookingId!: string;
}

@ApiTags('payments')
@Controller('payments')
@UseGuards(PaymentFeatureFlag)
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Post('initiate')
  initiate(@Body() body: InitiatePaymentDto) {
    return this.payments.initiate(body.tenantId, body.bookingId);
  }

  @Get('zarinpal/callback')
  callback(@Query('Authority') authority = '', @Query('Status') status = '') {
    return this.payments.completeZarinpalReturn(authority, status);
  }
}

