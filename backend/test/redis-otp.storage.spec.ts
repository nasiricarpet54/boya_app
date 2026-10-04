import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import Redis from 'ioredis';

import { RedisOtpStorage } from '../src/modules/auth/storage/redis-otp.storage';

const redis = new Redis(process.env.REDIS_TEST_URL ?? 'redis://127.0.0.1:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  connectTimeout: 500,
});

async function reachable(): Promise<boolean> {
  try {
    await redis.connect();
    await redis.ping();
    return true;
  } catch {
    redis.disconnect();
    return false;
  }
}

describe('RedisOtpStorage', async () => {
  const live = await reachable();
  if (!live) {
    test('Redis is not reachable', { skip: true }, () => undefined);
    return;
  }

  const storage = new RedisOtpStorage(redis);
  after(async () => {
    await redis.flushdb();
    await redis.quit();
  });

  test('stores and deletes a code', async () => {
    await storage.set('09121234567', '123456', 60);
    assert.equal(await storage.get('09121234567'), '123456');
    await storage.delete('09121234567');
    assert.equal(await storage.get('09121234567'), null);
  });

  test('keeps the first rate-limit TTL', async () => {
    const phone = '09128888888';
    assert.equal(await storage.incrementRateLimit(phone, 60), 1);
    const first = await redis.ttl(`boya:otp:rate:${phone}`);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal(await storage.incrementRateLimit(phone, 60), 2);
    const second = await redis.ttl(`boya:otp:rate:${phone}`);
    assert.ok(second < first);
  });
});
