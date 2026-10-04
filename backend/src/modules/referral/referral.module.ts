import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LoyaltyController } from './controllers/loyalty.controller';
import { ReferralController } from './controllers/referral.controller';
import { ReferralCron } from './cron/referral.cron';
import { LoyaltyPoint } from './entities/loyalty-point.entity';
import { Referral } from './entities/referral.entity';
import { ReferralListener } from './listeners/referral.listener';
import { LoyaltyPointService } from './services/loyalty-point.service';
import { ReferralCodeService } from './services/referral-code.service';
import { ReferralService } from './services/referral.service';

/**
 * Self-contained on purpose: no BookingModule, no PaymentModule, no
 * NotificationModule. Payments arrive as an event and the reward is announced
 * as an event, which is what keeps this module free of cycles.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Referral, LoyaltyPoint])],
  controllers: [ReferralController, LoyaltyController],
  providers: [ReferralService, LoyaltyPointService, ReferralCodeService, ReferralListener, ReferralCron],
  exports: [ReferralService, LoyaltyPointService],
})
export class ReferralModule {}

