import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * `POST /customer/addresses` body.
 *
 * No `id`: the service auto-creates it. `title` defaults to `home` when the
 * customer sends nothing. `address` must be a real string — the validator
 * fails fast when a user taps the map picker but clears it.
 */
export class CreateAddressDto {
  @ApiProperty({ description: 'ترتیب نمایش در لیست (خانه/کارگاه/سایر)' })
  @IsString()
  @IsIn(['home', 'work', 'other'], { message: 'وضعیت آدرس بایدخانه، محل کار یا سایر باشد' })
  @MinLength(1, { message: 'وضعیت آدرس الزامی است' })
  @MaxLength(20, { message: 'وضعیت آدرس نمیتواند از ۲۰ کاراکتر بیشتر باشد' })
  title!: string;

  @ApiProperty({ description: 'متن آدرس منبعِ رزرو' })
  @IsString()
  @MinLength(5, { message: 'آدرس نامعتبر است' })
  @MaxLength(500, { message: 'آدرس نمیتواند از ۵۰۰ کاراکتر بیشتر باشد' })
  address!: string;

  @ApiProperty({ description: 'عرض مکان دقیقِ آدرس' })
  @Type(() => Number)
  @IsLatitude({}, { message: 'عرض مکان نامعتبر است' })
  latitude!: number;

  @ApiProperty({ description: 'طول مکان دقیقِ آدرس' })
  @Type(() => Number)
  @IsLongitude({}, { message: 'طول مکان نامعتبر است' })
  longitude!: number;

  @ApiPropertyOptional({ description: 'آدرس پیش‌فرض (فقط یک آدرس درونش در هر کاربر انتخاب می‌شود)' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
