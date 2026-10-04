"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var RedisOtpStorage_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisOtpStorage = exports.OtpStorageError = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
class OtpStorageError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = 'OtpStorageError';
    }
}
exports.OtpStorageError = OtpStorageError;
const PREFIX = 'boya:';
const RATE_SCRIPT = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`;
let RedisOtpStorage = RedisOtpStorage_1 = class RedisOtpStorage {
    redis;
    logger = new common_1.Logger(RedisOtpStorage_1.name);
    constructor(redis) {
        this.redis = redis;
    }
    async set(phone, code, ttlSeconds) {
        await this.run('store OTP', () => this.redis.set(`${PREFIX}otp:${phone}`, code, 'EX', ttlSeconds));
    }
    async get(phone) {
        return this.run('read OTP', () => this.redis.get(`${PREFIX}otp:${phone}`));
    }
    async delete(phone) {
        await this.run('delete OTP', () => this.redis.del(`${PREFIX}otp:${phone}`));
    }
    async incrementRateLimit(phone, ttlSeconds) {
        const count = await this.run('update rate limit', () => this.redis.eval(RATE_SCRIPT, 1, `${PREFIX}otp:rate:${phone}`, String(ttlSeconds)));
        return Number(count);
    }
    async getRateLimit(phone) {
        const value = await this.run('read rate limit', () => this.redis.get(`${PREFIX}otp:rate:${phone}`));
        return value ? Number.parseInt(value, 10) : 0;
    }
    async run(action, work) {
        try {
            return await work();
        }
        catch (cause) {
            this.logger.error(`Failed to ${action}`);
            throw new OtpStorageError(`Failed to ${action}`, { cause });
        }
    }
};
exports.RedisOtpStorage = RedisOtpStorage;
exports.RedisOtpStorage = RedisOtpStorage = RedisOtpStorage_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ioredis_1.default])
], RedisOtpStorage);
