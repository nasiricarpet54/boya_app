import { IsString, IsUUID, IsOptional, IsIn, MaxLength, MinLength } from 'class-validator';

export enum TicketStatus {
  Open = 'open',
  Investigating = 'investigating',
  Resolved = 'resolved',
  Closed = 'closed',
}

export enum TicketPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export class CreateTicketDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  trackingCode?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string | null;

  @IsOptional()
  @IsUUID()
  specialistId?: string | null;

  @IsOptional()
  @IsUUID()
  bookingId?: string | null;

  @IsOptional()
  @IsIn([TicketStatus.Open, TicketStatus.Investigating, TicketStatus.Resolved, TicketStatus.Closed])
  status?: TicketStatus;

  @IsOptional()
  @IsIn([TicketPriority.Low, TicketPriority.Medium, TicketPriority.High])
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message?: string;
}
