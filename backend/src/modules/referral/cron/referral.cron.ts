import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { LoyaltyPointService } from '../services/loyalty-point.service';
import { ReferralService } from '../services/referral.service';

/** Daily sweep. In-process cron from @nestjs/schedule: no Redis, no queue. */
@Injectable()
export class ReferralCron {
  private readonly logger = new Logger(ReferralCron.name);

  constructor(
    private readonly referrals: ReferralService,
    private readonly loyalty: LoyaltyPointService,
  ) {}

  @Cron('0 3 * * *', { timeZone: 'Asia/Tehran' })
  async handleDailyCleanup(): Promise<void> {
    const expiredReferrals = await this.referrals.expireOldReferrals();
    const expiredPoints = await this.loyalty.expireOldPoints();
    this.logger.log(
      `Daily cleanup: ${expiredReferrals} referrals expired, ${expiredPoints} point grants expired`,
    );
  }
}
