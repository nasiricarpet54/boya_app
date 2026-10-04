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
exports.Specialist = void 0;
const typeorm_1 = require("typeorm");
const approval_status_1 = require("../../../common/approval-status");
let Specialist = class Specialist {
    id;
    tenantId;
    userId;
    bio;
    skills;
    commissionRate;
    isActive;
    createdAt;
    status;
    rejectionReason;
    approvedAt;
    approvedBy;
};
exports.Specialist = Specialist;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Specialist.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tenant_id', type: 'uuid' }),
    __metadata("design:type", String)
], Specialist.prototype, "tenantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], Specialist.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Specialist.prototype, "bio", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: () => `'[]'::jsonb` }),
    __metadata("design:type", Array)
], Specialist.prototype, "skills", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'commission_rate', type: 'decimal', precision: 5, scale: 2, default: 50 }),
    __metadata("design:type", String)
], Specialist.prototype, "commissionRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], Specialist.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Specialist.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'status',
        type: 'enum',
        enumName: 'approval_status',
        enum: [...approval_status_1.APPROVAL_STATUSES],
        default: 'draft',
    }),
    __metadata("design:type", String)
], Specialist.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'rejection_reason', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Specialist.prototype, "rejectionReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'approved_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Specialist.prototype, "approvedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'approved_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Specialist.prototype, "approvedBy", void 0);
exports.Specialist = Specialist = __decorate([
    (0, typeorm_1.Entity)('specialists')
], Specialist);
