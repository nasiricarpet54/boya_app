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
exports.BookingService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const jalali_date_util_1 = require("../../utils/jalali-date.util");
const working_hours_util_1 = require("../../utils/working-hours.util");
const service_service_1 = require("../service/service.service");
const specialist_service_1 = require("../specialist/specialist.service");
const availability_service_1 = require("./availability.service");
const cancellation_policy_service_1 = require("./cancellation-policy.service");
const booking_entity_1 = require("./booking.entity");
const domain_events_1 = require("../../common/domain-events");
let BookingService = class BookingService {
    bookings;
    dataSource;
    catalog;
    specialists;
    events;
    availability = new availability_service_1.AvailabilityService();
    cancellation = new cancellation_policy_service_1.CancellationPolicyService();
    constructor(bookings, dataSource, catalog, specialists, events) {
        this.bookings = bookings;
        this.dataSource = dataSource;
        this.catalog = catalog;
        this.specialists = specialists;
        this.events = events;
    }
    displayDate(slotStart) {
        return (0, jalali_date_util_1.formatJalaliLatin)(slotStart);
    }
    async create(input) {
        const service = await this.catalog.findById(input.tenantId, input.serviceId);
        const specialist = await this.specialists.findById(input.tenantId, input.specialistId);
        if (!service.isActive || !specialist.isActive)
            throw new common_1.BadRequestException('خدمت یا متخصص انتخاب‌شده غیرفعال است');
        if (input.startsAt.getTime() <= Date.now())
            throw new common_1.BadRequestException('زمان رزرو باید در آینده باشد');
        await this.assertWithinWorkingHours(input.tenantId, input.startsAt, service.durationMinutes);
        const end = new Date(input.startsAt.getTime() + service.durationMinutes * 60_000);
        let saved;
        try {
            saved = await this.dataSource.transaction(async (manager) => {
                await manager.query(`SELECT set_config('app.tenant_id', $1, true)`, [input.tenantId]);
                return manager.save(manager.create(booking_entity_1.Booking, {
                    tenantId: input.tenantId,
                    specialistId: input.specialistId,
                    customerId: input.customerId,
                    serviceId: input.serviceId,
                    timeSlot: `[${input.startsAt.toISOString()},${end.toISOString()})`,
                    status: booking_entity_1.BookingStatus.Pending,
                    totalPrice: service.price,
                    notes: input.notes ?? null,
                }));
            });
            this.events.emit(domain_events_1.BOOKING_CREATED, {
                bookingId: saved.id,
                tenantId: saved.tenantId,
                customerId: saved.customerId,
                specialistId: saved.specialistId,
                serviceId: saved.serviceId,
                startsAtIso: input.startsAt.toISOString(),
            });
            return saved;
        }
        catch (error) {
            if (isOverlap(error)) {
                throw new common_1.ConflictException('این بازه زمانی قبلاً برای این متخصص رزرو شده است. لطفاً زمان دیگری انتخاب کنید.');
            }
            throw error;
        }
    }
    async listForCustomer(customerId) {
        const rows = await this.dataSource.query(`SELECT id, tenant_id, status, starts_at, ends_at, total_price,
              salon_name, service_name, specialist_name, notes, created_at
       FROM get_customer_bookings($1)
       ORDER BY created_at DESC, id`, [customerId]);
        return {
            data: rows.map((row) => ({
                id: row.id,
                status: row.status,
                startsAt: row.starts_at.toISOString(),
                endsAt: row.ends_at.toISOString(),
                totalPrice: Number(row.total_price),
                salonName: row.salon_name,
                serviceName: row.service_name,
                specialistName: row.specialist_name,
                notes: row.notes,
                createdAt: row.created_at.toISOString(),
                tenantId: row.tenant_id,
            })),
        };
    }
    async assertWithinWorkingHours(tenantId, startsAt, durationMinutes) {
        const [tenant] = await this.dataSource.query(`SELECT working_hours FROM tenants WHERE id = $1 AND is_active = true`, [tenantId]);
        if (!tenant)
            throw new common_1.NotFoundException('سالن مورد نظر یافت نشد');
        const hours = tenant.working_hours;
        if (!hours || Object.keys(hours).length === 0)
            return;
        if (!(0, working_hours_util_1.isOpenFor)(hours, startsAt, durationMinutes)) {
            throw new common_1.BadRequestException('این ساعت خارج از ساعات کاری سالن است. لطفاً زمان دیگری را انتخاب کنید.');
        }
    }
    availableSlots(hours, date, durationMinutes, busy) {
        return this.availability.filterAvailable(this.availability.generateSlots({ workingHours: hours, date, durationMinutes }), busy);
    }
    async cancel(tenantId, id, reason, now = new Date()) {
        const booking = await this.findById(tenantId, id);
        if (booking.status === booking_entity_1.BookingStatus.Cancelled)
            throw new common_1.BadRequestException('این رزرو قبلاً لغو شده است');
        if (booking.status === booking_entity_1.BookingStatus.Completed)
            throw new common_1.BadRequestException('رزرو تکمیل‌شده قابل لغو نیست');
        const refund = this.cancellation.calculate({
            totalPrice: Number(booking.totalPrice),
            startsAt: rangeStart(booking.timeSlot),
            now,
            reason,
        });
        booking.status = booking_entity_1.BookingStatus.Cancelled;
        const saved = await this.bookings.save(booking);
        this.events.emit(domain_events_1.BOOKING_CANCELLED, {
            bookingId: saved.id,
            tenantId,
            customerId: saved.customerId,
            reason,
            refundAmount: refund.refundAmount,
        });
        return { booking: saved, refund };
    }
    async findById(tenantId, id) {
        const booking = await this.bookings.findOne({ where: { tenantId, id } });
        if (!booking)
            throw new common_1.NotFoundException('رزرو مورد نظر یافت نشد');
        return booking;
    }
    async findScoped(bookings, tenantId, id) {
        const booking = await bookings.findOne({ where: { tenantId, id } });
        if (!booking)
            throw new common_1.NotFoundException('رزرو مورد نظر یافت نشد');
        return booking;
    }
    inTenant(tenantId, work) {
        return this.dataSource.transaction(async (manager) => {
            await manager.query(`SELECT set_config('app.tenant_id', $1, true)`, [
                tenantId,
            ]);
            return work(manager.getRepository(booking_entity_1.Booking));
        });
    }
    async approve(user, id) {
        const tenantId = this.requireApprover(user);
        const saved = await this.inTenant(tenantId, async (bookings) => {
            const booking = await this.findScoped(bookings, tenantId, id);
            if (booking.status !== booking_entity_1.BookingStatus.Pending) {
                throw new common_1.ConflictException('این رزرو قبلاً بررسی شده است');
            }
            booking.status = booking_entity_1.BookingStatus.Confirmed;
            return bookings.save(booking);
        });
        this.events.emit(domain_events_1.BOOKING_CONFIRMED, {
            bookingId: saved.id,
            tenantId,
            customerId: saved.customerId,
            specialistId: saved.specialistId,
            serviceId: saved.serviceId,
        });
        return saved;
    }
    async reject(user, id, reason) {
        const tenantId = this.requireApprover(user);
        const saved = await this.inTenant(tenantId, async (bookings) => {
            const booking = await this.findScoped(bookings, tenantId, id);
            if (booking.status !== booking_entity_1.BookingStatus.Pending) {
                throw new common_1.ConflictException('این رزرو قبلاً بررسی شده است');
            }
            booking.status = booking_entity_1.BookingStatus.Cancelled;
            if (reason)
                booking.notes = booking.notes ? `${booking.notes}\n— ${reason}` : reason;
            return bookings.save(booking);
        });
        this.events.emit(domain_events_1.BOOKING_CANCELLED, {
            bookingId: saved.id,
            tenantId,
            customerId: saved.customerId,
            reason: 'specialist_unavailable',
            refundAmount: 0,
        });
        return saved;
    }
    async markVisited(user, id) {
        const tenantId = this.requireApprover(user);
        return this.inTenant(tenantId, async (bookings) => {
            const booking = await this.findScoped(bookings, tenantId, id);
            if (booking.status !== booking_entity_1.BookingStatus.Confirmed) {
                throw new common_1.ConflictException('فقط رزرو تأییدشده را می‌توان تکمیل کرد');
            }
            booking.status = booking_entity_1.BookingStatus.Completed;
            return bookings.save(booking);
        });
    }
    requireApprover(user) {
        if (!user || !booking_entity_1.APPROVER_ROLES.includes(user.role)) {
            throw new common_1.ForbiddenException('این عملیات فقط برای سالن یا مدیر خط مجاز است');
        }
        if (!user.tenantId) {
            throw new common_1.ForbiddenException('حساب شما به سالنی متصل نیست');
        }
        return user.tenantId;
    }
    async markReviewed(tenantId, id) {
        const booking = await this.findById(tenantId, id);
        if (booking.status !== booking_entity_1.BookingStatus.Completed) {
            throw new common_1.ConflictException('فقط رزرو تکمیل‌شده قابل بازبینی است');
        }
        booking.status = booking_entity_1.BookingStatus.Reviewed;
        return this.bookings.save(booking);
    }
    async confirmVisitByCustomer(user, id) {
        const booking = await this.bookings.findOne({ where: { id, customerId: user.userId } });
        if (!booking)
            throw new common_1.NotFoundException('رزرو مورد نظر یافت نشد');
        booking.visitConfirmedByCustomerAt = new Date();
        return this.bookings.save(booking);
    }
};
exports.BookingService = BookingService;
exports.BookingService = BookingService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(booking_entity_1.Booking)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource,
        service_service_1.ServiceCatalogService,
        specialist_service_1.SpecialistService,
        event_emitter_1.EventEmitter2])
], BookingService);
function rangeStart(value) {
    const match = value.match(/\[([^,\]]+)/);
    return match ? new Date(match[1]) : new Date(NaN);
}
function isOverlap(error) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23P01';
}
