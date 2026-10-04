"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ReferralService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const domain_events_1 = require("../../../common/domain-events");
const referral_entity_1 = require("../entities/referral.entity");
const referral_code_service_1 = require("./referral-code.service");
const loyalty_point_service_1 = require("./loyalty-point.service");
const REFERRER_REWARD_RIALS = 500_000;
const REFERRED_REWARD_RIALS = 300_000;
const REFERRER_POINTS = 500;
const REFERRED_POINTS = 300;
const CODE_ATTEMPTS = 5;
const REFERRAL_EXPIRY_DAYS = 90;
let ReferralService = ReferralService_1 = class ReferralService {
    referrals;
    codes;
    loyalty;
    emitter;
    logger = new common_1.Logger(ReferralService_1.name);
    constructor(referrals, codes, loyalty, emitter) {
        this.referrals = referrals;
        this.codes = codes;
        this.loyalty = loyalty;
        this.emitter = emitter;
    }
    async getOrCreateCode(userId) {
        const existing = await this.referrals.findOne({
            where: { referrerId: userId, status: 'pending', referredId: (0, typeorm_2.IsNull)() },
        });
        if (existing)
            return existing.referralCode;
        for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
            const code = this.codes.generate();
            if (await this.referrals.findOne({ where: { referralCode: code } }))
                continue;
            await this.referrals.save(this.referrals.create({
                referrerId: userId,
                referredId: null,
                referralCode: code,
                referrerReward: String(REFERRER_REWARD_RIALS),
                referredReward: String(REFERRED_REWARD_RIALS),
                status: 'pending',
                completedAt: null,
                expiresAt: new Date(Date.now() + REFERRAL_EXPIRY_DAYS * 86_400_000),
            }));
            return code;
        }
        throw new common_1.ConflictException('خطا در تولید کد معرف. لطفاً دوباره تلاش کنید.');
    }
    async applyCode(newUserId, rawCode) {
        const code = this.codes.normalize(rawCode);
        if (!code)
            throw new common_1.BadRequestException('کد معرف نامعتبر است');
        const referral = await this.referrals.findOne({ where: { referralCode: code, status: 'pending' } });
        if (!referral)
            throw new common_1.NotFoundException('کد معرف یافت نشد یا قبلاً استفاده شده است');
        if (referral.referrerId === newUserId) {
            throw new common_1.BadRequestException('شما نمی‌توانید از کد معرف خودتان استفاده کنید');
        }
        if (referral.referredId) {
            throw new common_1.ConflictException('این کد معرف قبلاً توسط کاربر دیگری استفاده شده است');
        }
        if (referral.expiresAt && referral.expiresAt.getTime() <= Date.now()) {
            await this.referrals.update({ id: referral.id, status: 'pending' }, { status: 'expired' });
            throw new common_1.BadRequestException('این کد معرف منقضی شده است');
        }
        const claimed = await this.referrals.update({ id: referral.id, status: 'pending', referredId: (0, typeorm_2.IsNull)() }, { referredId: newUserId });
        if (!claimed.affected)
            throw new common_1.ConflictException('این کد معرف همین لحظه استفاده شد');
        return { ...referral, referredId: newUserId };
    }
    async completeReferralByReferredUser(referredUserId, tenantId) {
        const referral = await this.referrals.findOne({ where: { referredId: referredUserId, status: 'pending' } });
        if (!referral)
            return;
        if (referral.expiresAt && referral.expiresAt.getTime() <= Date.now()) {
            await this.referrals.update({ id: referral.id, status: 'pending' }, { status: 'expired' });
            return;
        }
        const claimed = await this.referrals.update({ id: referral.id, status: 'pending' }, { status: 'completed', completedAt: new Date() });
        if (!claimed.affected)
            return;
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
        const payload = {
            referralId: referral.id,
            tenantId,
            referrerId: referral.referrerId,
            referredId: referredUserId,
            referrerReward: Number(referral.referrerReward),
            referredReward: Number(referral.referredReward),
            referrerPoints: REFERRER_POINTS,
            referredPoints: REFERRED_POINTS,
        };
        this.emitter.emit(domain_events_1.REFERRAL_COMPLETED, payload);
        this.logger.log(`Referral completed: ${referral.id}`);
    }
    async getStats(userId) {
        const all = await this.referrals.find({ where: { referrerId: userId } });
        const completed = all.filter((row) => row.status === 'completed');
        return {
            totalReferrals: all.length,
            completedReferrals: completed.length,
            pendingReferrals: all.filter((row) => row.status === 'pending').length,
            totalEarned: completed.reduce((sum, row) => sum + Number(row.referrerReward), 0),
        };
    }
    getReferredUsers(userId) {
        return this.referrals.find({ where: { referrerId: userId }, order: { createdAt: 'DESC' }, take: 50 });
    }
    async expireOldReferrals() {
        const result = await this.referrals.update({ status: 'pending', expiresAt: (0, typeorm_2.LessThanOrEqual)(new Date()) }, { status: 'expired' });
        return result.affected ?? 0;
    }
};
exports.ReferralService = ReferralService;
exports.ReferralService = ReferralService = ReferralService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(referral_entity_1.Referral)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        referral_code_service_1.ReferralCodeService,
        loyalty_point_service_1.LoyaltyPointService,
        event_emitter_1.EventEmitter2])
], ReferralService);
