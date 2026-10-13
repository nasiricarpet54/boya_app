import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import { TicketType } from '../support-ticket.entity';

/**
 * Body of `POST /support/tickets`. Everything the customer can set; the status,
 * the priority and the timestamps are decided server-side.
 */
export class CreateTicketDto {
  @ApiProperty({
    enum: TicketType,
    example: TicketType.Complaint,
    description: 'نوع تیکت: سوال، شکایت، پیشنهاد یا دیگر',
  })
  @IsEnum(TicketType, { message: 'نوع تیکت نامعتبر است' })
  type!: TicketType;

  @ApiProperty({ example: 'کیفیت خدمات سالن', description: 'موضوع کوتاه تیکت' })
  @IsString()
  @MinLength(3, { message: 'موضوع باید حداقل ۳ کاراکتر باشد' })
  @MaxLength(200, { message: 'موضوع باید حداکثر ۲۰۰ کاراکتر باشد' })
  subject!: string;

  @ApiProperty({ example: 'مراجعه شما حساب کمتری داشت', description: 'متن کامل تیکت' })
  @IsString()
  @MinLength(10, { message: 'متن باید حداقل ۱۰ کاراکتر باشد' })
  @MaxLength(5000, { message: 'متن باید حداکثر ۵۰۰۰ کاراکتر باشد' })
  message!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'رزرو مرتبط، در صورت وجود' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه رزرو معتبر نیست' })
  bookingId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'سالن مرتبط، در صورت وجود' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه سالن معتبر نیست' })
  salonId?: string;
}
