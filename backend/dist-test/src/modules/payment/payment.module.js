"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const booking_module_1 = require("../booking/booking.module");
const specialist_module_1 = require("../specialist/specialist.module");
const payment_flag_guard_1 = require("./payment-flag.guard");
const processed_webhook_event_entity_1 = require("./entities/processed-webhook-event.entity");
const transaction_entity_1 = require("./entities/transaction.entity");
const payment_controller_1 = require("./payment.controller");
const payment_service_1 = require("./payment.service");
const payment_provider_interface_1 = require("./providers/payment-provider.interface");
const zarinpal_payment_provider_1 = require("./providers/zarinpal-payment.provider");
let PaymentModule = class PaymentModule {
};
exports.PaymentModule = PaymentModule;
exports.PaymentModule = PaymentModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([transaction_entity_1.Transaction, processed_webhook_event_entity_1.ProcessedWebhookEvent]), booking_module_1.BookingModule, specialist_module_1.SpecialistModule],
        controllers: [payment_controller_1.PaymentController],
        providers: [
            payment_service_1.PaymentService,
            zarinpal_payment_provider_1.ZarinpalPaymentProvider,
            payment_flag_guard_1.PaymentFeatureFlag,
            { provide: payment_provider_interface_1.PAYMENT_PROVIDER, useExisting: zarinpal_payment_provider_1.ZarinpalPaymentProvider },
        ],
        exports: [payment_service_1.PaymentService, payment_flag_guard_1.PaymentFeatureFlag],
    })
], PaymentModule);
