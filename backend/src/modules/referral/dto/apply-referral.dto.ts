import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ApplyReferralDto {
  @ApiProperty({ example: 'BOYA7K3M9P' })
  @IsString()
  @MinLength(10, { message: 'کد معرف نامعتبر است' })
  @MaxLength(20, { message: 'کد معرف نامعتبر است' })
  code!: string;
}
