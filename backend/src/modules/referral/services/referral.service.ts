import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';

import { REFERRAL_COMPLETED, ReferralCompletedEvent } from '../../../common/domain-events';
import { Referral } from '../entities/referral.entity';
import { ReferralCodeService } from './referral-code.service';
import { LoyaltyPointService } from './loyalty-point.service';

/** Whole rials, matching the rest of the schema. */
const REFERRER_REWARD_RIALS = 500_000;
const REFERRED_REWARD_RIALS = 300_000;
const REFERRER_POINTS = 500;
const REFERRED_POINTS = 300;
const CODE_ATTEMPTS = 5;
const REFERRAL_EXPIRY_DAYS = 90;

export interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalEarned: number;
}

/**
 * Owns the referral lifecycle. It never touches another feature module: the
 * only outside signal is the `payment.captured` event that ReferralListener
 * forwards here, and the only output is the `referral.completed` event.
 */
@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    @InjectRepository(Referral) private readonly referrals: Repository<Referral>,
    private readonly codes: ReferralCodeService,
    private readonly loyalty: LoyaltyPointService,
    private readonly emitter: EventEmitter2,
  ) {}

  /**
   * Returns the acting user's live code, creating one when every earlier code
   * has already been consumed. A code is single use, so a referrer whose code
   * is already bound to a friend gets a fresh one.
   */
  async getOrCreateCode(userId: string): Promise<string> {
    const existing = await this.referrals.findOne({
      where: { referrerId: userId, status: 'pending', referredId: IsNull() },
    });
    if (existing) return existing.referralCode;

    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const code = this.codes.generate();
      if (await this.referrals.findOne({ where: { referralCode: code } })) continue;

      await this.referrals.save(
        this.referrals.create({
          referrerId: userId,
          referredId: null,
          referralCode: code,
          referrerReward: String(REFERRER_REWARD_RIALS),
          referredReward: String(REFERRED_REWARD_RIALS),
          status: 'pending',
          completedAt: null,
          expiresAt: new Date(Date.now() + REFERRAL_EXPIRY_DAYS * 86_400_000),
        }),
      );
      return code;
    }

    throw new ConflictException('خطا در تولید کد معرف. لطفاً دوباره تلاش کنید.');
  }

  /**
   * Binds a code to the user who typed it. The referral stays pending: the
   * reward is only unlocked by that user's first captured payment.
   */
  async applyCode(newUserId: string, rawCode: string): Promise<Referral> {
    const code = this.codes.normalize(rawCode);
    if (!code) throw new BadRequestException('کد معرف نامعتبر است');

    const referral = await this.referrals.findOne({ where: { referralCode: code, status: 'pending' } });
    if (!referral) throw new NotFoundException('کد معرف یافت نشد یا قبلاً استفاده شده است');
    if (referral.referrerId === newUserId) {
      throw new BadRequestException('شما نمی‌توانید از کد معرف خودتان استفاده کنید');
    }
    if (referral.referredId) {
      throw new ConflictException('این کد معرف قبلاً توسط کاربر دیگری استفاده شده است');
    }
    if (referral.expiresAt && referral.expiresAt.getTime() <= Date.now()) {
      await this.referrals.update({ id: referral.id, status: 'pending' }, { status: 'expired' });
      throw new BadRequestException('این کد معرف منقضی شده است');
    }

    const claimed = await this.referrals.update(
      { id: referral.id, status: 'pending', referredId: IsNull() },
      { referredId: newUserId },
    );
    if (!claimed.affected) throw new ConflictException('این کد معرف همین لحظه استفاده شد');
    return { ...referral, referredId: newUserId };
  }

  /**
   * Called from ReferralListener when the referred user's first payment is
   * captured. The status flip is a conditional UPDATE, so two callbacks racing
   * on the same payment cannot award the points twice.
   */
  async completeReferralByReferredUser(referredUserId: string, tenantId: string): Promise<void> {
    const referral = await this.referrals.findOne({ where: { referredId: referredUserId, status: 'pending' } });
    if (!referral) return;

    if (referral.expiresAt && referral.expiresAt.getTime() <= Date.now()) {
      await this.referrals.update({ id: referral.id, status: 'pending' }, { status: 'expired' });
      return;
    }

    const claimed = await this.referrals.update(
      { id: referral.id, status: 'pending' },
      { status: 'completed', completedAt: new Date() },
    );
    if (!claimed.affected) return;

    await this.loyalty.award({
      userId: referral.referrerId,
      points: REFERRER_POINTS,
      source: 'referral',
      description: 'پاداش معرفی دوست',
    });
    await this.loyalty.award({
      userId: referredUserId,
      points: REFERRED_POINTS,
      source: 'referral',
      description: 'پاداش خوش‌آمدگویی',
    });

    const payload: ReferralCompletedEvent = {
      referralId: referral.id,
      tenantId,
      referrerId: referral.referrerId,
      referredId: referredUserId,
      referrerReward: Number(referral.referrerReward),
      referredReward: Number(referral.referredReward),
      referrerPoints: REFERRER_POINTS,
      referredPoints: REFERRED_POINTS,
    };
    this.emitter.emit(REFERRAL_COMPLETED, payload);
    this.logger.log(`Referral completed: ${referral.id}`);
  }

  async getStats(userId: string): Promise<ReferralStats> {
    const all = await this.referrals.find({ where: { referrerId: userId } });
    const completed = all.filter((row) => row.status === 'completed');

    return {
      totalReferrals: all.length,
      completedReferrals: completed.length,
      pendingReferrals: all.filter((row) => row.status === 'pending').length,
      totalEarned: completed.reduce((sum, row) => sum + Number(row.referrerReward), 0),
    };
  }

  getReferredUsers(userId: string): Promise<Referral[]> {
    return this.referrals.find({ where: { referrerId: userId }, order: { createdAt: 'DESC' }, take: 50 });
  }

  /** Cron sweep: pending codes past their deadline stop being usable. */
  async expireOldReferrals(): Promise<number> {
    const result = await this.referrals.update(
      { status: 'pending', expiresAt: LessThanOrEqual(new Date()) },
      { status: 'expired' },
    );
    return result.affected ?? 0;
  }
}
