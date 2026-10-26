import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Keyv } from 'keyv';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private cache!: Keyv;
  private readonly REDIS_KEY_PREFIX = 'boya:';

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const KeyvRedis = await import('@keyv/redis').then(m => m.default);
    const redisUrl = `redis://${this.configService.get<string>('REDIS_HOST', 'localhost')}:${this.configService.get<number>('REDIS_PORT', 6380)}`;
    this.cache = new Keyv({
      store: new KeyvRedis(redisUrl),
    });
  }

  async onModuleDestroy() {
    await this.cache.clear();
  }

  async get(key: string): Promise<unknown> {
    return this.cache.get(`${this.REDIS_KEY_PREFIX}${key}`);
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    await this.cache.set(`${this.REDIS_KEY_PREFIX}${key}`, value, ttl);
  }

  async delete(key: string): Promise<void> {
    await this.cache.delete(`${this.REDIS_KEY_PREFIX}${key}`);
  }

  async invalidateAll(keys: string[]): Promise<void> {
    await Promise.all(keys.map(key => this.delete(key)));
  }

  async invalidateTenantCache(tenantId: string): Promise<void> {
    const keys = [
      `specialists:${tenantId}`,
      `services:${tenantId}`,
      `bookings:${tenantId}`,
      `salon:${tenantId}`,
    ];
    await this.invalidateAll(keys);
  }
}