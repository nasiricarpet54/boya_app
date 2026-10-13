import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';

import { City } from './entities/city.entity';
import { Province } from './entities/province.entity';
import { LocationService } from './location.service';

/**
 * `reverseGeocode` never touches Postgres for the Neshan half of its work, so
 * the only collaborator that has to behave is `globalThis.fetch`. These specs
 * stub it and read the request back off the call, the way the Flutter specs stub
 * Dio — no mocking framework, per the repo's dependency choices.
 *
 * The repository is a chain mock (`createQueryBuilder` returning `this` at
 * every step) because the city lookup is a TypeORM query builder whose SQL is
 * not what these tests are about; what matters is that a matched name populates
 * `city`/`province` and an unmatched one leaves them null.
 */

const TEHRAN = { id: 'c1', provinceId: 'p1', nameFa: 'تهران' } as City;
const TEHRAN_PROVINCE = { id: 'p1', nameFa: 'تهران' } as Province;

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** The chain `reverseGeocode` builds: `innerJoinAndSelect(...).where(...).andWhere(...).getOne()`. */
function cityRepoReturning(city: City | null): Repository<City> {
  const getOne = jest.fn().mockResolvedValue(city);
  const chain = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne,
  };
  return { createQueryBuilder: jest.fn().mockReturnValue(chain) } as unknown as Repository<City>;
}

function serviceWith({
  apiKey,
  city = null,
  fetch: fetchStub,
}: {
  apiKey: string;
  city?: City | null;
  fetch: Fetch;
}): LocationService {
  const config = { get: jest.fn().mockReturnValue(apiKey) } as unknown as ConfigService;
  // `jest.spyOn` so `afterEach` can put the real `fetch` back; a plain
  // assignment would leave the stub in place for the next spec.
  jest.spyOn(globalThis, 'fetch').mockImplementation(fetchStub as typeof globalThis.fetch);
  return new LocationService(
    {} as Repository<Province>,
    cityRepoReturning(city),
    config,
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('LocationService.reverseGeocode', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('answers 503 when no Neshan key is configured', async () => {
    const service = serviceWith({ apiKey: '', fetch: jest.fn() });

    await expect(service.reverseGeocode(35.7575, 51.41)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('treats the .env.example placeholder as unset', async () => {
    const service = serviceWith({ apiKey: 'change-me', fetch: jest.fn() });

    await expect(service.reverseGeocode(35.7575, 51.41)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('sends the coordinates and the Api-Key header to Neshan v5', async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const service = serviceWith({
      apiKey: 'neshan-key',
      city: TEHRAN,
      fetch: async (url, init) => {
        calls.push([url, init]);
        return jsonResponse({ city: 'تهران', formatted_address: 'تهران، ...', province: 'تهران' });
      },
    });

    await service.reverseGeocode(35.7575, 51.41);

    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('https://api.neshan.org/v5/reverse?lat=35.7575&lng=51.41');
    expect(calls[0][1]?.headers).toEqual({ 'Api-Key': 'neshan-key' });
  });

  it('returns the catalogue city and province when Neshan names a seeded city', async () => {
    const service = serviceWith({
      apiKey: 'neshan-key',
      city: { ...TEHRAN, province: TEHRAN_PROVINCE },
      fetch: async () =>
        jsonResponse({ city: 'تهران', formatted_address: 'تهران، ولیعصر', province: 'تهران' }),
    });

    const result = await service.reverseGeocode(35.7575, 51.41);

    expect(result.cityName).toBe('تهران');
    expect(result.formattedAddress).toBe('تهران، ولیعصر');
    expect(result.provinceName).toBe('تهران');
    expect(result.city?.id).toBe('c1');
    expect(result.province?.id).toBe('p1');
  });

  it('leaves the catalogue rows null when the seed has no such city', async () => {
    const service = serviceWith({
      apiKey: 'neshan-key',
      city: null,
      fetch: async () => jsonResponse({ city: 'ناموجود', formatted_address: '...', province: '...' }),
    });

    const result = await service.reverseGeocode(35.7575, 51.41);

    // The name is still reported — the app can fall back to search with it.
    expect(result.cityName).toBe('ناموجود');
    expect(result.city).toBeNull();
    expect(result.province).toBeNull();
  });

  it('answers 503 when Neshan itself errors', async () => {
    const service = serviceWith({
      apiKey: 'neshan-key',
      fetch: async () => jsonResponse({ message: 'unauthorized' }, 401),
    });

    await expect(service.reverseGeocode(35.7575, 51.41)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('answers 503 when the Neshan call throws', async () => {
    const service = serviceWith({
      apiKey: 'neshan-key',
      fetch: async () => {
        throw new Error('network down');
      },
    });

    await expect(service.reverseGeocode(35.7575, 51.41)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
