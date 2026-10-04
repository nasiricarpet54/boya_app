import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { PAYMENT_CAPTURED, PaymentCapturedEvent } from '../../../common/domain-events';
import { ReferralService } from '../services/referral.service';

/**
 * The only bridge between payments and referrals. PaymentModule knows nothing
 * about referrals, so there is no import in either direction.
 */
@Injectable()
export class ReferralListener {
  private readonly logger = new Logger(ReferralListener.name);

  constructor(private readonly referrals: ReferralService) {}

  @OnEvent(PAYMENT_CAPTURED, { async: true })
  async onPaymentCaptured(event: PaymentCapturedEvent): Promise<void> {
    // Only a first captured payment unlocks the reward.
    if (!event.isFirstBooking) return;

    try {
      await this.referrals.completeReferralByReferredUser(event.customerId, event.tenantId);
    } catch (error) {
      // A listener must never throw into the emitter: log and move on.
      this.logger.error(`referral completion failed for ${event.customerId}: ${(error as Error).message}`);
    }
  }
}
