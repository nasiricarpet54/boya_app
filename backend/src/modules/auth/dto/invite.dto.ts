import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

import { toLatinDigits } from '../../../utils/persian-number.util';
import { INVITE_ROLES } from '../invite-token.service';

/** `POST /auth/invite` — the inviter states who, and for which role. */
export class CreateInviteDto {
  @ApiProperty({ enum: INVITE_ROLES, example: 'specialist' })
  @IsIn(INVITE_ROLES as unknown as string[], {
    message: 'نقش باید salon_owner یا line_manager یا specialist باشد',
  })
  role!: (typeof INVITE_ROLES)[number];

  @ApiProperty({ required: false, example: '09121234567' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => toLatinDigits(String(value ?? '')).split(' ').join(''))
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone?: string;

  @ApiProperty({ required: false, example: 'nazanin@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  email?: string;

  /**
   * Target salon — **admin only**. Staff tenant always comes from the JWT and
   * any value sent here is ignored; an admin has no salon of their own, so
   * they must name one. `whitelist + forbidNonWhitelisted` would 400 an
   * undeclared key, hence the explicit field.
   */
  @ApiProperty({ required: false, description: 'فقط برای admin' })
  @IsOptional()
  @IsUUID('4', { message: 'شناسه سالن معتبر نیست' })
  tenantId?: string;
}

/** `POST /auth/invite/accept` — `@Public()`; the invite plus the OTP. */
export class AcceptInviteDto {
  @ApiProperty({ description: 'توکن دعوت‌نامه؛ در پیامک ارسال می‌شود.' })
  @IsString()
  @MaxLength(64)
  token!: string;

  @ApiProperty({ example: '09121234567' })
  @IsString()
  @Transform(({ value }) => toLatinDigits(String(value ?? '')).split(' ').join(''))
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل معتبر نیست' })
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^[0-9۰-۹]{6}$/, { message: 'کد تأیید باید ۶ رقم باشد' })
  otpCode!: string;
}