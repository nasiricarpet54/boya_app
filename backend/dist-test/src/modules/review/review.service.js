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
exports.ReviewService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const booking_service_1 = require("../booking/booking.service");
const booking_entity_1 = require("../booking/booking.entity");
const review_entity_1 = require("./review.entity");
let ReviewService = class ReviewService {
    reviews;
    bookings;
    constructor(reviews, bookings) {
        this.reviews = reviews;
        this.bookings = bookings;
    }
    async submit(input, customerId) {
        const booking = await this.bookings.findById(input.tenantId, input.bookingId);
        if (booking.customerId !== customerId) {
            throw new common_1.ForbiddenException('شما صاحب این رزرو نیستید');
        }
        if (booking.status === booking_entity_1.BookingStatus.Reviewed) {
            throw new common_1.ConflictException('بازخورد این رزرو قبلاً ثبت شده است');
        }
        if (booking.status !== booking_entity_1.BookingStatus.Completed) {
            throw new common_1.BadRequestException('ثبت بازخورد برای این رزرو مجاز نیست');
        }
        const review = await this.reviews.save(this.reviews.create({
            bookingId: booking.id,
            tenantId: booking.tenantId,
            customerId: booking.customerId,
            specialistId: booking.specialistId,
            rating: input.rating,
            comment: input.comment ?? null,
            photoUrl: input.photoUrl ?? null,
        }));
        if (booking.status === booking_entity_1.BookingStatus.Completed) {
            await this.bookings.markReviewed(booking.tenantId, booking.id);
        }
        return review;
    }
    async listByTenant(tenantId, limit = 20) {
        return this.reviews.find({
            where: { tenantId },
            order: { createdAt: 'DESC' },
            take: Math.min(Math.max(limit, 1), 100),
        });
    }
    async findById(tenantId, id) {
        const review = await this.reviews.findOne({ where: { tenantId, id } });
        if (!review)
            throw new common_1.NotFoundException('بازخورد مورد نظر یافت نشد');
        return review;
    }
};
exports.ReviewService = ReviewService;
exports.ReviewService = ReviewService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(review_entity_1.Review)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        booking_service_1.BookingService])
], ReviewService);
