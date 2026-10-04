import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

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
