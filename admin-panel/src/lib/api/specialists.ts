import api from './client';

export interface SpecialistItem {
  id: string;
  tenantId: string;
  userId: string;
  bio: string | null;
  skills: string[];
  commissionRate: string;
  isActive: boolean;
  offersMobileService: boolean;
  status: string;
  rejectionReason?: string | null;
  profileCompleted: boolean;
  createdAt: string;
}

export interface CreateSpecialistPayload {
  userId: string;
  tenantId?: string;
  bio?: string;
  skills?: string[];
  commissionRate?: number;
}

export interface MobileSpecialist {
  id: string;
  name: string;
  phone: string;
  specialty: string;
  city: string;
  isActive: boolean;
}

export const specialistsApi = {
  getSpecialists(tenantId?: string): Promise<SpecialistItem[]> {
    const params = tenantId ? { tenantId } : undefined;
    return api.get<SpecialistItem[]>('/specialists', { params }).then((r) => r.data);
  },

  getSpecialistById(id: string, tenantId?: string): Promise<SpecialistItem> {
    const params = tenantId ? { tenantId } : undefined;
    return api.get<SpecialistItem>(`/specialists/${id}`, { params }).then((r) => r.data);
  },

  createSpecialist(payload: CreateSpecialistPayload): Promise<SpecialistItem> {
    return api.post<SpecialistItem>('/specialists', payload).then((r) => r.data);
  },

  getMobileSpecialists(): Promise<MobileSpecialist[]> {
    return api
      .get<MobileSpecialist[]>('/admin/specialists/mobile')
      .then((r) => r.data);
  },
};