import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { City } from './entities/city.entity';
import { Province } from './entities/province.entity';

/**
 * Read-only access to the Iranian province/city reference data.
 *
 * Everything here is static catalogue data seeded by migration 1730000000039,
 * so the service only ever reads. The endpoints are public — a customer picks
 * a city before signing in — and the tables carry no RLS because no row is
 * tenant-scoped.
 */
@Injectable()
export class LocationService {
  constructor(
    @InjectRepository(Province) private readonly provinceRepo: Repository<Province>,
    @InjectRepository(City) private readonly cityRepo: Repository<City>,
  ) {}

  /** Every active province, in the order the apps list them. */
  async listProvinces(): Promise<Province[]> {
    return this.provinceRepo.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC' },
    });
  }

  /** Every active city of one province, capitals first by `displayOrder`. */
  async listCities(provinceId: string): Promise<City[]> {
    return this.cityRepo.find({
      where: { provinceId, isActive: true },
      order: { displayOrder: 'ASC' },
    });
  }

  /**
   * Cities whose Persian or English name contains `query`, anywhere in Iran.
   *
   * `ILIKE` is Postgres-only and case-insensitive, which matters for the Latin
   * names (`teh` finds `Tehran`); the Persian names are already
   * case-insensitive to `ILIKE`. The caller guards the minimum length, so an
   * empty result here means the term genuinely matched nothing.
   */
  async searchCities(query: string, limit = 20): Promise<City[]> {
    return this.cityRepo
      .createQueryBuilder('c')
      .where('c.is_active = true')
      .andWhere('c.name_fa ILIKE :q OR c.name_en ILIKE :q', { q: `%${query}%` })
      .orderBy('c.display_order', 'ASC')
      .limit(limit)
      .getMany();
  }
}
