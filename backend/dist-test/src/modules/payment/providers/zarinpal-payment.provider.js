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
var ZarinpalPaymentProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZarinpalPaymentProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let ZarinpalPaymentProvider = ZarinpalPaymentProvider_1 = class ZarinpalPaymentProvider {
    config;
    name = 'zarinpal';
    logger = new common_1.Logger(ZarinpalPaymentProvider_1.name);
    constructor(config) {
        this.config = config;
    }
    async createPaymentIntent(input) {
        const response = await fetch(`${this.baseUrl()}/v4/payment/request.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                merchant_id: this.merchantId(),
                amount: input.amount,
                description: input.description ?? `رزرو ${input.bookingId}`,
                callback_url: `${this.callbackUrl()}?bookingId=${input.bookingId}`,
                metadata: { booking_id: input.bookingId, tenant_id: input.tenantId },
            }),
        });
        if (!response.ok)
            throw new common_1.BadRequestException('خطا در ارتباط با درگاه پرداخت');
        const data = (await response.json());
        const authority = data.data?.authority;
        if (data.data?.code !== 100 || !authority) {
            throw new common_1.BadRequestException('خطا در ایجاد تراکنش. لطفاً دوباره تلاش کنید.');
        }
        return {
            providerIntentId: authority,
            redirectUrl: `${this.startPayUrl()}/${authority}`,
            status: 'requires_action',
        };
    }
    async verifyPayment(authority, amount) {
        const response = await fetch(`${this.baseUrl()}/v4/payment/verify.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ merchant_id: this.merchantId(), amount, authority }),
        });
        if (!response.ok)
            return { success: false };
        const data = (await response.json());
        if (data.data?.code === 100 || data.data?.code === 101) {
            return { success: true, refId: data.data.ref_id == null ? undefined : String(data.data.ref_id) };
        }
        return { success: false };
    }
    refund(input) {
        this.logger.warn(`Zarinpal refund for ${input.providerIntentId} needs manual settlement`);
        return Promise.resolve({
            providerRefundId: `manual-${input.providerIntentId}`,
            amount: input.amount,
            status: 'pending',
        });
    }
    merchantId() {
        return this.config.getOrThrow('ZARINPAL_MERCHANT_ID');
    }
    callbackUrl() {
        return this.config.getOrThrow('ZARINPAL_CALLBACK_URL');
    }
    baseUrl() {
        return this.config.get('ZARINPAL_SANDBOX') === 'true'
            ? 'https://sandbox.zarinpal.com/pg'
            : 'https://payment.zarinpal.com/pg';
    }
    startPayUrl() {
        return this.config.get('ZARINPAL_SANDBOX') === 'true'
            ? 'https://sandbox.zarinpal.com/pg/StartPay'
            : 'https://www.zarinpal.com/pg/StartPay';
    }
};
exports.ZarinpalPaymentProvider = ZarinpalPaymentProvider;
exports.ZarinpalPaymentProvider = ZarinpalPaymentProvider = ZarinpalPaymentProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ZarinpalPaymentProvider);
