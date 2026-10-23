import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketStatus } from './entities/ticket.entity';
import { Ticket } from './entities/ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketMessage } from './entities/ticket-message.entity';
import { AnswerTicketDto } from './dto/answer-ticket.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketsRepo: Repository<Ticket>,
    @InjectRepository(TicketMessage)
    private readonly ticketMessagesRepo: Repository<TicketMessage>,
  ) {}

  async create(ticket: CreateTicketDto): Promise<Ticket> {
    const createdTicket = this.ticketsRepo.create(ticket);
    return await this.ticketsRepo.save(createdTicket);
  }

  async listByUserId(
    userId: string,
    userRole: string,
    tenantId?: string,
  ): Promise<Ticket[]> {
    let query = this.ticketsRepo.createQueryBuilder('ticket');

    switch (userRole) {
      case 'admin':
      case 'super_admin':
        query = query.where('ticket.customerId = :userId', { userId });
        break;
      case 'salon_owner':
      case 'line_manager':
        // OR: ticket.tenantId = :tenantId OR ticket.specialistId = :userId
        query = query.where(
          '(ticket.tenantId = :tenantId OR ticket.specialistId = :userId)',
          { tenantId, userId },
        );
        break;
      case 'specialist':
      case 'employed':
      case 'booth_renter':
      case 'freelance_mobile':
        query = query.where('ticket.specialistId = :userId', { userId });
        break;
      case 'customer':
        query = query.where('ticket.customerId = :userId', { userId });
        break;
      default:
        throw new ForbiddenException('دسترسی لازم برای دیدن تیکت‌ها را ندارید');
    }

    return await query.orderBy('ticket.createdAt', 'DESC').getMany();
  }

  async assign(ticketId: string, assign: AssignTicketDto, _currentUserId: string): Promise<Ticket> {
    // Only admin can assign tickets
    // But logic here could be limited; call only from admin controller
    const ticket = await this.ticketsRepo.findOne({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('تیکت یافت نشد');
    }

    // Update tenantId
    if (assign.tenantId) {
      ticket.tenantId = assign.tenantId;
    }
    if (assign.specialistId) {
      ticket.specialistId = assign.specialistId;
    }
    if (assign.status) {
      ticket.status = assign.status;
    }
    if (assign.tenantId || assign.specialistId || assign.status) {
      return await this.ticketsRepo.save(ticket);
    }
    return ticket;
  }

  async answer(ticketId: string, answerDto: AnswerTicketDto, _currentUserId: string): Promise<Ticket> {
    const ticket = await this.ticketsRepo.findOne({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('تیکت یافت نشد');
    }

    // You could allow answering only if user is admin or assigned specialist
    // For now, allow any authenticated user to add a response
    const message = this.ticketMessagesRepo.create({
      ticketId,
      senderId: _currentUserId,
      message: answerDto.message || '',
    });

    // Save message first, then update ticket status if provided
    await this.ticketMessagesRepo.save(message);

    if (answerDto.status) {
      ticket.status = answerDto.status;
      if (answerDto.status === TicketStatus.Resolved) {
        // Mark as resolved
      } else if (answerDto.status === TicketStatus.Investigating) {
        // Mark as investigating
      }
      return await this.ticketsRepo.save(ticket);
    }

    return ticket;
  }

  async get(ticketId: string, currentUserId: string, userRole: string, tenantId?: string): Promise<Ticket> {
    const ticket = await this.ticketsRepo.findOne({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('تیکت یافت نشد');
    }

    // Verify access
    switch (userRole) {
      case 'admin':
      case 'super_admin':
        return ticket;
      case 'salon_owner':
      case 'line_manager':
        if (ticket.tenantId !== tenantId && ticket.specialistId !== currentUserId) {
          throw new ForbiddenException('شما به این تیکت دسترسی ندارید');
        }
        break;
      case 'specialist':
      case 'employed':
      case 'booth_renter':
      case 'freelance_mobile':
        if (ticket.specialistId !== currentUserId) {
          throw new ForbiddenException('شما به این تیکت دسترسی ندارید');
        }
        break;
      case 'customer':
        if (ticket.customerId !== currentUserId) {
          throw new ForbiddenException('شما به این تیکت دسترسی ندارید');
        }
        break;
      default:
        throw new ForbiddenException('دسترسی لازم برای دیدن تیکت را ندارید');
    }

    return ticket;
  }
}
