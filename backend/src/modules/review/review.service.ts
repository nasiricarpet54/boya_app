import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BookingService } from '../booking/booking.service';
import { BookingStatus } from '../booking/booking.entity';
import { CreateReviewInput } from './dto/create-review.dto';
import { Review } from './review.entity';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    private readonly bookings: BookingService,
  ) {}

  /**
   * Records feedback and moves the booking completed → reviewed in one step.
   *
   * Feedback is only accepted for a visit that actually completed, and the
   * unique index on booking_id makes a second submission a conflict rather
   * than a silent duplicate.
   */
  async submit(input: CreateReviewInput, customerId: string): Promise<Review> {
    const booking = await this.bookings.findById(input.tenantId, input.bookingId);
    // Only the customer who made the booking may review it.
    if (booking.customerId !== customerId) {
      throw new ForbiddenException('شما صاحب این رزرو نیستید');
    }
    if (booking.status === BookingStatus.Reviewed) {
      throw new ConflictException('بازخورد این رزرو قبلاً ثبت شده است');
    }
    if (booking.status !== BookingStatus.Completed) {
      throw new BadRequestException('ثبت بازخورد برای این رزرو مجاز نیست');
    }

    const review = await this.reviews.save(
      this.reviews.create({
        bookingId: booking.id,
        tenantId: booking.tenantId,
        customerId: booking.customerId,
        specialistId: booking.specialistId,
        rating: input.rating,
        comment: input.comment ?? null,
        photoUrl: input.photoUrl ?? null,
      }),
    );

    // The booking may have moved while the review was being written; only
    // advance it if it is still in the state this transition expects.
    if (booking.status === BookingStatus.Completed) {
      await this.bookings.markReviewed(booking.tenantId, booking.id);
    }
    return review;
  }

  async listByTenant(tenantId: string, limit = 20): Promise<Review[]> {
    return this.reviews.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async findById(tenantId: string, id: string): Promise<Review> {
    const review = await this.reviews.findOne({ where: { tenantId, id } });
    if (!review) throw new NotFoundException('بازخورد مورد نظر یافت نشد');
    return review;
  }
}