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
exports.LoyaltyPoint = void 0;
const typeorm_1 = require("typeorm");
let LoyaltyPoint = class LoyaltyPoint {
    id;
    userId;
    points;
    type;
    source;
    sourceId;
    description;
    expiresAt;
    createdAt;
};
exports.LoyaltyPoint = LoyaltyPoint;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], LoyaltyPoint.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)('idx_loyalty_points_user'),
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], LoyaltyPoint.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], LoyaltyPoint.prototype, "points", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], LoyaltyPoint.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], LoyaltyPoint.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyPoint.prototype, "sourceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], LoyaltyPoint.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Index)('idx_loyalty_points_expires'),
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], LoyaltyPoint.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], LoyaltyPoint.prototype, "createdAt", void 0);
exports.LoyaltyPoint = LoyaltyPoint = __decorate([
    (0, typeorm_1.Entity)('loyalty_points'),
    (0, typeorm_1.Index)('idx_loyalty_points_user_created', ['userId', 'createdAt']),
    (0, typeorm_1.Check)('chk_loyalty_points_type', `"type" IN ('earned','spent','expired')`),
    (0, typeorm_1.Check)('chk_loyalty_points_positive', `"points" > 0`)
], LoyaltyPoint);
