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
var ReferralCron_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralCron = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const loyalty_point_service_1 = require("../services/loyalty-point.service");
const referral_service_1 = require("../services/referral.service");
let ReferralCron = ReferralCron_1 = class ReferralCron {
    referrals;
    loyalty;
    logger = new common_1.Logger(ReferralCron_1.name);
    constructor(referrals, loyalty) {
        this.referrals = referrals;
        this.loyalty = loyalty;
    }
    async handleDailyCleanup() {
        const expiredReferrals = await this.referrals.expireOldReferrals();
        const expiredPoints = await this.loyalty.expireOldPoints();
        this.logger.log(`Daily cleanup: ${expiredReferrals} referrals expired, ${expiredPoints} point grants expired`);
    }
};
exports.ReferralCron = ReferralCron;
__decorate([
    (0, schedule_1.Cron)('0 3 * * *', { timeZone: 'Asia/Tehran' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReferralCron.prototype, "handleDailyCleanup", null);
exports.ReferralCron = ReferralCron = ReferralCron_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [referral_service_1.ReferralService,
        loyalty_point_service_1.LoyaltyPointService])
], ReferralCron);
