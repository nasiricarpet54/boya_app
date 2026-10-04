export interface OtpStorage {
  set(phone: string, code: string, ttlSeconds: number): Promise<void>;
  get(phone: string): Promise<string | null>;
  delete(phone: string): Promise<void>;
  incrementRateLimit(phone: string, ttlSeconds: number): Promise<number>;
  getRateLimit(phone: string): Promise<number>;
}

export const OTP_STORAGE = Symbol('OTP_STORAGE');
