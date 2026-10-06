import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * `POST /tenants` — an admin brings a new salon into existence.
 *
 * Only the two fields a tenant cannot do without are accepted: a display name
 * and a URL-safe `slug`. Everything else (address, phone, logo, working hours)
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
}
