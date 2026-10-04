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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Referral = void 0;
const typeorm_1 = require("typeorm");
let Referral = class Referral {
    id;
    referrerId;
    referredId;
    referralCode;
    referrerReward;
    referredReward;
    status;
    completedAt;
    expiresAt;
    createdAt;
};
exports.Referral = Referral;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Referral.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)('idx_referrals_referrer'),
    (0, typeorm_1.Column)({ name: 'referrer_id', type: 'uuid' }),
    __metadata("design:type", String)
], Referral.prototype, "referrerId", void 0);
__decorate([
    (0, typeorm_1.Index)('idx_referrals_referred'),
    (0, typeorm_1.Column)({ name: 'referred_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Referral.prototype, "referredId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'referral_code', type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], Referral.prototype, "referralCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'referrer_reward', type: 'decimal', precision: 12, scale: 0, default: 0 }),
    __metadata("design:type", String)
], Referral.prototype, "referrerReward", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'referred_reward', type: 'decimal', precision: 12, scale: 0, default: 0 }),
    __metadata("design:type", String)
], Referral.prototype, "referredReward", void 0);
__decorate([
    (0, typeorm_1.Index)('idx_referrals_status'),
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'pending' }),
    __metadata("design:type", String)
], Referral.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'completed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Referral.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Referral.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Referral.prototype, "createdAt", void 0);
exports.Referral = Referral = __decorate([
    (0, typeorm_1.Entity)('referrals'),
    (0, typeorm_1.Unique)('uq_referrals_code', ['referralCode']),
    (0, typeorm_1.Check)('chk_referrals_status', `"status" IN ('pending','completed','expired')`)
], Referral);
