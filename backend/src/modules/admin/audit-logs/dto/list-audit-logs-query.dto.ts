import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

/** Query of `GET /admin/audit-logs`. */
export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({ description: 'شناسه ادمین اجراکنندهٔ اقدام' })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  /**
   * Prefix match: the panel chips send `tenant.` / `user.` / `booking.`,
   * a full action name (`tenant.approved`) also matches itself.
   */
  @ApiPropertyOptional({ example: 'tenant.', description: 'پیشوند action' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  action?: string;

  @ApiPropertyOptional({ enum: ['tenant', 'user', 'booking'] })
  @IsOptional()
  @IsIn(['tenant', 'user', 'booking'], {
    message: 'targetType باید یکی از tenant، user یا booking باشد',
  })
  targetType?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
