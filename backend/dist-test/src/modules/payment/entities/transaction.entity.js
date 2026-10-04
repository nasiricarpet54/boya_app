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
exports.Transaction = void 0;
const typeorm_1 = require("typeorm");
let Transaction = class Transaction {
    id;
    tenantId;
    bookingId;
    provider;
    providerIntentId;
    status;
    totalAmount;
    platformFee;
    specialistShare;
    salonShare;
    refundAmount;
    providerRefundId;
    metadata;
    createdAt;
    capturedAt;
    refundedAt;
};
exports.Transaction = Transaction;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Transaction.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tenant_id', type: 'uuid' }),
    __metadata("design:type", String)
], Transaction.prototype, "tenantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'booking_id', type: 'uuid', unique: true }),
    __metadata("design:type", String)
], Transaction.prototype, "bookingId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], Transaction.prototype, "provider", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'provider_intent_id', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Transaction.prototype, "providerIntentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'pending' }),
    __metadata("design:type", String)
], Transaction.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_amount', type: 'decimal', precision: 12, scale: 0 }),
    __metadata("design:type", String)
], Transaction.prototype, "totalAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'platform_fee', type: 'decimal', precision: 12, scale: 0, default: 0 }),
    __metadata("design:type", String)
], Transaction.prototype, "platformFee", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'specialist_share', type: 'decimal', precision: 12, scale: 0, default: 0 }),
    __metadata("design:type", String)
], Transaction.prototype, "specialistShare", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'salon_share', type: 'decimal', precision: 12, scale: 0, default: 0 }),
    __metadata("design:type", String)
], Transaction.prototype, "salonShare", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'refund_amount', type: 'decimal', precision: 12, scale: 0, default: 0 }),
    __metadata("design:type", String)
], Transaction.prototype, "refundAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'provider_refund_id', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], Transaction.prototype, "providerRefundId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => `'{}'::jsonb` }),
    __metadata("design:type", Object)
], Transaction.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Transaction.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'captured_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Transaction.prototype, "capturedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'refunded_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Transaction.prototype, "refundedAt", void 0);
exports.Transaction = Transaction = __decorate([
    (0, typeorm_1.Entity)('transactions')
], Transaction);
