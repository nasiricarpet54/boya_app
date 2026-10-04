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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../../auth/decorators/current-user.decorator");
const apply_referral_dto_1 = require("../dto/apply-referral.dto");
const referral_service_1 = require("../services/referral.service");
let ReferralController = class ReferralController {
    referrals;
    constructor(referrals) {
        this.referrals = referrals;
    }
    async myCode(user) {
        return { code: await this.referrals.getOrCreateCode(user.userId) };
    }
    async apply(user, dto) {
        const referral = await this.referrals.applyCode(user.userId, dto.code);
        return {
            success: true,
            message: 'کد معرف با موفقیت اعمال شد',
            referralId: referral.id,
            referrerId: referral.referrerId,
        };
    }
    stats(user) {
        return this.referrals.getStats(user.userId);
    }
    async referredUsers(user) {
        return { data: await this.referrals.getReferredUsers(user.userId) };
    }
};
exports.ReferralController = ReferralController;
__decorate([
    (0, common_1.Get)('my-code'),
    (0, swagger_1.ApiOperation)({ summary: 'دریافت کد معرف کاربر جاری' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReferralController.prototype, "myCode", null);
__decorate([
    (0, common_1.Post)('apply'),
    (0, swagger_1.ApiOperation)({ summary: 'اعمال کد معرف کاربر تازه‌وارد' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, apply_referral_dto_1.ApplyReferralDto]),
    __metadata("design:returntype", Promise)
], ReferralController.prototype, "apply", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: 'آمار معرفی‌های کاربر' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ReferralController.prototype, "stats", null);
__decorate([
    (0, common_1.Get)('referred-users'),
    (0, swagger_1.ApiOperation)({ summary: 'لیست کاربران معرفی‌شده' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReferralController.prototype, "referredUsers", null);
exports.ReferralController = ReferralController = __decorate([
    (0, swagger_1.ApiTags)('referrals'),
    (0, common_1.Controller)('referrals'),
    __metadata("design:paramtypes", [referral_service_1.ReferralService])
], ReferralController);
