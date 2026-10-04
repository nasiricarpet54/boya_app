import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BookingModule } from '../booking/booking.module';
import { SpecialistModule } from '../specialist/specialist.module';
import { PaymentFeatureFlag } from './payment-flag.guard';
import { ProcessedWebhookEvent } from './entities/processed-webhook-event.entity';
import { Transaction } from './entities/transaction.entity';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { ZarinpalPaymentProvider } from './providers/zarinpal-payment.provider';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, ProcessedWebhookEvent]), BookingModule, SpecialistModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    ZarinpalPaymentProvider,
    PaymentFeatureFlag,
    { provide: PAYMENT_PROVIDER, useExisting: ZarinpalPaymentProvider },
  ],
  exports: [PaymentService, PaymentFeatureFlag],
})
export class PaymentModule {}
