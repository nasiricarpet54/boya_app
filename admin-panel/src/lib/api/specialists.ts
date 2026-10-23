import api from './client';

export interface MobileSpecialist {
  id: string;
  name: string;
  phone: string;
  specialty: string;
  city: string;
  isActive: boolean;
}

export const specialistsApi = {
  getMobileSpecialists(): Promise<MobileSpecialist[]> {
    return api
      .get<MobileSpecialist[]>('/admin/specialists/mobile')
      .then((r) => r.data);
  },
};