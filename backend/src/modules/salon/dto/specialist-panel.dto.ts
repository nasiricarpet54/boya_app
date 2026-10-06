import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { normalizePhone } from '../../auth/utils/phone.util';

/**
 * Body of `POST /salon/me/specialists`.
 *
 * `phone` is the join key into `users` — it is normalised through the same
 * helper the auth module uses (Persian/Arabic-Indic digits to Latin, `+98`/
 * `0098`/`912…` to a leading `0`) before the 09… rule is applied, so the
 * salon owner can type the number however they habitually do.
 */
export class CreateSpecialistPanelDto {
  @ApiProperty({ example: '09121234567', description: 'شماره موبایل متخصص' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizePhone(value) : value))
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل وارد شده معتبر نیست' })
  phone!: string;

  @ApiProperty({ maxLength: 200, example: 'مریم رضایی' })
  @IsString()
  @MaxLength(200)
  fullName!: string;

  @ApiPropertyOptional({ maxLength: 1000, example: 'رنگ، مش و کوتاه کردن' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @ApiPropertyOptional({ type: [String], example: ['رنگ', 'کوتاهی', 'شینیون'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  skills?: string[];

  @ApiPropertyOptional({ example: 50, description: 'درصد پورسانت' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate?: number;
}

/**
 * Body of `PATCH /salon/me/specialists/:id`.
 *
 * No field here is approval-gated: bio, skills and the commission rate apply
 * immediately, and `is_active` toggles the specialist in and out of the
 * public catalogue. Phone and full name are deliberately absent — the phone
 * is the user-row join key and the name lives on `users`, neither of which
 * this endpoint edits.
 *
 * `workingHours` was added for the specialist's own onboarding form. Note it is
 * *not* the schedule the booking engine uses: bookings are checked against the
 * salon's `tenants.working_hours`. This is the specialist's stated availability,
 * stored for the profile and reserved for the Phase 2 slot engine; nothing
 * reads it for availability yet.
 */
export class UpdateSpecialistPanelDto {
  @ApiPropertyOptional({ maxLength: 1000, example: 'رنگ، مش و کوتاه کردن' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @ApiPropertyOptional({ type: [String], example: ['رنگ', 'کوتاهی'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  skills?: string[];

  @ApiPropertyOptional({ example: 50, description: 'درصد پورسانت' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate?: number;

  @ApiPropertyOptional({ example: true, description: 'نمایش متخصص در کاتالوگ عمومی' })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { saturday: { active: true, start: '09:00', end: '18:00' } },
    description: 'ساعات کاری اعلامی متخصص (برای پروفایل؛ برای رزرو از ساعات سالن استفاده می‌شود)',
  })
  @IsOptional()
  @IsObject()
  workingHours?: Record<string, unknown>;
}

/** Body of `POST /salon/me/portfolio` — one photo on one specialist. */
export class AddPortfolioItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsString()
  specialistId!: string;

  @ApiProperty({ maxLength: 500, example: 'https://cdn.boya.ir/portfolio/before.jpg' })
  @IsString()
  @MaxLength(500)
  imageUrl!: string;
}
