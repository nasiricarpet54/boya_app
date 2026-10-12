import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { normalizePhone } from '../../../auth/utils/phone.util';

/** Body of `PATCH /admin/tenants/:id` (edit of the public salon fields). */
export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'سالن زیبایی آروشا', minLength: 2, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'نام حداقل ۲ حرف است' })
  @MaxLength(200, { message: 'نام حداکثر ۲۰۰ حرف است' })
  name?: string;

  @ApiPropertyOptional({ example: 'Arousha Beauty', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'نام انگلیسی حداکثر ۲۵۵ حرف است' })
  nameEn?: string;

  @ApiPropertyOptional({
    example: 'arousha-beauty',
    description: 'اسلاگ یکتا؛ فقط حروف کوچک انگلیسی، رقم و خط تیره.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'اسلاگ حداقل ۲ نویسه است' })
  @MaxLength(100, { message: 'اسلاگ حداکثر ۱۰۰ نویسه است' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'اسلاگ فقط می‌تواند شامل حروف کوچک انگلیسی، رقم و خط تیره باشد',
  })
  slug?: string;

  @ApiPropertyOptional({ example: 'تهران، خیابان ولیعصر' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: '09121234567' })
  @IsOptional()
  // Same normaliser as the rest of the app (Persian/Arabic-Indic digits to
  // Latin, `+98`/`0098`/`912…` to a leading `0`) before the 09… rule applies.
  @Transform(({ value }) => (typeof value === 'string' ? normalizePhone(value) : value))
  @Matches(/^09[0-9]{9}$/, { message: 'شماره موبایل وارد شده معتبر نیست' })
  phone?: string;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'شناسه دسته‌بندی از service_categories.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'categoryId باید UUID معتبر باشد' })
  categoryId?: string;

  @ApiPropertyOptional({ example: 15, description: 'درصد تخفیف بین ۰ تا ۱۰۰.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'discountPercent باید عدد صحیح باشد' })
  @Min(0, { message: 'درصد تخفیف حداقل ۰ است' })
  @Max(100, { message: 'درصد تخفیف حداکثر ۱۰۰ است' })
  discountPercent?: number;

  @ApiPropertyOptional({ example: true, description: 'نمایش سالن در بخش ویژه.' })
  @IsOptional()
  @IsBoolean({ message: 'isFeatured باید بولی باشد' })
  isFeatured?: boolean;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'شناسه استان از provinces (migration 1730000000038).',
  })
  @IsOptional()
  @IsUUID('4', { message: 'provinceId باید UUID معتبر باشد' })
  provinceId?: string | null;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'شناسه شهر از cities (migration 1730000000038).',
  })
  @IsOptional()
  @IsUUID('4', { message: 'cityId باید UUID معتبر باشد' })
  cityId?: string | null;
}
