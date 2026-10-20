import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateScheduleBlockDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  specialistId?: string;

  @ApiProperty()
  @IsDateString()
  startTime!: string;

  @ApiProperty()
  @IsDateString()
  endTime!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}
