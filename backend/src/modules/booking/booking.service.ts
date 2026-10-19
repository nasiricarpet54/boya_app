import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { formatJalaliLatin } from '../../utils/jalali-date.util';
import { isOpenFor } from '../../utils/working-hours.util';
import { setTenantContext } from '../../database/tenant-context';
import { ServiceCatalogService } from '../service/service.service';
import { SpecialistService } from '../specialist/specialist.service';
import { Specialist } from '../specialist/entities/specialist.entity';
import { AvailabilityService, TimeSlot, WorkingHours } from './availability.service';
import { CancellationPolicyService, CancellationReason, RefundCalculation } from './cancellation-policy.service';
import { Booking, BookingStatus, APPROVER_ROLES } from './booking.entity';
import { BOOKING_CANCELLED, BOOKING_CONFIRMED, BOOKING_CREATED } from '../../common/domain-events';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';

export interface CreateBookingInput {
  /**
   * The tenant the booking is written into. Optional: when absent the
   * specialist's `tenant_id` is used, and when present it must equal that
   * value — see `create()`.
   */
  tenantId?: string;
  specialistId: string;
  serviceId: string;
  customerId: string;
  startsAt: Date;
  notes?: string | null;
  /** ADR-011: request the specialist come to the customer. */
  isMobile?: boolean;
  customerAddress?: string | null;
  customerLatitude?: number;
  customerLongitude?: number;
}

/** One row of `GET /bookings`. */
export interface CustomerBookingItem {
  id: string;
  status: string;
  /** Beginning of the reserved range, ISO 8601 UTC. */
  startsAt: string;
  endsAt: string;
  totalPrice: number;
  salonName: string | null;
  serviceName: string | null;
  specialistName: string | null;
  notes: string | null;
  createdAt: string;
  /** Not part of the list contract: `POST /reviews` is tenant-scoped. */
  tenantId: string;
}

/** Raw row of `get_customer_bookings()`; numerics arrive as strings. */
interface CustomerBookingRow {
  id: string;
  tenant_id: string;
  status: string;
  starts_at: Date;
  ends_at: Date;
  total_price: string;
  salon_name: string | null;
  service_name: string | null;
  specialist_name: string | null;
  notes: string | null;
  created_at: Date;
}

@Injectable()
export class BookingService {
  private readonly availability = new AvailabilityService();
  private readonly cancellation = new CancellationPolicyService();

  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    private readonly dataSource: DataSource,
    private readonly catalog: ServiceCatalogService,
    private readonly specialists: SpecialistService,
    private readonly events: EventEmitter2,
  ) {}

  displayDate(slotStart: Date): string {
    return formatJalaliLatin(slotStart);
  }

  async create(input: CreateBookingInput): Promise<Booking> {
    // A booking belongs to the tenant its specialist belongs to. The caller may
    // omit `tenantId` — it is then taken from the specialist — and when it is
    // sent it must match, so a booking can never be written into a tenant the
    // specialist has nothing to do with. `specialists` carries no RLS policy, so
    // this single read needs no tenant GUC (which a customer's token would not
    // set anyway) and doubles as the row the checks below read from.
    const specialist = await this.dataSource.getRepository(Specialist).findOne({
      where: { id: input.specialistId },
    });
    if (!specialist) throw new NotFoundException('متخصص یافت نشد');
    if (input.tenantId && specialist.tenantId !== input.tenantId) {
      throw new BadRequestException('tenantId با متخصص مطابقت ندارد');
    }
    const tenantId = specialist.tenantId;

    const service = await this.catalog.findById(tenantId, input.serviceId);
    if (!service.isActive || !specialist.isActive) throw new BadRequestException('خدمت یا متخصص انتخاب‌شده غیرفعال است');

    // On-site booking (ADR-011): an address is the one thing the specialist
    // cannot do without, and both the *person* and the *service* must be
    // willing to travel — neither flag implies the other.
    if (input.isMobile) {
      if (!input.customerAddress || input.customerAddress.trim().length === 0) {
        throw new BadRequestException('آدرس مشتری الزامی است');
      }
      if (!specialist.offersMobileService) {
        throw new BadRequestException('این متخصص خدمات سیار ارائه نمی‌دهد');
      }
      if (!service.isMobileAvailable) {
        throw new BadRequestException('این خدمت به‌صورت سیار ارائه نمی‌شود');
      }
    }

    if (input.startsAt.getTime() <= Date.now()) throw new BadRequestException('زمان رزرو باید در آینده باشد');
    await this.assertWithinWorkingHours(tenantId, input.startsAt, service.durationMinutes);

    const end = new Date(input.startsAt.getTime() + service.durationMinutes * 60_000);
    let saved: Booking;
    try {
      // The `bookings_tenant_isolation` RLS policy requires that
      // current_setting('app.current_tenant_id') match the row's tenant_id. The
      // customer's JWT carries tenantId=null (customers are not tenant-scoped),
      // so nothing has been set on the pool connection. Wrap the INSERT in a
      // transaction that sets the session variable for that transaction only
      // (set_config(..., true) is transaction-local), matching body.tenantId.
      saved = await this.dataSource.transaction(async (manager) => {
        await setTenantContext(manager, tenantId);
        return manager.save(
          manager.create(Booking, {
            tenantId,
            specialistId: input.specialistId,
            customerId: input.customerId,
            serviceId: input.serviceId,
            timeSlot: `[${input.startsAt.toISOString()},${end.toISOString()})`,
            status: BookingStatus.Confirmed,
            totalPrice: service.price,
            notes: input.notes ?? null,
            isMobile: input.isMobile ?? false,
            // The address only belongs on the row when the booking is on-site;
            // a regular booking never carries one.
            customerAddress: input.isMobile ? input.customerAddress ?? null : null,
            // `numeric` column: the caller sends numbers, the column stores
            // decimal text, so the value is stringified on the way in.
            customerLatitude: input.customerLatitude != null ? String(input.customerLatitude) : null,
            customerLongitude: input.customerLongitude != null ? String(input.customerLongitude) : null,
          }),
        );
      });
      this.events.emit(BOOKING_CREATED, {
        bookingId: saved.id,
        tenantId: saved.tenantId,
        customerId: saved.customerId,
        specialistId: saved.specialistId,
        serviceId: saved.serviceId,
        startsAtIso: input.startsAt.toISOString(),
      });
      return saved;
    } catch (error) {
      // 23P01: exclusion violation (GIST overlap constraint) | 40P01: deadlock on concurrent GIST insert
      if (isOverlap(error) || hasSqlState(error, '40P01')) {
        throw new ConflictException('این بازه زمانی قبلاً برای این متخصص رزرو شده است. لطفاً زمان دیگری انتخاب کنید.');
      }
      throw error;
    }
  }

  /**
   * The caller's own bookings, newest first.
   *
   * The customer id comes from the verified token, so a caller can only ever
   * read their own rows. The read crosses tenants (one customer, many salons)
   * while `bookings` and `users` are FORCE ROW LEVEL SECURITY on a tenant
   * setting a customer's token does not carry, so the joined read runs inside
   * `get_customer_bookings()` — the SECURITY DEFINER escape hatch migration
   * 1730000000014 adds, the same pattern as `find_or_create_customer_by_phone()`.
   */
  async listForCustomer(customerId: string): Promise<{ data: CustomerBookingItem[] }> {
    const rows = await this.dataSource.query<CustomerBookingRow[]>(
      `SELECT id, tenant_id, status, starts_at, ends_at, total_price,
              salon_name, service_name, specialist_name, notes, created_at
       FROM get_customer_bookings($1)
       ORDER BY created_at DESC, id`,
      [customerId],
    );

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

  /**
   * A salon that published a weekly schedule is the authority on when it can be
   * booked, so a request outside its open window is refused before the INSERT
   * reaches the exclusion constraint. Tenants whose `working_hours` is still
   * `{}` — never configured — keep the old behaviour, where the salon's approval
   * is the only gate.
   */
  private async assertWithinWorkingHours(
    tenantId: string,
    startsAt: Date,
    durationMinutes: number,
  ): Promise<void> {
    const [tenant] = await this.dataSource.query<
      Array<{ working_hours: Record<string, unknown> | null }>
    >(`SELECT working_hours FROM tenants WHERE id = $1 AND is_active = true`, [tenantId]);
    if (!tenant) throw new NotFoundException('سالن مورد نظر یافت نشد');

    const hours = tenant.working_hours;
    if (!hours || Object.keys(hours).length === 0) return;
    if (!isOpenFor(hours, startsAt, durationMinutes)) {
      throw new BadRequestException(
        'این ساعت خارج از ساعات کاری سالن است. لطفاً زمان دیگری را انتخاب کنید.',
      );
    }
  }

  availableSlots(hours: WorkingHours, date: Date, durationMinutes: number, busy: TimeSlot[]): TimeSlot[] {
    return this.availability.filterAvailable(
      this.availability.generateSlots({ workingHours: hours, date, durationMinutes }),
      busy,
    );
  }

  async cancel(
    tenantId: string,
    id: string,
    reason: CancellationReason,
    now = new Date(),
  ): Promise<{ booking: Booking; refund: RefundCalculation }> {
    // One tenant-scoped transaction for the read and the write: `bookings` is
    // FORCE ROW LEVEL SECURITY, so the SELECT only sees the row (and the UPDATE
    // only passes WITH CHECK) while the GUC is set.
    const result = await this.inTenant(tenantId, async (bookings) => {
      const booking = await this.findScoped(bookings, tenantId, id);
      if (booking.status === BookingStatus.Cancelled) {
        throw new BadRequestException('این رزرو قبلاً لغو شده است');
      }
      if (booking.status === BookingStatus.Completed) {
        throw new BadRequestException('رزرو تکمیل‌شده قابل لغو نیست');
      }

      const refund = this.cancellation.calculate({
        totalPrice: Number(booking.totalPrice),
        startsAt: rangeStart(booking.timeSlot),
        now,
        reason,
      });

      // Calculate hours to start for late_cancel_count logic
      const hoursToStart = (rangeStart(booking.timeSlot).getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursToStart < 24 && reason === 'customer_request') {
         await this.dataSource.query(`UPDATE users SET late_cancel_count = late_cancel_count + 1 WHERE id = $1`, [booking.customerId]);
      }

      booking.status = BookingStatus.Cancelled;
      return { booking: await bookings.save(booking), refund };
    });

    this.events.emit(BOOKING_CANCELLED, {
      bookingId: result.booking.id,
      tenantId,
      customerId: result.booking.customerId,
      reason,
      refundAmount: result.refund.refundAmount,
    });
    return result;
  }

  /**
   * Single-row read, scoped to the caller's tenant.
   *
   * `bookings` is FORCE ROW LEVEL SECURITY on
   * `current_setting('app.current_tenant_id')`, so a bare `findOne` is filtered
   * to zero rows and would surface as a spurious 404. Running it inside
   * [inTenant] sets the GUC for the read, exactly like the write paths do.
   */
  async findById(tenantId: string, id: string): Promise<Booking> {
    return this.inTenant(tenantId, async (bookings) => this.findScoped(bookings, tenantId, id));
  }

  /**
   * `findById` against a caller-provided repository, so the read runs on the
   * same (tenant-scoped) connection as the write that follows it.
   */
  private async findScoped(
    bookings: Repository<Booking>,
    tenantId: string,
    id: string,
  ): Promise<Booking> {
    const booking = await bookings.findOne({ where: { tenantId, id } });
    if (!booking) throw new NotFoundException('رزرو مورد نظر یافت نشد');
    return booking;
  }

  /**
   * Run a salon-side transition as its own tenant.
   *
   * `bookings` is FORCE ROW LEVEL SECURITY on `current_setting('app.current_tenant_id')`
   * and nothing sets that variable globally, so without it the SELECT would be
   * filtered to zero rows (404) and the UPDATE would break the policy's
   * WITH CHECK. `set_config(..., true)` is transaction-local, which keeps the
   * value off the pooled connection — the same pattern `create()` uses for the
   * INSERT. `tenantId` always comes from the verified token, never the request.
   */
  private inTenant<T>(
    tenantId: string,
    work: (bookings: Repository<Booking>) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await setTenantContext(manager, tenantId);
      return work(manager.getRepository(Booking));
    });
  }

  /**
   * pending → confirmed. The salon (or its line manager / specialist) accepts
   * the request. Phase 1 takes no payment, so approval is the only gate.
   */
  async approve(user: AuthenticatedUser, id: string): Promise<Booking> {
    const tenantId = this.requireApprover(user);
    const saved = await this.inTenant(tenantId, async (bookings) => {
      const booking = await this.findScoped(bookings, tenantId, id);
      if (booking.status !== BookingStatus.Confirmed) {
        throw new ConflictException('این رزرو قبلاً بررسی شده است');
      }
      booking.status = BookingStatus.Confirmed;
      return bookings.save(booking);
    });
    this.events.emit(BOOKING_CONFIRMED, {
      bookingId: saved.id,
      tenantId,
      customerId: saved.customerId,
      specialistId: saved.specialistId,
      serviceId: saved.serviceId,
    });
    return saved;
  }

  /**
   * pending → cancelled, on the salon's side. The reason is stored on the
   * booking so the customer can see why the request was declined.
   */
  async reject(
    user: AuthenticatedUser,
    id: string,
    reason?: string | null,
  ): Promise<Booking> {
    const tenantId = this.requireApprover(user);
    const saved = await this.inTenant(tenantId, async (bookings) => {
      const booking = await this.findScoped(bookings, tenantId, id);
      if (booking.status !== BookingStatus.Confirmed) {
        throw new ConflictException('این رزرو قبلاً بررسی شده است');
      }
      booking.status = BookingStatus.Cancelled;
      if (reason) booking.notes = booking.notes ? `${booking.notes}\n— ${reason}` : reason;
      return bookings.save(booking);
    });
    this.events.emit(BOOKING_CANCELLED, {
      bookingId: saved.id,
      tenantId,
      customerId: saved.customerId,
      reason: 'specialist_unavailable',
      refundAmount: 0,
    });
    return saved;
  }

  async markNoShow(user: AuthenticatedUser, id: string): Promise<Booking> {
    const tenantId = this.requireApprover(user);
    return this.inTenant(tenantId, async (bookings) => {
      const booking = await this.findScoped(bookings, tenantId, id);
      if (booking.status !== BookingStatus.Confirmed) {
        throw new ConflictException('فقط رزرو تأییدشده را می‌توان به عنوان عدم حضور ثبت کرد');
      }
      booking.status = BookingStatus.NoShow;
      await this.dataSource.query(`UPDATE users SET no_show_count = no_show_count + 1 WHERE id = $1`, [booking.customerId]);
      return bookings.save(booking);
    });
  }

  /** confirmed → completed, marked by the salon after the visit. */
  async markVisited(user: AuthenticatedUser, id: string): Promise<Booking> {
    const tenantId = this.requireApprover(user);
    return this.inTenant(tenantId, async (bookings) => {
      const booking = await this.findScoped(bookings, tenantId, id);
      if (booking.status !== BookingStatus.Confirmed) {
        throw new ConflictException('فقط رزرو تأییدشده را می‌توان تکمیل کرد');
      }
      booking.status = BookingStatus.Completed;
      return bookings.save(booking);
    });
  }

  /**
   * Only the salon's side may act on a booking, and only on its own tenant.
   * Both facts come from the verified token, so neither can be spoofed.
   */
  private requireApprover(user: AuthenticatedUser): string {
    if (!user || !(APPROVER_ROLES as readonly string[]).includes(user.role)) {
      throw new ForbiddenException('این عملیات فقط برای سالن یا مدیر خط مجاز است');
    }
    if (!user.tenantId) {
      throw new ForbiddenException('حساب شما به سالنی متصل نیست');
    }
    return user.tenantId;
  }

  /**
   * completed → reviewed. Driven by ReviewService when feedback is submitted;
   * exposed here so the transition lives beside the rest of the state machine.
   */
  async markReviewed(tenantId: string, id: string): Promise<Booking> {
    // FORCE RLS again: the read and the write must share one tenant-scoped tx.
    return this.inTenant(tenantId, async (bookings) => {
      const booking = await this.findScoped(bookings, tenantId, id);
      if (booking.status !== BookingStatus.Completed) {
        throw new ConflictException('فقط رزرو تکمیل‌شده قابل بازبینی است');
      }
      booking.status = BookingStatus.Reviewed;
      return bookings.save(booking);
    });
  }

  /**
   * Customer-side "I was there". Stops the no-show sweep from flagging a visit
   * that actually happened. The booking must belong to the caller.
   */
  /**
   * Customer-side "I was there". Stops the no-show sweep from flagging a visit
   * that actually happened. The booking must belong to the caller.
   *
   * A customer's JWT carries `tenantId = null` and `bookings` is FORCE ROW LEVEL
   * SECURITY, so the caller cannot read the row to learn the tenant it belongs
   * to. [resolveOwnedBookingTenant] settles that through a SECURITY DEFINER
   * lookup that only answers for a booking the caller owns; the read and the
   * write then run in that tenant's scope, so the RLS policy still guards them.
   */
  async confirmVisitByCustomer(user: AuthenticatedUser, id: string): Promise<Booking> {
    const tenantId = await this.resolveOwnedBookingTenant(user.userId, id);
    return this.inTenant(tenantId, async (bookings) => {
      const booking = await this.findScoped(bookings, tenantId, id);
      if (booking.customerId !== user.userId) throw new NotFoundException('رزرو مورد نظر یافت نشد');
      booking.visitConfirmedByCustomerAt = new Date();
      return bookings.save(booking);
    });
  }

  /**
   * The tenant of a booking, but only when it belongs to `customerId`.
   *
   * Runs through the `get_customer_booking_tenant()` SECURITY DEFINER function
   * (migration 1730000000028): a customer has no tenant of their own, and the
   * booking row is unreadable under FORCE RLS until the GUC is set, so this is
   * the one query that can break the deadlock without widening RLS.
   */
  private async resolveOwnedBookingTenant(customerId: string, bookingId: string): Promise<string> {
    const rows = await this.dataSource.query<Array<{ tenant_id: string | null }>>(
      `SELECT get_customer_booking_tenant($1, $2) AS tenant_id`,
      [bookingId, customerId],
    );
    const tenantId = rows[0]?.tenant_id;
    if (!tenantId) throw new NotFoundException('رزرو مورد نظر یافت نشد');
    return tenantId;
  }
}

function rangeStart(value: string): Date {
  const match = value.match(/\[([^,\]]+)/);
  return match ? new Date(match[1]) : new Date(NaN);
}

function isOverlap(error: unknown): boolean {
  return hasSqlState(error, '23P01');
}

/** True when a thrown value carries the given Postgres SQLSTATE in `code`. */
function hasSqlState(error: unknown, state: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === state;
}

