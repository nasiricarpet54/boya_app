import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { City } from './entities/city.entity';
import { Province } from './entities/province.entity';

/** The slice of Neshan's v5 `reverse` answer the geocoding reads. */
interface NeshanReverseResponse {
  formatted_address?: string;
  city?: string;
  province?: string;
}

/**
 * `POST /locations/reverse-geocode`: the Persian city name Neshan reports for a
 * GPS fix, plus the seeded catalogue rows when that name matches a `cities` row.
 */
export interface ReverseGeocodeResult {
  /** `data.city`, e.g. `تهران`. `null` when Neshan names no city. */
  cityName: string | null;
  formattedAddress: string | null;
  /** The Persian province name Neshan reports alongside the city. */
  provinceName: string | null;
  /** The seeded row matching [cityName]. `null` when the seed has no such city. */
  city: City | null;
  /** The province row joined to [city]. `null` whenever [city] is. */
  province: Province | null;
}

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
  private readonly logger = new Logger(LocationService.name);

  constructor(
    @InjectRepository(Province) private readonly provinceRepo: Repository<Province>,
    @InjectRepository(City) private readonly cityRepo: Repository<City>,
    private readonly config: ConfigService,
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

  /**
   * Resolves a device GPS fix to the Iranian city it falls in.
   *
   * The seeded `cities` rows carry no coordinates, so the lookup is indirect:
   * Neshan names the city in Persian and that name is matched against
   * `name_fa`. The matched row is returned with its province joined, so the app
   * can select the city in its picker without a second round trip.
   *
   * Without an API key the route answers 503 rather than guessing, because a
   * wrong city silently scopes the feed to the wrong salons — the failure is
   * worth surfacing. The placeholder values from `.env.example` count as unset.
   */
  async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
    const apiKey = this.config.get<string>('NESHAN_API_KEY', '');
    if (!apiKey || apiKey === 'unused' || apiKey === 'change-me') {
      throw new ServiceUnavailableException('سرویس موقعیت‌یابی پیکربندی نشده است');
    }

    const data = await this.callNeshanReverse(lat, lng, apiKey);

    const cityName = data.city?.trim() || null;
    const result: ReverseGeocodeResult = {
      cityName,
      formattedAddress: data.formatted_address?.trim() || null,
      provinceName: data.province?.trim() || null,
      city: null,
      province: null,
    };
    if (!cityName) return result;

    // Exact match on the Persian name: Neshan returns the canonical name
    // (`تهران`), and `ILIKE` makes it case-insensitive the way `searchCities`
    // is, so a differently-cased English/transliterated answer cannot slip past.
    const city = await this.cityRepo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.province', 'p')
      .where('c.is_active = true')
      .andWhere('c.name_fa ILIKE :name', { name: cityName })
      .getOne();

    if (city) {
      result.city = city;
      result.province = city.province ?? null;
    }
    return result;
  }

  /**
   * Calls Neshan's v5 reverse endpoint. Every failure — a non-2xx status, a
   * network error, an unparseable body — becomes a 503, because from the
   * customer's seat there is no difference between them: the service is not
   * usable right now.
   */
  private async callNeshanReverse(
    lat: number,
    lng: number,
    apiKey: string,
  ): Promise<NeshanReverseResponse> {
    try {
      const response = await fetch(
        `https://api.neshan.org/v5/reverse?lat=${lat}&lng=${lng}`,
        { headers: { 'Api-Key': apiKey } },
      );
      if (!response.ok) {
        this.logger.warn(`Neshan reverse geocoding failed: HTTP ${response.status}`);
        throw new ServiceUnavailableException('سرویس موقعیت‌یابی در دسترس نیست');
      }
      return (await response.json()) as NeshanReverseResponse;
    } catch (error) {
      // The 503 above must travel, not be swallowed by this handler.
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.warn(`Neshan reverse geocoding threw: ${String(error)}`);
      throw new ServiceUnavailableException('سرویس موقعیت‌یابی در دسترس نیست');
    }
  }
}
