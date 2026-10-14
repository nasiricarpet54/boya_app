import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { BookingService } from '../../booking/booking.service';
import { ServiceCatalogService } from '../../service/service.service';
import { SpecialistService } from '../../specialist/specialist.service';
import { TenantService } from '../../tenant/tenant.service';
import { UserService } from '../../user/user.service';
import {
  BOOKING_CANCELLED,
  BOOKING_CONFIRMED,
  BOOKING_CREATED,
  BookingCancelledEvent,
  BookingConfirmedEvent,
  BookingCreatedEvent,
  PAYMENT_CAPTURED,
  PaymentCapturedEvent,
  REFERRAL_COMPLETED,
  ReferralCompletedEvent,
  REFUND_MARKED,
  RefundMarkedEvent,
} from '../../../common/domain-events';
import { InAppNotificationService } from '../services/in-app-notification.service';
import { MelipayamakAlertService } from '../services/melipayamak-alert.service';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly inApp: InAppNotificationService,
    private readonly alerts: MelipayamakAlertService,
    private readonly users: UserService,
    private readonly tenants: TenantService,
    private readonly catalog: ServiceCatalogService,
    private readonly specialists: SpecialistService,
    private readonly bookings: BookingService,
  ) {}

  @OnEvent(BOOKING_CREATED, { async: true })
  async onBookingCreated(event: BookingCreatedEvent): Promise<void> {
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
        // Phase 1: approval is the gate, never payment.
        body: `نوبت ${service.name} در ${tenant.name} برای ${when} ثبت شد و در انتظار تایید سالن است.`,
        data: { bookingId: event.bookingId },
      });
      await this.alert(event.tenantId, event.customerId, saved.id);
    } catch (error) {
      this.logger.error(`booking.created notification failed: ${(error as Error).message}`);
    }
  }

  @OnEvent(BOOKING_CONFIRMED, { async: true })
  async onBookingApproved(event: BookingConfirmedEvent): Promise<void> {
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
    } catch (error) {
      this.logger.error(`booking.confirmed notification failed: ${(error as Error).message}`);
    }
  }

  @OnEvent(BOOKING_CANCELLED, { async: true })
  async onBookingCancelled(event: BookingCancelledEvent): Promise<void> {
    try {
      await this.inApp.create({
        tenantId: event.tenantId,
        userId: event.customerId,
        type: 'booking_cancelled',
        title: 'رزرو لغو شد',
        body: `رزرو لغو شد. مبلغ قابل بازگشت طبق سیاست کنسلی ${event.refundAmount.toLocaleString('fa-IR')} ریال است.`,
        data: { bookingId: event.bookingId, reason: event.reason },
      });
    } catch (error) {
      this.logger.error(`booking.cancelled notification failed: ${(error as Error).message}`);
    }
  }

  @OnEvent(PAYMENT_CAPTURED, { async: true })
  async onPaymentCaptured(event: PaymentCapturedEvent): Promise<void> {
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
    } catch (error) {
      this.logger.error(`payment.captured notification failed: ${(error as Error).message}`);
    }
  }

  @OnEvent(REFERRAL_COMPLETED, { async: true })
  async onReferralCompleted(event: ReferralCompletedEvent): Promise<void> {
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
    } catch (error) {
      this.logger.error(`referral.completed notification failed: ${(error as Error).message}`);
    }
  }

  @OnEvent(REFUND_MARKED, { async: true })
  async onRefundMarked(event: RefundMarkedEvent): Promise<void> {
    try {
      await this.inApp.create({
        tenantId: event.tenantId,
        userId: event.customerId,
        type: 'refund_marked',
        title: 'بازپرداخت در انتظار بررسی',
        body: `مبلغ ${event.amount.toLocaleString('fa-IR')} ریال فقط به‌صورت دستی علامت‌گذاری شد و هنوز برنگشته است.`,
        data: { bookingId: event.bookingId },
      });
    } catch (error) {
      this.logger.error(`refund notification failed: ${(error as Error).message}`);
    }
  }

  private async alert(tenantId: string, userId: string, notificationId: string): Promise<void> {
    const user = await this.users.findById(tenantId, userId);
    if (!user) return;
    await this.alerts.sendBookingAlert(user.phone, notificationId.slice(0, 8));
  }
}
