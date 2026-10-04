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
var NotificationListener_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationListener = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const booking_service_1 = require("../../booking/booking.service");
const service_service_1 = require("../../service/service.service");
const specialist_service_1 = require("../../specialist/specialist.service");
const tenant_service_1 = require("../../tenant/tenant.service");
const user_service_1 = require("../../user/user.service");
const domain_events_1 = require("../../../common/domain-events");
const in_app_notification_service_1 = require("../services/in-app-notification.service");
const kavenegar_alert_service_1 = require("../services/kavenegar-alert.service");
let NotificationListener = NotificationListener_1 = class NotificationListener {
    inApp;
    alerts;
    users;
    tenants;
    catalog;
    specialists;
    bookings;
    logger = new common_1.Logger(NotificationListener_1.name);
    constructor(inApp, alerts, users, tenants, catalog, specialists, bookings) {
        this.inApp = inApp;
        this.alerts = alerts;
        this.users = users;
        this.tenants = tenants;
        this.catalog = catalog;
        this.specialists = specialists;
        this.bookings = bookings;
    }
    async onBookingCreated(event) {
        try {
            const [service, tenant] = await Promise.all([
                this.catalog.findById(event.tenantId, event.serviceId),
                this.tenants.findById(event.tenantId),
            ]);
            const when = this.bookings.displayDate(new Date(event.startsAtIso));
            const saved = await this.inApp.create({
                tenantId: event.tenantId,
                userId: event.customerId,
                type: 'booking_created',
                title: 'درخواست رزرو ثبت شد',
                body: `نوبت ${service.name} در ${tenant.name} برای ${when} ثبت شد و در انتظار تایید سالن است.`,
                data: { bookingId: event.bookingId },
            });
            await this.alert(event.tenantId, event.customerId, saved.id);
        }
        catch (error) {
            this.logger.error(`booking.created notification failed: ${error.message}`);
        }
    }
    async onBookingApproved(event) {
        try {
            const [service, tenant] = await Promise.all([
                this.catalog.findById(event.tenantId, event.serviceId).catch(() => null),
                this.tenants.findById(event.tenantId).catch(() => null),
            ]);
            const where = service && tenant ? ` در ${tenant.name}` : '';
            const what = service ? ` برای ${service.name}` : '';
            const saved = await this.inApp.create({
                tenantId: event.tenantId,
                userId: event.customerId,
                type: 'booking_confirmed',
                title: 'رزرو شما تایید شد',
                body: `نوبت شما${what}${where} تایید شد.`,
                data: { bookingId: event.bookingId },
            });
            await this.alert(event.tenantId, event.customerId, saved.id);
        }
        catch (error) {
            this.logger.error(`booking.confirmed notification failed: ${error.message}`);
        }
    }
    async onBookingCancelled(event) {
        try {
            await this.inApp.create({
                tenantId: event.tenantId,
                userId: event.customerId,
                type: 'booking_cancelled',
                title: 'رزرو لغو شد',
                body: `رزرو لغو شد. مبلغ قابل بازگشت طبق سیاست کنسلی ${event.refundAmount.toLocaleString('fa-IR')} ریال است.`,
                data: { bookingId: event.bookingId, reason: event.reason },
            });
        }
        catch (error) {
            this.logger.error(`booking.cancelled notification failed: ${error.message}`);
        }
    }
    async onPaymentCaptured(event) {
        try {
            const specialist = await this.specialists.findById(event.tenantId, event.specialistId);
            await this.inApp.create({
                tenantId: event.tenantId,
                userId: specialist.userId,
                type: 'payment_captured',
                title: 'پرداخت رزرو تأیید شد',
                body: `پرداخت ${event.amount.toLocaleString('fa-IR')} ریالی یک رزرو تأیید شد. تسویه خودکار انجام نمی‌شود.`,
                data: { bookingId: event.bookingId },
            });
        }
        catch (error) {
            this.logger.error(`payment.captured notification failed: ${error.message}`);
        }
    }
    async onReferralCompleted(event) {
        try {
            await this.inApp.create({
                tenantId: event.tenantId,
                userId: event.referrerId,
                type: 'referral_completed',
                title: 'معرفی شما تکمیل شد',
                body: `دوستی که با کد شما ثبت‌نام کرد اولین رزرو خود را پرداخت کرد. ${event.referrerPoints} امتیاز وفاداری برای شما ثبت شد و پاداش ${event.referrerReward.toLocaleString('fa-IR')} ریالی در سابقه معرفی شما ثبت است.`,
                data: { referralId: event.referralId, referredId: event.referredId },
            });
            await this.inApp.create({
                tenantId: event.tenantId,
                userId: event.referredId,
                type: 'referral_completed',
                title: 'پاداش خوش‌آمدگویی فعال شد',
                body: `اولین رزرو شما پرداخت شد. ${event.referredPoints} امتیاز وفاداری برای شما ثبت شد و پاداش ${event.referredReward.toLocaleString('fa-IR')} ریالی در سابقه معرفی شما ثبت است.`,
                data: { referralId: event.referralId, referrerId: event.referrerId },
            });
        }
        catch (error) {
            this.logger.error(`referral.completed notification failed: ${error.message}`);
        }
    }
    async onRefundMarked(event) {
        try {
            await this.inApp.create({
                tenantId: event.tenantId,
                userId: event.customerId,
                type: 'refund_marked',
                title: 'بازپرداخت در انتظار بررسی',
                body: `مبلغ ${event.amount.toLocaleString('fa-IR')} ریال فقط به‌صورت دستی علامت‌گذاری شد و هنوز برنگشته است.`,
                data: { bookingId: event.bookingId },
            });
        }
        catch (error) {
            this.logger.error(`refund notification failed: ${error.message}`);
        }
    }
    async alert(tenantId, userId, notificationId) {
        const user = await this.users.findById(tenantId, userId);
        if (!user)
            return;
        await this.alerts.sendBookingAlert(user.phone, notificationId.slice(0, 8));
    }
};
exports.NotificationListener = NotificationListener;
__decorate([
    (0, event_emitter_1.OnEvent)(domain_events_1.BOOKING_CREATED, { async: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationListener.prototype, "onBookingCreated", null);
__decorate([
    (0, event_emitter_1.OnEvent)(domain_events_1.BOOKING_CONFIRMED, { async: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationListener.prototype, "onBookingApproved", null);
__decorate([
    (0, event_emitter_1.OnEvent)(domain_events_1.BOOKING_CANCELLED, { async: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationListener.prototype, "onBookingCancelled", null);
__decorate([
    (0, event_emitter_1.OnEvent)(domain_events_1.PAYMENT_CAPTURED, { async: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationListener.prototype, "onPaymentCaptured", null);
__decorate([
    (0, event_emitter_1.OnEvent)(domain_events_1.REFERRAL_COMPLETED, { async: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationListener.prototype, "onReferralCompleted", null);
__decorate([
    (0, event_emitter_1.OnEvent)(domain_events_1.REFUND_MARKED, { async: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationListener.prototype, "onRefundMarked", null);
exports.NotificationListener = NotificationListener = NotificationListener_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [in_app_notification_service_1.InAppNotificationService,
        kavenegar_alert_service_1.KavenegarAlertService,
        user_service_1.UserService,
        tenant_service_1.TenantService,
        service_service_1.ServiceCatalogService,
        specialist_service_1.SpecialistService,
        booking_service_1.BookingService])
], NotificationListener);
