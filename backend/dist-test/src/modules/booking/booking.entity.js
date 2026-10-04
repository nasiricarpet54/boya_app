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
exports.Booking = exports.APPROVER_ROLES = exports.BookingStatus = void 0;
const typeorm_1 = require("typeorm");
var BookingStatus;
(function (BookingStatus) {
    BookingStatus["Pending"] = "pending";
    BookingStatus["Confirmed"] = "confirmed";
    BookingStatus["Cancelled"] = "cancelled";
    BookingStatus["Completed"] = "completed";
    BookingStatus["NoShow"] = "no_show";
    BookingStatus["Reviewed"] = "reviewed";
})(BookingStatus || (exports.BookingStatus = BookingStatus = {}));
exports.APPROVER_ROLES = ['salon_owner', 'line_manager', 'specialist'];
let Booking = class Booking {
    id;
    tenantId;
    specialistId;
    customerId;
    serviceId;
    timeSlot;
    status;
    totalPrice;
    depositPaid;
    flexibleSpecialist;
    notes;
    bookingReminderSentAt;
    feedbackReminderSentAt;
    visitConfirmedByCustomerAt;
    createdAt;
    updatedAt;
};
exports.Booking = Booking;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Booking.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tenant_id', type: 'uuid' }),
    __metadata("design:type", String)
], Booking.prototype, "tenantId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'specialist_id', type: 'uuid' }),
    __metadata("design:type", String)
], Booking.prototype, "specialistId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'customer_id', type: 'uuid' }),
    __metadata("design:type", String)
], Booking.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'service_id', type: 'uuid' }),
    __metadata("design:type", String)
], Booking.prototype, "serviceId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'time_slot',
        type: 'tstzrange',
        transformer: {
            to: (value) => typeof value === 'string' ? value : `[${value.start.toISOString()},${value.end.toISOString()})`,
            from: (value) => value,
        },
    }),
    __metadata("design:type", String)
], Booking.prototype, "timeSlot", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: BookingStatus.Pending }),
    __metadata("design:type", String)
], Booking.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_price', type: 'numeric', precision: 10, scale: 2 }),
    __metadata("design:type", String)
], Booking.prototype, "totalPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deposit_paid', type: 'numeric', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", String)
], Booking.prototype, "depositPaid", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'flexible_specialist', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Booking.prototype, "flexibleSpecialist", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Booking.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'booking_reminder_sent_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Booking.prototype, "bookingReminderSentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'feedback_reminder_sent_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Booking.prototype, "feedbackReminderSentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'visit_confirmed_by_customer_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Booking.prototype, "visitConfirmedByCustomerAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Booking.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Booking.prototype, "updatedAt", void 0);
exports.Booking = Booking = __decorate([
    (0, typeorm_1.Entity)('bookings'),
    (0, typeorm_1.Index)('idx_bookings_tenant_id', ['tenantId']),
    (0, typeorm_1.Check)('bookings_status_check', `"status" IN ('pending','confirmed','cancelled','completed','no_show','reviewed')`)
], Booking);
