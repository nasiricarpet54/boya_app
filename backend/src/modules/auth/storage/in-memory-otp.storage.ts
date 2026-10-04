import { Injectable } from '@nestjs/common';

import { OtpStorage } from './otp-storage.interface';

interface Entry {
  value: string | number;
  expiresAt: number;
}

/** Single-process storage. Not shared across app instances. */
@Injectable()
export class InMemoryOtpStorage implements OtpStorage {
  private readonly store = new Map<string, Entry>();

  async set(phone: string, code: string, ttlSeconds: number): Promise<void> {
    this.cleanup();
    this.store.set(`otp:${phone}`, { value: code, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async get(phone: string): Promise<string | null> {
    const entry = this.store.get(`otp:${phone}`);
    if (!entry || entry.expiresAt < Date.now()) {
      this.store.delete(`otp:${phone}`);
      return null;
    }
    return String(entry.value);
  }

  async delete(phone: string): Promise<void> {
    this.store.delete(`otp:${phone}`);
  }

  async incrementRateLimit(phone: string, ttlSeconds: number): Promise<number> {
    this.cleanup();
    const key = `otp:rate:${phone}`;
    const existing = this.store.get(key);
    if (!existing || existing.expiresAt < Date.now()) {
      this.store.set(key, { value: 1, expiresAt: Date.now() + ttlSeconds * 1000 });
      return 1;
    }
    const count = Number(existing.value) + 1;
    this.store.set(key, { value: count, expiresAt: existing.expiresAt });
    return count;
  }

  async getRateLimit(phone: string): Promise<number> {
    const entry = this.store.get(`otp:rate:${phone}`);
    if (!entry || entry.expiresAt < Date.now()) return 0;
    return Number(entry.value);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt < now) this.store.delete(key);
    }
  }
}
