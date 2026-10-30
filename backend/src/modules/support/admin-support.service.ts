import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

import { AdminUpdateTicketDto } from './dto/admin-update-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { SupportTicket, TicketStatus } from './support-ticket.entity';

export interface SupportTicketListPage {
  data: SupportTicket[];
  total: number;
  page: number;
  totalPages: number;
}

@Injectable()
export class AdminSupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly tickets: Repository<SupportTicket>,
  ) {}

  async listAll(query: ListTicketsQueryDto): Promise<SupportTicketListPage> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.tickets.createQueryBuilder('t');

    if (query.status) qb.andWhere('t.status = :status', { status: query.status });
    if (query.priority) qb.andWhere('t.priority = :priority', { priority: query.priority });
    if (query.type) qb.andWhere('t.type = :type', { type: query.type });
    if (query.salonId) qb.andWhere('t.salonId = :salonId', { salonId: query.salonId });
    if (query.search) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('t.subject ILIKE :q', { q: `%${query.search}%` }).orWhere(
            't.message ILIKE :q',
            { q: `%${query.search}%` },
          );
        }),
      );
    }

    qb.orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async update(
    id: string,
    adminId: string,
    dto: AdminUpdateTicketDto,
  ): Promise<SupportTicket> {
    const ticket = await this.tickets.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('تیکت مورد نظر یافت نشد');

    if (dto.status !== undefined) ticket.status = dto.status;
    if (dto.priority !== undefined) ticket.priority = dto.priority;
    if (dto.adminResponse !== undefined) {
      ticket.adminResponse = dto.adminResponse;
      ticket.respondedBy = adminId;
      ticket.respondedAt = new Date();
      if (ticket.status === TicketStatus.Open && !dto.status) {
        ticket.status = TicketStatus.Answered;
      }
    }

    return this.tickets.save(ticket);
  }
}