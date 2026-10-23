import { IsOptional, IsString, IsIn } from 'class-validator';
import { TicketStatus } from './create-ticket.dto';

export class AnswerTicketDto {
  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsIn([TicketStatus.Open, TicketStatus.Investigating, TicketStatus.Resolved, TicketStatus.Closed])
  status?: TicketStatus;
}
