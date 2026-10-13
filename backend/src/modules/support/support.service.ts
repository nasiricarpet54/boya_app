import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateTicketDto } from './dto/create-ticket.dto';
import { SupportTicket } from './support-ticket.entity';

/**
 * Tickets are owned by the user who filed them. The `userId` argument always
 * comes from the verified token, never from the body, so a customer can only
 * ever create and read their own.
 */
@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly tickets: Repository<SupportTicket>,
  ) {}

  async create(userId: string, dto: CreateTicketDto): Promise<SupportTicket> {
    const ticket = this.tickets.create({
      userId,
      type: dto.type,
      subject: dto.subject,
      message: dto.message,
      // `undefined` would fall back to the column default, but the optional
      // context is a tri-state: explicit `null` keeps the row honest about
      // "no booking attached" rather than leaving the field unset.
      bookingId: dto.bookingId ?? null,
      salonId: dto.salonId ?? null,
    });
    return this.tickets.save(ticket);
  }

  async listMine(userId: string): Promise<SupportTicket[]> {
    return this.tickets.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
