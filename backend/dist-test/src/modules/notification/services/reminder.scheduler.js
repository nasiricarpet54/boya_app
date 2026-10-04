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
var ReminderScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const booking_entity_1 = require("../../booking/booking.entity");
const in_app_notification_service_1 = require("./in-app-notification.service");
const kavenegar_alert_service_1 = require("./kavenegar-alert.service");
const NO_SHOW_GRACE_MINUTES = 30;
const REMINDER_LEAD_HOURS = 24;
const FEEDBACK_DELAY_HOURS = 2;
let ReminderScheduler = ReminderScheduler_1 = class ReminderScheduler {
    dataSource;
    inApp;
    alerts;
    logger = new common_1.Logger(ReminderScheduler_1.name);
    constructor(dataSource, inApp, alerts) {
        this.dataSource = dataSource;
        this.inApp = inApp;
        this.alerts = alerts;
    }
    async sendBookingReminders() {
        await this.run('booking reminder', () => this.claimAndSend('booking'));
    }
    async sendFeedbackReminders() {
        await this.run('feedback reminder', () => this.claimAndSend('feedback'));
    }
    async detectNoShows() {
        await this.run('no-show sweep', () => this.markNoShows());
    }
    async run(label, job) {
        try {
            const affected = await job();
            if (affected > 0)
                this.logger.log(`${label}: ${affected} booking(s)`);
        }
        catch (error) {
            this.logger.error(`${label} failed: ${error.message}`);
        }
    }
    async claimAndSend(kind) {
        const due = await this.claimDue(kind);
        for (const row of due) {
            await this.notify(row, kind);
        }
        return due.length;
    }
    async claimDue(kind) {
        if (kind === 'booking') {
            return this.dataSource.query(`UPDATE bookings b
         SET booking_reminder_sent_at = NOW()
         WHERE b.id IN (
           SELECT id FROM bookings
           WHERE status = $1
             AND booking_reminder_sent_at IS NULL
             AND lower(time_slot) > NOW()
             AND lower(time_slot) <= NOW() + ($2 || ' hours')::interval
         )
         RETURNING b.id, b.tenant_id, b.customer_id`, [booking_entity_1.BookingStatus.Confirmed, REMINDER_LEAD_HOURS]);
        }
        return this.dataSource.query(`UPDATE bookings b
       SET feedback_reminder_sent_at = NOW()
       WHERE b.id IN (
         SELECT id FROM bookings
         WHERE status = $1
           AND feedback_reminder_sent_at IS NULL
           AND upper(time_slot) <= NOW()
           AND upper(time_slot) > NOW() - ($2 || ' hours')::interval
       )
       RETURNING b.id, b.tenant_id, b.customer_id`, [booking_entity_1.BookingStatus.Completed, 24 - FEEDBACK_DELAY_HOURS]);
    }
    async notify(row, kind) {
        const isBooking = kind === 'booking';
        const title = isBooking ? 'یادآوری نوبت' : 'نظر شما درباره نوبت';
        const body = isBooking
            ? 'نوبت شما نزدیک است. برای هماهنگی بیشتر با سالن تماس بگیرید.'
            : 'بازخورد شما به سالن کمک می‌کند خدمات بهتری ارائه دهد.';
        try {
            await this.inApp.create({
                tenantId: row.tenant_id,
                userId: row.customer_id,
                type: isBooking ? 'booking_reminder' : 'feedback_reminder',
                title,
                body,
                data: { bookingId: row.id },
            });
        }
        catch (error) {
            this.logger.warn(`in-app ${kind} reminder failed for ${row.id}: ${error.message}`);
        }
        const phone = await this.dataSource.query(`SELECT u.phone FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`, [row.customer_id]);
        if (phone[0]?.phone) {
            await this.alerts.sendBookingAlert(phone[0].phone, title);
        }
    }
    async markNoShows() {
        const rows = await this.dataSource.query(`UPDATE bookings
       SET status = $1
       WHERE status = $2
         AND visit_confirmed_by_customer_at IS NULL
         AND lower(time_slot) + ($3 || ' minutes')::interval < NOW()
       RETURNING id, customer_id`, [booking_entity_1.BookingStatus.NoShow, booking_entity_1.BookingStatus.Confirmed, NO_SHOW_GRACE_MINUTES]);
        for (const row of rows) {
            await this.dataSource.query(`UPDATE users SET no_show_count = no_show_count + 1 WHERE id = $1`, [row.customer_id]);
        }
        return rows.length;
    }
};
exports.ReminderScheduler = ReminderScheduler;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_30_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReminderScheduler.prototype, "sendBookingReminders", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_30_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReminderScheduler.prototype, "sendFeedbackReminders", null);
__decorate([
    (0, schedule_1.Cron)('*/15 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReminderScheduler.prototype, "detectNoShows", null);
exports.ReminderScheduler = ReminderScheduler = ReminderScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        in_app_notification_service_1.InAppNotificationService,
        kavenegar_alert_service_1.KavenegarAlertService])
], ReminderScheduler);
