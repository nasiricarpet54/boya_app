import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Tenant } from './entities/tenant.entity';

@Injectable()
export class TenantService {
  constructor(@InjectRepository(Tenant) private readonly tenants: Repository<Tenant>) {}

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenants.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('سالن مورد نظر یافت نشد');
    return tenant;
  }
}

