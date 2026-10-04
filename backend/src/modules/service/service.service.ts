import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ServiceLineService } from '../service-line/service-line.service';
import { Service } from './entities/service.entity';

export interface CreateServiceInput {
  tenantId: string;
  lineId?: string | null;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: number;
  depositRequired?: boolean;
  depositAmount?: number | null;
}

@Injectable()
export class ServiceCatalogService {
  constructor(
    @InjectRepository(Service) private readonly services: Repository<Service>,
    private readonly lines: ServiceLineService,
  ) {}

  async create(input: CreateServiceInput): Promise<Service> {
    if (input.durationMinutes <= 0) throw new BadRequestException('مدت زمان خدمت باید بیشتر از صفر باشد');
    if (input.price < 0) throw new BadRequestException('قیمت خدمت نمی‌تواند منفی باشد');
    if (input.depositRequired && (input.depositAmount == null || input.depositAmount <= 0)) {
      throw new BadRequestException('برای خدماتی که بیعانه دارند، مبلغ بیعانه باید وارد شود');
    }
    if (input.lineId) await this.lines.findById(input.tenantId, input.lineId);

    return this.services.save(
      this.services.create({
        tenantId: input.tenantId,
        lineId: input.lineId ?? null,
        name: input.name,
        description: input.description ?? null,
        durationMinutes: input.durationMinutes,
        price: input.price.toFixed(0),
        depositRequired: input.depositRequired ?? false,
        depositAmount: input.depositAmount != null ? input.depositAmount.toFixed(0) : null,
      }),
    );
  }

  findAll(tenantId: string): Promise<Service[]> {
    return this.services.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async findById(tenantId: string, id: string): Promise<Service> {
    const service = await this.services.findOne({ where: { tenantId, id } });
    if (!service) throw new NotFoundException('خدمت مورد نظر یافت نشد');
    return service;
  }
}

