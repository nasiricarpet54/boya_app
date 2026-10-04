import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { normalizePhone } from '../utils/phone.util';

export class SendOtpDto {
  @ApiProperty({ example: '۰۹۱۲۱۲۳۴۵۶۷', description: 'شماره موبایل کاربر' })
  @IsString({ message: 'شماره موبایل باید متن باشد' })
  @MinLength(10, { message: 'شماره موبایل کوتاه است' })
  @MaxLength(20, { message: 'شماره موبایل طولانی است' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizePhone(value) : value))
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل وارد شده معتبر نیست' })
  phone!: string;
}
