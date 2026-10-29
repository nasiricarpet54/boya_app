export interface MobileSpecialistDto {
  id: string;
  fullName: string;
  phone: string;
  avatarUrl: string | null;
  bio: string | null;
  skills: string | null;
  offersMobileService: boolean;
}