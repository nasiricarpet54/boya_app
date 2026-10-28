import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * `PATCH /customer/addresses/:id` body.
 *
 * Whitelist only the fields the caller may edit; keys that are not here are
 * ignored by `class-validator` and never reach the row.
 */
export class UpdateAddressDto {
  @ApiPropertyOptional({ description: 'برچسب آدرس (خانه/کارگاه/سایر)' })
  @IsOptional()
  @IsString()
  @IsIn(['home', 'work', 'other'], { message: 'وضعیت آدرس باید خانه، محل کار یا سایر باشد' })
  @MaxLength(20, { message: 'برچسب آدرس نمیتواند از ۲۰ کاراکتر بیشتر باشد' })
  title?: string;

  @ApiPropertyOptional({ description: 'تغییر متن آدرس' })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'آدرس نمیتواند از ۵۰۰ کاراکتر بیشتر باشد' })
  address?: string;
}
