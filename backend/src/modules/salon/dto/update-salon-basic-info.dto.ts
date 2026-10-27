import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body of `PATCH /salon/me/basic`.
 *
 * The specialist-facing half of salon editing (task: «ویرایش اطلاعات سالن»
 * restricted to `نام و آدرس سالن` only). The schema deliberately stops at the
 * two identity fields: commission, financial settings, working policies and
 * facility photos are owner-only, and a dedicated DTO is what makes that a
 * property of the request rather than of the caller's goodwill. `class-validator`
 * whitelists unknown keys out, so a key that is not here never reaches the row.
 */
export class UpdateSalonBasicInfoDto {
  @ApiPropertyOptional({ maxLength: 200, example: 'آرایشی نگین' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'نام سالن باید حداقل ۲ کاراکتر باشد' })
  @MaxLength(200, { message: 'نام سالن حداکثر ۲۰۰ کاراکتر است' })
  name?: string;

  @ApiPropertyOptional({ maxLength: 500, example: 'تهران، خیابان ولیعصر، پلاک ۱۲' })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'آدرس حداکثر ۵۰۰ کاراکتر است' })
  address?: string;
}
