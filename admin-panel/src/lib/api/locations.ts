import api from './client';

/**
 * Province/city reference data (`/locations`), seeded by migration
 * 1730000000039 and read-only for every caller.
 *
 * The endpoints are `@Public`, so no token is needed; the shared `api` instance
 * still attaches one when a session exists, which is harmless here.
 *
 * The wire shape is the entity as TypeORM serialises it; only the fields the
 * pickers need are declared, so extra columns (lat/lng, displayOrder) are
 * dropped on arrival rather than carried through the app.
 */
export interface Province {
  id: string;
  code: string;
  nameFa: string;
  nameEn: string;
}

export interface City {
  id: string;
  provinceId: string;
  code: string;
  nameFa: string;
  nameEn: string;
  isCapital: boolean;
}

/**
 * `GET /locations/provinces` — every active province, display-order first.
 *
 * The result is stable catalogue data, so the query cache holds it for the
 * panel's whole `staleTime` window and every picker on the page shares one
 * request.
 */
export async function getProvinces(): Promise<Province[]> {
  const { data } = await api.get<Province[]>('/locations/provinces');
  return data;
}

/**
 * `GET /locations/provinces/:id/cities` — the cities of one province, capital
 * first. An unknown province answers an empty list rather than throwing, so the
 * picker simply shows nothing instead of an error banner.
 */
export async function getCities(provinceId: string): Promise<City[]> {
  const { data } = await api.get<City[]>(`/locations/provinces/${provinceId}/cities`);
  return data;
}
