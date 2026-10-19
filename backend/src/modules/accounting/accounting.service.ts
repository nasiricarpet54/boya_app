import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';

import { AccountingLedger } from './accounting-ledger.entity';
import { Booking } from '../booking/booking.entity';
import { SpecialistService } from '../specialist/specialist.service';

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    @InjectRepository(AccountingLedger)
    private readonly ledgers: Repository<AccountingLedger>,
    private readonly specialists: SpecialistService,
  ) {}

  @OnEvent('booking.completed')
  async handleBookingCompleted(booking: Booking): Promise<void> {
    try {
      this.logger.log(`Recording accounting ledger for completed booking ${booking.id}`);

      // We should check what the payment method was. For Phase 3, we just default to 'cash' if unknown.
      // Wait, is there a payment_method on booking? No. Let's default to cash or pos.
      const paymentMethod = 'pos'; // Simplified for now since we don't capture payment method in UI yet

      const specialist = await this.specialists.findById(booking.tenantId, booking.specialistId);
      const specialistSharePercent = Number(specialist.commissionRate);
      const salonSharePercent = 100 - specialistSharePercent;
      const totalAmount = Number(booking.totalPrice);

      const specialistShareAmount = (totalAmount * specialistSharePercent) / 100;
      const salonShareAmount = (totalAmount * salonSharePercent) / 100;

      await this.ledgers.save(
        this.ledgers.create({
          tenantId: booking.tenantId,
          bookingId: booking.id,
          paymentMethod,
          totalAmount: String(totalAmount),
          specialistSharePercent: String(specialistSharePercent),
          salonSharePercent: String(salonSharePercent),
          specialistShareAmount: String(specialistShareAmount),
          salonShareAmount: String(salonShareAmount),
          isSettledInternally: false,
        }),
      );

      this.logger.log(`Accounting ledger recorded for booking ${booking.id}`);
    } catch (error) {
      this.logger.error(`Failed to record accounting ledger for booking ${booking.id}:`, error);
    }
  }
}
