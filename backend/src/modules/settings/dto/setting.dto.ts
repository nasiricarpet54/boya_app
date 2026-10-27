import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

import { SettingScope } from '../entities/platform-setting.entity';

/** Common fields every scope carries. */
export class SettingBase {
  @ApiProperty({ description: 'شناسه سالن (tenant)' })
  @IsUUID('4', { message: 'tenantId معتبر نیست' })
  tenantId!: string;
}

/** `scope=general`: salon identity and contact. */
export class GeneralSettingPayload {
  @ApiProperty({ example: 'سالن ماه', maxLength: 200 })
  @IsString()
  @MinLength(2, { message: 'نام سالن باید حداقل ۲ کاراکتر باشد' })
  @MaxLength(200, { message: 'نام سالن حداکثر ۲۰۰ کاراکتر است' })
  name!: string;

  @ApiPropertyOptional({ example: 'salon-mah', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'اسلاگ حداکثر ۱۰۰ کاراکتر است' })
  slug?: string;

  @ApiPropertyOptional({ example: 'خیابان ولی‌عصر، تهران', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'آدرس حداکثر ۵۰۰ کاراکتر است' })
  address?: string;

  @ApiPropertyOptional({ example: '۰۲۱۸۸۰۰۰۰۰۰', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'تلفن حداکثر ۲۰ کاراکتر است' })
  phone?: string;

  @ApiPropertyOptional({ format: 'uri', description: 'آرم سالن' })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'آدرس تصویر حداکثر ۵۰۰ کاراکتر است' })
  logoUrl?: string;
}

/** `scope=fees`: platform cut and cancellation policy. */
export class FeeSettingPayload {
  @ApiProperty({ example: 15, description: 'درصد سهم پلتفرم (۰ تا ۱۰۰)' })
  @IsInt()
  @Min(0, { message: 'در سهم پلتفرم نمی‌تواند منفی باشد' })
  @Max(100, { message: 'در سهم پلتفرم نمی‌تواند از ۱۰۰ بیشتر باشد' })
  platformCommissionPercent!: number;

  @ApiPropertyOptional({ example: 10000, description: 'حداقل مبلغ رزرو به تومان' })
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'حداقل مبلغ نمی‌تواند منفی باشد' })
  minBookingAmount?: number;

  @ApiPropertyOptional({ example: 24, description: 'ساعت مجاز برای لغو بدون جریمه' })
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'ساعت لغو نمی‌تواند منفی باشد' })
  freeCancellationHours?: number;
}

/** `scope=working_hours`: weekly slots. */
export class WorkingHourSlot {
  @ApiProperty({ enum: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] })
  @IsIn(['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'], { message: 'روز هفته نامعتبر است' })
  day!: string;

  @ApiProperty({ example: '09:00', pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'ساعت شروع نامعتبر است' })
  start!: string;

  @ApiProperty({ example: '19:00', pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'ساعت پایان نامعتبر است' })
  end!: string;
}

export class WorkingHoursSettingPayload {
  @ApiProperty({ type: [WorkingHourSlot] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHourSlot)
  slots!: WorkingHourSlot[];
}

/** `scope=notifications`: what the salon gets pinged about. */
export class NotificationSettingPayload {
  @ApiProperty({ example: true, description: 'اعلان رزرو جدید' })
  @IsBoolean()
  notifyNewBooking!: boolean;

  @ApiProperty({ example: true, description: 'اعلان تغییر رزرو' })
  @IsBoolean()
  notifyBookingChange!: boolean;

  @ApiProperty({ example: false, description: 'اعلان یادآوری رزرو' })
  @IsBoolean()
  notifyReminder!: boolean;
}

/** Union of all payloads, discriminated by `scope`. */
export type SettingPayload =
  | GeneralSettingPayload
  | FeeSettingPayload
  | WorkingHoursSettingPayload
  | NotificationSettingPayload;

/** Body of `POST /admin/settings` / `PUT /admin/settings/:id`. */
export class UpsertSettingDto extends SettingBase {
  @ApiProperty({ enum: SettingScope })
  @IsEnum(SettingScope, { message: 'نوع تنظیمات نامعتبر است' })
  scope!: SettingScope;

  @ApiProperty({ description: 'مقادیر تنظیمات' })
  @ValidateNested()
  @Type(() => GeneralSettingPayload, { keepDiscriminatingValue: true })
  payload!: Record<string, unknown>;
}