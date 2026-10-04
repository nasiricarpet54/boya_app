import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ServiceLine } from './entities/service-line.entity';

export interface CreateServiceLineInput {
  tenantId: string;
  name: string;
  description?: string | null;
  managerId?: string | null;
}

@Injectable()
export class ServiceLineService {
  constructor(@InjectRepository(ServiceLine) private readonly lines: Repository<ServiceLine>) {}

  async create(input: CreateServiceLineInput): Promise<ServiceLine> {
    const duplicate = await this.lines.findOne({ where: { tenantId: input.tenantId, name: input.name } });
    if (duplicate) throw new BadRequestException('خطی با این نام قبلاً ثبت شده است');
    return this.lines.save(
      this.lines.create({
        tenantId: input.tenantId,
        name: input.name,
        description: input.description ?? null,
        managerId: input.managerId ?? null,
      }),
    );
  }

  findAll(tenantId: string): Promise<ServiceLine[]> {
    return this.lines.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
  }

  async findById(tenantId: string, id: string): Promise<ServiceLine> {
    const line = await this.lines.findOne({ where: { tenantId, id } });
    if (!line) throw new NotFoundException('خط خدماتی مورد نظر یافت نشد');
    return line;
  }
}
