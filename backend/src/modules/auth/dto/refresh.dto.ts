import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/** Body of `POST /auth/refresh` and `POST /auth/logout`. */
export class RefreshTokenDto {
  @ApiProperty({
    description:
      'توکن تازه‌سازی صادرشده در ورود یا refresh قبلی. در DB فقط SHA-256 آن نگه‌داری می‌شود.',
  })
  @IsString()
  @Matches(/^[0-9a-f]{64}$/, {
    message: 'توکن تازه‌سازی باید یک رشته hex با طول ۶۴ باشد',
  })
  refreshToken!: string;
}

/** Optional client hint recorded against the session. */
export class DeviceInfoDto {
  @ApiProperty({ required: false, example: 'android:14:samsung' })
  @IsString()
  deviceInfo?: string;
}