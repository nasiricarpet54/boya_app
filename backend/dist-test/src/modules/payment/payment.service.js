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
var PaymentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const booking_entity_1 = require("../booking/booking.entity");
const booking_service_1 = require("../booking/booking.service");
const specialist_service_1 = require("../specialist/specialist.service");
const processed_webhook_event_entity_1 = require("./entities/processed-webhook-event.entity");
const transaction_entity_1 = require("./entities/transaction.entity");
const payment_provider_interface_1 = require("./providers/payment-provider.interface");
const domain_events_1 = require("../../common/domain-events");
const FIRST_BOOKING_FEE = 0.2;
let PaymentService = PaymentService_1 = class PaymentService {
    transactions;
    processed;
    provider;
    bookings;
    specialists;
    dataSource;
    emitter;
    config;
    logger = new common_1.Logger(PaymentService_1.name);
    constructor(transactions, processed, provider, bookings, specialists, dataSource, emitter, config) {
        this.transactions = transactions;
        this.processed = processed;
        this.provider = provider;
        this.bookings = bookings;
        this.specialists = specialists;
        this.dataSource = dataSource;
        this.emitter = emitter;
        this.config = config;
        if (!this.paymentsEnabled) {
            this.logger.log('Payments disabled (Phase 1 mode)');
        }
    }
    get paymentsEnabled() {
        return this.config.get('PAYMENTS_ENABLED', false) === true;
    }
    assertEnabled() {
        if (!this.paymentsEnabled) {
            throw new common_1.ServiceUnavailableException('در فاز اول، پرداخت آنلاین فعال نیست');
        }
    }
    async initiate(tenantId, bookingId) {
        this.assertEnabled();
        const booking = await this.bookings.findById(tenantId, bookingId);
        if (booking.status !== booking_entity_1.BookingStatus.Pending)
            throw new common_1.BadRequestException('این رزرو در وضعیت قابل پرداخت نیست');
        const existing = await this.transactions.findOne({ where: { tenantId, bookingId } });
        if (existing && existing.status !== 'failed')
            throw new common_1.ConflictException('برای این رزرو قبلاً تراکنش ایجاد شده است');
        const total = Number(booking.totalPrice);
        const first = await this.isFirstCapturedBooking(tenantId, booking.customerId);
        const platformFee = first ? Math.round(total * FIRST_BOOKING_FEE) : 0;
        const specialist = await this.specialists.findById(tenantId, booking.specialistId);
        const specialistShare = Math.round((total * Number(specialist.commissionRate)) / 100);
        const intent = await this.provider.createPaymentIntent({
            amount: total,
            bookingId,
            tenantId,
            description: `رزرو ${bookingId}`,
        });
        return this.transactions.save(this.transactions.create({
            tenantId,
            bookingId,
            provider: this.provider.name,
            providerIntentId: intent.providerIntentId,
            status: 'pending',
            totalAmount: String(total),
            platformFee: String(platformFee),
            specialistShare: String(specialistShare),
            salonShare: String(total - specialistShare),
            metadata: { redirectUrl: intent.redirectUrl, isFirstBooking: first },
        }));
    }
    async completeZarinpalReturn(authority, status) {
        this.assertEnabled();
        if (status !== 'OK' || !authority)
            return null;
        const eventId = `zarinpal:${authority}`;
        if (await this.processed.findOne({ where: { eventId } }))
            return this.findByAuthority(authority);
        const transaction = await this.findByAuthority(authority);
        if (!transaction || transaction.status === 'captured')
            return transaction;
        const verified = await this.provider.verifyPayment(authority, Number(transaction.totalAmount));
        if (!verified.success) {
            transaction.status = 'failed';
            return this.transactions.save(transaction);
        }
        return this.dataSource.transaction(async (manager) => {
            transaction.status = 'captured';
            transaction.capturedAt = new Date();
            transaction.metadata = { ...transaction.metadata, refId: verified.refId };
            const saved = await manager.save(transaction);
            await manager.save(processed_webhook_event_entity_1.ProcessedWebhookEvent, { eventId, eventType: 'zarinpal.verified' });
            const booking = await this.bookings.findById(saved.tenantId, saved.bookingId);
            this.emitter.emit(domain_events_1.PAYMENT_CAPTURED, {
                bookingId: saved.bookingId,
                tenantId: saved.tenantId,
                customerId: booking.customerId,
                specialistId: booking.specialistId,
                amount: Number(saved.totalAmount),
                isFirstBooking: saved.metadata?.isFirstBooking === true,
            });
            return saved;
        });
    }
    async markRefundPending(tenantId, bookingId, reason) {
        this.assertEnabled();
        const transaction = await this.transactions.findOne({ where: { tenantId, bookingId } });
        if (!transaction)
            throw new common_1.NotFoundException('تراکنش این رزرو یافت نشد');
        if (transaction.status === 'refunded')
            throw new common_1.ConflictException('این تراکنش قبلاً بازپرداخت شده است');
        const cancelled = await this.bookings.cancel(tenantId, bookingId, reason);
        if (cancelled.refund.refundAmount <= 0)
            throw new common_1.BadRequestException('طبق سیاست کنسلی، بازپرداختی تعلق نمی‌گیرد');
        const refund = await this.provider.refund({
            providerIntentId: transaction.providerIntentId,
            amount: cancelled.refund.refundAmount,
        });
        transaction.status = 'refunded';
        transaction.refundAmount = String(cancelled.refund.refundAmount);
        transaction.providerRefundId = refund.providerRefundId;
        transaction.refundedAt = new Date();
        const saved = await this.transactions.save(transaction);
        this.emitter.emit(domain_events_1.REFUND_MARKED, {
            bookingId,
            tenantId,
            customerId: cancelled.booking.customerId,
            amount: cancelled.refund.refundAmount,
        });
        return saved;
    }
    async findByAuthority(authority) {
        return this.transactions.findOne({ where: { provider: 'zarinpal', providerIntentId: authority } });
    }
    async isFirstCapturedBooking(tenantId, customerId) {
        const count = await this.transactions
            .createQueryBuilder('transaction')
            .innerJoin('bookings', 'booking', 'booking.id = transaction.booking_id')
            .where('transaction.tenant_id = :tenantId', { tenantId })
            .andWhere('booking.customer_id = :customerId', { customerId })
            .andWhere("transaction.status = 'captured'")
            .getCount();
        return count === 0;
    }
};
exports.PaymentService = PaymentService;
exports.PaymentService = PaymentService = PaymentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(transaction_entity_1.Transaction)),
    __param(1, (0, typeorm_1.InjectRepository)(processed_webhook_event_entity_1.ProcessedWebhookEvent)),
    __param(2, (0, common_1.Inject)(payment_provider_interface_1.PAYMENT_PROVIDER)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository, Object, booking_service_1.BookingService,
        specialist_service_1.SpecialistService,
        typeorm_2.DataSource,
        event_emitter_1.EventEmitter2,
        config_1.ConfigService])
], PaymentService);
