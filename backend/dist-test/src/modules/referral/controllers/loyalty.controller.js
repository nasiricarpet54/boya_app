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
exports.LoyaltyController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../../auth/decorators/current-user.decorator");
const loyalty_point_service_1 = require("../services/loyalty-point.service");
let LoyaltyController = class LoyaltyController {
    loyalty;
    constructor(loyalty) {
        this.loyalty = loyalty;
    }
    async balance(user) {
        return { points: await this.loyalty.getBalance(user.userId) };
    }
    async history(user, limit = '50') {
        const parsed = Number.parseInt(limit, 10);
        const take = Number.isNaN(parsed) || parsed <= 0 ? 50 : Math.min(parsed, 200);
        return { data: await this.loyalty.getHistory(user.userId, take) };
    }
};
exports.LoyaltyController = LoyaltyController;
__decorate([
    (0, common_1.Get)('balance'),
    (0, swagger_1.ApiOperation)({ summary: 'موجودی امتیاز کاربر' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LoyaltyController.prototype, "balance", null);
__decorate([
    (0, common_1.Get)('history'),
    (0, swagger_1.ApiOperation)({ summary: 'تاریخچه امتیازات' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], LoyaltyController.prototype, "history", null);
exports.LoyaltyController = LoyaltyController = __decorate([
    (0, swagger_1.ApiTags)('loyalty'),
    (0, common_1.Controller)('loyalty'),
    __metadata("design:paramtypes", [loyalty_point_service_1.LoyaltyPointService])
], LoyaltyController);
