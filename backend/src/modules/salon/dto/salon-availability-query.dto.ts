import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';

/**
 * Query of `GET /salons/:id/available-slots`.
 *
 * `date` is a calendar day (Gregorian, as the app stores dates); the slots that
 * come back are labelled with Tehran wall-clock times.
 */
export class SalonAvailabilityQueryDto {
  @ApiProperty({ example: '2026-10-15', description: 'روز مورد نظر (میلادی)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'تاریخ باید در قالب YYYY-MM-DD باشد' })
  date!: string;

  @ApiProperty({ description: 'شناسه خدمت؛ مدت آن طول هر اسلات را تعیین می‌کند' })
  @IsUUID('loose')
  serviceId!: string;

  /**
   * Optional. Without it a slot counts as free only when no specialist of the
   * salon is booked over it; with it only that specialist's bookings matter.
   */
  @ApiPropertyOptional({ description: 'شناسه متخصص (اختیاری)' })
  @IsOptional()
  @IsUUID('loose')
  specialistId?: string;
}
