import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { AuthenticatedUser } from "../auth/guards/jwt-auth.guard";
import { setTenantContext } from "../../database/tenant-context";
import { Booking, BookingType, BookingStatus } from "../booking/booking.entity";
import { Specialist } from "../specialist/entities/specialist.entity";
import { Redis } from "ioredis";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class CalendarService {
  private redisClient: Redis;

  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.redisClient = new Redis({
      host: this.configService.get("REDIS_HOST", "localhost"),
      port: this.configService.get("REDIS_PORT", 6379),
    });
  }

  async blockSlot(
    user: AuthenticatedUser,
    specialistId: string,
    start: string,
    end: string,
    reason?: string,
  ) {
    // 1. Resolve tenant context for the user
    if (!user.tenantId) {
      throw new ForbiddenException(
        "فقط کاربران متصل به یک سالن می‌توانند تقویم را مدیریت کنند.",
      );
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      await setTenantContext(manager, user.tenantId!);

      // Verify specialist ownership
      const specialist = await manager.getRepository(Specialist).findOne({
        where: { id: specialistId, tenantId: user.tenantId! },
      });
      if (!specialist) throw new NotFoundException("متخصص یافت نشد");

      return manager.save(
        manager.create(Booking, {
          tenantId: user.tenantId!,
          specialistId,
          bookingType: BookingType.OfflineClient,
          status: BookingStatus.Confirmed, // Treat it as confirmed to occupy GiST space
          timeSlot: `[${start},${end})`,
          notes: reason,
          customerId: null,
          serviceId: null,
          totalPrice: null,
        }),
      );
    });

    // Invalidate available slots cache to avoid N+1 and stale data
    await this.invalidateSpecialistCache(specialistId);
    return saved;
  }

  async unblockSlot(user: AuthenticatedUser, bookingId: string) {
    if (!user.tenantId) throw new ForbiddenException();

    await this.dataSource.transaction(async (manager) => {
      await setTenantContext(manager, user.tenantId!);

      const booking = await manager.getRepository(Booking).findOne({
        where: { id: bookingId, tenantId: user.tenantId! },
      });

      if (!booking) throw new NotFoundException("بازه یافت نشد");
      if (booking.bookingType === BookingType.Platform) {
        throw new ForbiddenException(
          "این رزرو سیستمی است و از طریق تقویم مسدودی قابل حذف نیست.",
        );
      }

      await manager.getRepository(Booking).remove(booking);

      await this.invalidateSpecialistCache(booking.specialistId);
    });

    return { success: true };
  }

  async mySchedule(user: AuthenticatedUser) {
    if (!user.tenantId) throw new ForbiddenException();

    return this.dataSource.transaction(async (manager) => {
      await setTenantContext(manager, user.tenantId!);

      // 1. Get specialist ID for the current user
      const specialist = await manager.getRepository(Specialist).findOne({
        where: { userId: user.userId },
      });
      if (!specialist)
        throw new NotFoundException("شما متخصصی در این سالن ندارید");

      // 2. Load all bookings (platform + offline blocks) in one efficient query
      const bookings = await manager.query(
        `SELECT id, booking_type, time_slot, status, notes, created_at
         FROM bookings
         WHERE specialist_id = $1
         AND status NOT IN ('cancelled', 'no_show')
         ORDER BY lower(time_slot) ASC`,
        [specialist.id],
      );

      return bookings;
    });
  }

  private async invalidateSpecialistCache(specialistId: string) {
    if (this.redisClient.status === "ready") {
      const keys = await this.redisClient.keys(
        `available_slots:${specialistId}:*`,
      );
      if (keys.length > 0) {
        await this.redisClient.del(keys);
      }
    }
  }
}
