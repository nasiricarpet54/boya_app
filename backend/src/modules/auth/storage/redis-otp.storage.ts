import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

import { OtpStorage } from './otp-storage.interface';

export class OtpStorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'OtpStorageError';
  }
}

const PREFIX = 'boya:';
const RATE_SCRIPT = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`;

/** Redis adapter. The caller owns the connection. */
@Injectable()
export class RedisOtpStorage implements OtpStorage {
  private readonly logger = new Logger(RedisOtpStorage.name);

  constructor(private readonly redis: Redis) {}

  async set(phone: string, code: string, ttlSeconds: number): Promise<void> {
    await this.run('store OTP', () => this.redis.set(`${PREFIX}otp:${phone}`, code, 'EX', ttlSeconds));
  }

  async get(phone: string): Promise<string | null> {
    return this.run('read OTP', () => this.redis.get(`${PREFIX}otp:${phone}`));
  }

  async delete(phone: string): Promise<void> {
    await this.run('delete OTP', () => this.redis.del(`${PREFIX}otp:${phone}`));
  }

  async incrementRateLimit(phone: string, ttlSeconds: number): Promise<number> {
    const count = await this.run('update rate limit', () =>
      this.redis.eval(RATE_SCRIPT, 1, `${PREFIX}otp:rate:${phone}`, String(ttlSeconds)),
    );
    return Number(count);
  }

  async getRateLimit(phone: string): Promise<number> {
    const value = await this.run('read rate limit', () => this.redis.get(`${PREFIX}otp:rate:${phone}`));
    return value ? Number.parseInt(value, 10) : 0;
  }

  private async run<T>(action: string, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (cause) {
      this.logger.error(`Failed to ${action}`);
      throw new OtpStorageError(`Failed to ${action}`, { cause });
    }
  }
}
