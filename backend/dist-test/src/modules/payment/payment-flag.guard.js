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
exports.PaymentFeatureFlag = void 0;
const common_1 = require("@nestjs/common");
const payment_service_1 = require("./payment.service");
let PaymentFeatureFlag = class PaymentFeatureFlag {
    payments;
    constructor(payments) {
        this.payments = payments;
    }
    canActivate(_context) {
        if (!this.payments.paymentsEnabled) {
            throw new common_1.ServiceUnavailableException('در فاز اول، پرداخت آنلاین فعال نیست');
        }
        return true;
    }
};
exports.PaymentFeatureFlag = PaymentFeatureFlag;
exports.PaymentFeatureFlag = PaymentFeatureFlag = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [payment_service_1.PaymentService])
], PaymentFeatureFlag);
