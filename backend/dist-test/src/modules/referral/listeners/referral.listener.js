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
var ReferralListener_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralListener = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const domain_events_1 = require("../../../common/domain-events");
const referral_service_1 = require("../services/referral.service");
let ReferralListener = ReferralListener_1 = class ReferralListener {
    referrals;
    logger = new common_1.Logger(ReferralListener_1.name);
    constructor(referrals) {
        this.referrals = referrals;
    }
    async onPaymentCaptured(event) {
        if (!event.isFirstBooking)
            return;
        try {
            await this.referrals.completeReferralByReferredUser(event.customerId, event.tenantId);
        }
        catch (error) {
            this.logger.error(`referral completion failed for ${event.customerId}: ${error.message}`);
        }
    }
};
exports.ReferralListener = ReferralListener;
__decorate([
    (0, event_emitter_1.OnEvent)(domain_events_1.PAYMENT_CAPTURED, { async: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReferralListener.prototype, "onPaymentCaptured", null);
exports.ReferralListener = ReferralListener = ReferralListener_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [referral_service_1.ReferralService])
], ReferralListener);
