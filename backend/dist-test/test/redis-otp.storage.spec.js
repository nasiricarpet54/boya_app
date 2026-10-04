"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const ioredis_1 = __importDefault(require("ioredis"));
const redis_otp_storage_1 = require("../src/modules/auth/storage/redis-otp.storage");
const redis = new ioredis_1.default(process.env.REDIS_TEST_URL ?? 'redis://127.0.0.1:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 500,
});
async function reachable() {
    try {
        await redis.connect();
        await redis.ping();
        return true;
    }
    catch {
        redis.disconnect();
        return false;
    }
}
(0, node_test_1.describe)('RedisOtpStorage', async () => {
    const live = await reachable();
    if (!live) {
        (0, node_test_1.test)('Redis is not reachable', { skip: true }, () => undefined);
        return;
    }
    const storage = new redis_otp_storage_1.RedisOtpStorage(redis);
    (0, node_test_1.after)(async () => {
        await redis.flushdb();
        await redis.quit();
    });
    (0, node_test_1.test)('stores and deletes a code', async () => {
        await storage.set('09121234567', '123456', 60);
        strict_1.default.equal(await storage.get('09121234567'), '123456');
        await storage.delete('09121234567');
        strict_1.default.equal(await storage.get('09121234567'), null);
    });
    (0, node_test_1.test)('keeps the first rate-limit TTL', async () => {
        const phone = '09128888888';
        strict_1.default.equal(await storage.incrementRateLimit(phone, 60), 1);
        const first = await redis.ttl(`boya:otp:rate:${phone}`);
        await new Promise((resolve) => setTimeout(resolve, 1100));
        strict_1.default.equal(await storage.incrementRateLimit(phone, 60), 2);
        const second = await redis.ttl(`boya:otp:rate:${phone}`);
        strict_1.default.ok(second < first);
    });
});
