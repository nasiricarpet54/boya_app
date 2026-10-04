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
exports.Service = void 0;
const typeorm_1 = require("typeorm");
let Service = class Service {
    id;
    tenantId;
    lineId;
    name;
    description;
    durationMinutes;
    price;
    depositRequired;
    depositAmount;
    isActive;
    createdAt;
};
exports.Service = Service;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Service.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tenant_id', type: 'uuid' }),
    __metadata("design:type", String)
], Service.prototype, "tenantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'line_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Service.prototype, "lineId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], Service.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Service.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'duration_minutes', type: 'int' }),
    __metadata("design:type", Number)
], Service.prototype, "durationMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 0 }),
    __metadata("design:type", String)
], Service.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deposit_required', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Service.prototype, "depositRequired", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deposit_amount', type: 'decimal', precision: 12, scale: 0, nullable: true }),
    __metadata("design:type", Object)
], Service.prototype, "depositAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], Service.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Service.prototype, "createdAt", void 0);
exports.Service = Service = __decorate([
    (0, typeorm_1.Entity)('services')
], Service);
