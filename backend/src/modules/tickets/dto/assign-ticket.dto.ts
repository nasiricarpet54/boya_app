import { IsUUID, IsOptional, IsIn } from 'class-validator';
import { TicketStatus } from './create-ticket.dto';

export class AssignTicketDto {
  @IsOptional()
  @IsUUID()
  specialistId?: string | null;

  @IsOptional()
  @IsUUID()
  tenantId?: string | null;

  @IsOptional()
  @IsIn([TicketStatus.Open, TicketStatus.Investigating, TicketStatus.Resolved, TicketStatus.Closed])
  status?: TicketStatus;
}
