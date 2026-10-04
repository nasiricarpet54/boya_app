import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Specialist } from './entities/specialist.entity';

export interface CreateSpecialistInput {
  tenantId: string;
  userId: string;
  bio?: string | null;
  skills?: string[];
  commissionRate?: number;
}

@Injectable()
export class SpecialistService {
  constructor(@InjectRepository(Specialist) private readonly specialists: Repository<Specialist>) {}

  async create(input: CreateSpecialistInput): Promise<Specialist> {
    const duplicate = await this.specialists.findOne({
      where: { tenantId: input.tenantId, userId: input.userId },
    });
    if (duplicate) throw new BadRequestException('این کاربر قبلاً به عنوان متخصص در این سالن ثبت شده است');
    return this.specialists.save(
      this.specialists.create({
        tenantId: input.tenantId,
        userId: input.userId,
        bio: input.bio ?? null,
        skills: input.skills ?? [],
        commissionRate: (input.commissionRate ?? 50).toFixed(2),
      }),
    );
  }

  findAll(tenantId: string): Promise<Specialist[]> {
    return this.specialists.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
  }

  async findById(tenantId: string, id: string): Promise<Specialist> {
    const specialist = await this.specialists.findOne({ where: { tenantId, id } });
    if (!specialist) throw new NotFoundException('متخصص مورد نظر یافت نشد');
    return specialist;
  }
}

