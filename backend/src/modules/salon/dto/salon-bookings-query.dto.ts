import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Query params arrive as strings; an empty value must mean "not set". */
function toOptionalNumber({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  return typeof value === 'string' ? Number(value.trim()) : Number(value);
}

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The six statuses `bookings.status` can hold, in the order the tabs show. */
export enum SalonBookingStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Completed = 'completed',
  Reviewed = 'reviewed',
  Cancelled = 'cancelled',
  NoShow = 'no_show',
}

/** Falsy to uppercase, so a typo cannot silently mean "all statuses". */
export function isSalonBookingStatus(value: unknown): value is SalonBookingStatus {
  return (
    typeof value === 'string' &&
    Object.values(SalonBookingStatus).includes(value as SalonBookingStatus)
  );
}

/**
 * Query of `GET /salon/me/bookings`.
 *
 * The window is inclusive on both ends: `date` is one Tehran day,
 * `from`/`to` a range of days, and they combine as `from <= date <= to`.
 */
export class SalonPanelBookingsQueryDto {
  @ApiPropertyOptional({ enum: SalonBookingStatus, description: 'فیلتر وضعیت رزرو' })
  @IsOptional()
  @IsEnum(SalonBookingStatus)
  status?: SalonBookingStatus;

  @ApiPropertyOptional({ example: '2026-10-15', description: 'یک روز به تاریخ میلادی' })
  @IsOptional()
  @Matches(CALENDAR_DAY, { message: 'تاریخ باید در قالب YYYY-MM-DD باشد' })
  date?: string;

  @ApiPropertyOptional({ example: '2026-10-01', description: 'ابتدای بازه (میلادی، شامل)' })
  @IsOptional()
  @Matches(CALENDAR_DAY, { message: 'تاریخ باید در قالب YYYY-MM-DD باشد' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31', description: 'انتهای بازه (میلادی، شامل)' })
  @IsOptional()
  @Matches(CALENDAR_DAY, { message: 'تاریخ باید در قالب YYYY-MM-DD باشد' })
  to?: string;

  @ApiPropertyOptional({ description: 'فقط رزروهای این متخصص' })
  @IsOptional()
  @IsUUID('loose')
  specialistId?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @Transform(toOptionalNumber)
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 100 })
  @Transform(toOptionalNumber)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}

/**
 * Body of `POST /salon/me/bookings/:id/reject`.
 *
 * The customer sees the reason, so it is mandatory and bounded. `minLength: 5`
 * is a typo guard, not a content rule: "لغو شد" would still reach the customer.
 */
export class SalonPanelRejectBookingDto {
  @ApiPropertyOptional({ example: 'متخصص در این ساعت در دسترس نیست', minLength: 5, maxLength: 280 })
  @IsString()
  @MinLength(5, { message: 'دلیل لغو باید حداقل ۵ کاراکتر باشد' })
  @MaxLength(280)
  reason!: string;
}
