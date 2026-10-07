import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

import { toLatinDigits } from '../../../utils/persian-number.util';

function asLatin(value: unknown): unknown {
  return typeof value === 'string' ? toLatinDigits(value).split(' ').join('').split('-').join('') : value;
}

export class SendOtpDto {
  @ApiProperty({ example: '09121234567' })
  @Transform(({ value }) => asLatin(value))
  @IsString()
  @Matches(/^09[0-9]{9}$/)
  phoneNumber!: string;

  /**
   * Which flow the code is for. `OtpService` namespaces the Redis key by this,
   * so an invite code cannot be spent on the login endpoint or the other way
   * round. The invite-accept screen asks for `invite`; everything else logs in.
   *
   * Optional and defaults to `login` so the existing callers (both apps, the
   * admin panel) keep working unchanged.
   */
  @ApiProperty({ enum: ['login', 'invite'], required: false, default: 'login' })
  @IsOptional()
  @IsIn(['login', 'invite'])
  purpose?: 'login' | 'invite';
}

export class VerifyOtpDto {
  @ApiProperty({ example: '09121234567' })
  @Transform(({ value }) => asLatin(value))
  @IsString()
  @Matches(/^09[0-9]{9}$/)
  phoneNumber!: string;

  @ApiProperty({ example: '123456' })
  @Transform(({ value }) => asLatin(value))
  @IsString()
  @Matches(/^[0-9]{6}$/)
  code!: string;
}
