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
exports.PaymentController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const payment_flag_guard_1 = require("./payment-flag.guard");
const payment_service_1 = require("./payment.service");
class InitiatePaymentDto {
    tenantId;
    bookingId;
}
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], InitiatePaymentDto.prototype, "tenantId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], InitiatePaymentDto.prototype, "bookingId", void 0);
let PaymentController = class PaymentController {
    payments;
    constructor(payments) {
        this.payments = payments;
    }
    initiate(body) {
        return this.payments.initiate(body.tenantId, body.bookingId);
    }
    callback(authority = '', status = '') {
        return this.payments.completeZarinpalReturn(authority, status);
    }
};
exports.PaymentController = PaymentController;
__decorate([
    (0, common_1.Post)('initiate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [InitiatePaymentDto]),
    __metadata("design:returntype", void 0)
], PaymentController.prototype, "initiate", null);
__decorate([
    (0, common_1.Get)('zarinpal/callback'),
    __param(0, (0, common_1.Query)('Authority')),
    __param(1, (0, common_1.Query)('Status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PaymentController.prototype, "callback", null);
exports.PaymentController = PaymentController = __decorate([
    (0, swagger_1.ApiTags)('payments'),
    (0, common_1.Controller)('payments'),
    (0, common_1.UseGuards)(payment_flag_guard_1.PaymentFeatureFlag),
    __metadata("design:paramtypes", [payment_service_1.PaymentService])
], PaymentController);
