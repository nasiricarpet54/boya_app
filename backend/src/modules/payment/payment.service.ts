import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";

import { BookingStatus } from "../booking/booking.entity";
import { BookingService } from "../booking/booking.service";
import { CancellationReason } from "../booking/cancellation-policy.service";
import { SpecialistService } from "../specialist/specialist.service";
import { ProcessedWebhookEvent } from "./entities/processed-webhook-event.entity";
import { Transaction } from "./entities/transaction.entity";
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
} from "./providers/payment-provider.interface";
import { PAYMENT_CAPTURED, REFUND_MARKED } from "../../common/domain-events";

const FIRST_BOOKING_FEE = 0.2;

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    @InjectRepository(ProcessedWebhookEvent)
    private readonly processed: Repository<ProcessedWebhookEvent>,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly bookings: BookingService,
    private readonly specialists: SpecialistService,
    private readonly dataSource: DataSource,
    private readonly emitter: EventEmitter2,
    private readonly config: ConfigService,
  ) {
    if (!this.paymentsEnabled) {
      this.logger.log("Payments disabled (Phase 1 mode)");
    }
  }

  /** Phase 1 ships the module but keeps it switched off (see PROJECT_CHARTER.md). */
  get paymentsEnabled(): boolean {
    return this.config.get<boolean>("PAYMENTS_ENABLED", false) === true;
  }

  private assertEnabled(): void {
    if (!this.paymentsEnabled) {
      throw new ServiceUnavailableException(
        "در فاز اول، پرداخت آنلاین فعال نیست",
      );
    }
  }

  async initiate(tenantId: string, bookingId: string): Promise<Transaction> {
    this.assertEnabled();
    const booking = await this.bookings.findById(tenantId, bookingId);
    if (booking.status === BookingStatus.Cancelled)
      throw new BadRequestException("این رزرو لغو شده است");

    const existing = await this.transactions.findOne({
      where: { tenantId, bookingId },
    });
    if (existing && existing.status !== "failed")
      throw new ConflictException("برای این رزرو قبلاً تراکنش ایجاد شده است");

    const total = Number(booking.totalPrice);
    const first = booking.customerId
      ? await this.isFirstCapturedBooking(tenantId, booking.customerId)
      : false;
    const platformFee = first ? Math.round(total * FIRST_BOOKING_FEE) : 0;
    const specialist = await this.specialists.findById(
      tenantId,
      booking.specialistId,
    );
    const specialistShare = Math.round(
      (total * Number(specialist.commissionRate)) / 100,
    );

    const intent = await this.provider.createPaymentIntent({
      amount: total,
      bookingId,
      tenantId,
      description: `رزرو ${bookingId}`,
    });

    return this.transactions.save(
      this.transactions.create({
        tenantId,
        bookingId,
        provider: this.provider.name,
        providerIntentId: intent.providerIntentId,
        status: "pending",
        totalAmount: String(total),
        platformFee: String(platformFee),
        specialistShare: String(specialistShare),
        salonShare: String(total - specialistShare),
        metadata: { redirectUrl: intent.redirectUrl, isFirstBooking: first },
      }),
    );
  }

  async completeZarinpalReturn(
    authority: string,
    status: string,
  ): Promise<Transaction | null> {
    this.assertEnabled();
    if (status !== "OK" || !authority) return null;
    const eventId = `zarinpal:${authority}`;
    if (await this.processed.findOne({ where: { eventId } }))
      return this.findByAuthority(authority);

    const transaction = await this.findByAuthority(authority);
    if (!transaction || transaction.status === "captured") return transaction;

    const verified = await this.provider.verifyPayment(
      authority,
      Number(transaction.totalAmount),
    );
    if (!verified.success) {
      transaction.status = "failed";
      return this.transactions.save(transaction);
    }

    return this.dataSource.transaction(async (manager) => {
      transaction.status = "captured";
      transaction.capturedAt = new Date();
      transaction.metadata = { ...transaction.metadata, refId: verified.refId };
      const saved = await manager.save(transaction);
      await manager.save(ProcessedWebhookEvent, {
        eventId,
        eventType: "zarinpal.verified",
      });
      const booking = await this.bookings.findById(
        saved.tenantId,
        saved.bookingId,
      );
      this.emitter.emit(PAYMENT_CAPTURED, {
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

  async markRefundPending(
    tenantId: string,
    bookingId: string,
    reason: CancellationReason,
  ): Promise<Transaction> {
    this.assertEnabled();
    const transaction = await this.transactions.findOne({
      where: { tenantId, bookingId },
    });
    if (!transaction) throw new NotFoundException("تراکنش این رزرو یافت نشد");
    if (transaction.status === "refunded")
      throw new ConflictException("این تراکنش قبلاً بازپرداخت شده است");

    const cancelled = await this.bookings.cancel(tenantId, bookingId, reason);
    if (cancelled.refund.refundAmount <= 0)
      throw new BadRequestException(
        "طبق سیاست کنسلی، بازپرداختی تعلق نمی‌گیرد",
      );

    const refund = await this.provider.refund({
      providerIntentId: transaction.providerIntentId,
      amount: cancelled.refund.refundAmount,
    });
    transaction.status = "refunded";
    transaction.refundAmount = String(cancelled.refund.refundAmount);
    transaction.providerRefundId = refund.providerRefundId;
    transaction.refundedAt = new Date();
    const saved = await this.transactions.save(transaction);
    this.emitter.emit(REFUND_MARKED, {
      bookingId,
      tenantId,
      customerId: cancelled.booking.customerId,
      amount: cancelled.refund.refundAmount,
    });
    return saved;
  }

  private async findByAuthority(
    authority: string,
  ): Promise<Transaction | null> {
    return this.transactions.findOne({
      where: { provider: "zarinpal", providerIntentId: authority },
    });
  }

  private async isFirstCapturedBooking(
    tenantId: string,
    customerId: string,
  ): Promise<boolean> {
    const count = await this.transactions
      .createQueryBuilder("transaction")
      .innerJoin("bookings", "booking", "booking.id = transaction.booking_id")
      .where("transaction.tenant_id = :tenantId", { tenantId })
      .andWhere("booking.customer_id = :customerId", { customerId })
      .andWhere("transaction.status = 'captured'")
      .getCount();
    return count === 0;
  }
}
