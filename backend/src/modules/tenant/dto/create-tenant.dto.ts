import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * `POST /tenants` — an admin brings a new salon into existence.
 *
 * Only the two fields a tenant cannot do without are required: a display name
 * and a URL-safe `slug`. The optional `provinceId` / `cityId` pair (migration
 * 1730000000038) pins the salon on the map the moment the admin creates it;
 * both stay optional because a salon is created before its city is picked in
 * the onboarding flow. Everything else (address, phone, logo, working hours)
 * is the owner's job after they accept the invite, so this payload stays small
 * and the create endpoint cannot be used to seed a salon with data the owner
 * never reviewed.
 *
 * The slug is validated here rather than by a unique index alone: a lowercase
 * `[a-z0-9-]` shape is what the public salon URLs and the panel routes assume,
 * and Persian text or spaces would otherwise reach the database and only fail
 * at the `UNIQUE` constraint — or worse, succeed as an unusable URL.
 */
export class CreateTenantDto {
  @ApiProperty({ example: 'سالن ماه', maxLength: 200 })
  @IsString()
  @MinLength(2, { message: 'نام سالن باید حداقل ۲ حرف باشد' })
  @MaxLength(200, { message: 'نام سالن حداکثر ۲۰۰ حرف است' })
  @Transform(({ value }) => String(value ?? '').trim())
  name!: string;

  @ApiProperty({ example: 'salon-mah', maxLength: 100 })
  @IsString()
  @MaxLength(100, { message: 'شناسه سالن حداکثر ۱۰۰ حرف است' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'شناسه سالن فقط می‌تواند شامل حروف کوچک انگلیسی، عدد و خط تیره باشد',
  })
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  slug!: string;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'شناسه استان از provinces (migration 1730000000038). اختیاری.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'provinceId باید UUID معتبر باشد' })
  provinceId?: string | null;

  @ApiPropertyOptional({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'شناسه شهر از cities (migration 1730000000038). اختیاری.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'cityId باید UUID معتبر باشد' })
  cityId?: string | null;
}
