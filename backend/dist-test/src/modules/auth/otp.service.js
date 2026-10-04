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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpService = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sms_nestjs_1 = require("@mirad-work/sms-nestjs");
const ioredis_1 = __importDefault(require("ioredis"));
const persian_number_util_1 = require("../../utils/persian-number.util");
const persian_errors_1 = require("../../common/persian-errors");
const OTP_TTL_SECONDS = 120;
const RATE_WINDOW_SECONDS = 600;
const MAX_SENDS_PER_WINDOW = 3;
const MAX_VERIFY_ATTEMPTS = 5;
let OtpService = class OtpService {
    redis;
    smsService;
    config;
    constructor(redis, smsService, config) {
        this.redis = redis;
        this.smsService = smsService;
        this.config = config;
    }
    async sendOtp(phoneNumber) {
        const phone = this.normalizePersianPhone(phoneNumber);
        const attempts = await this.redis.incr(this.rateKey(phone));
        if (attempts === 1) {
            await this.redis.expire(this.rateKey(phone), RATE_WINDOW_SECONDS);
        }
        if (attempts > MAX_SENDS_PER_WINDOW) {
            throw new common_1.HttpException(persian_errors_1.PERSIAN_ERRORS.OTP_RATE_LIMIT, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const code = (0, crypto_1.randomInt)(100000, 1000000).toString();
        await this.redis.set(this.otpKey(phone), this.hash(phone, code), 'EX', OTP_TTL_SECONDS);
        await this.redis.del(this.attemptKey(phone));
        const apiKey = process.env.KAVENEGAR_API_KEY;
        const nodeEnv = process.env.NODE_ENV ?? 'development';
        const isDevMode = !apiKey || nodeEnv !== 'production';
        if (isDevMode) {
            console.log(`\n===== [DEV MODE] OTP for ${phone}: ${code} =====\n`);
            return;
        }
        const sent = await this.smsService.verify({
            to: phone,
            template: this.config.get('KAVENEGAR_OTP_TEMPLATE', 'boya-otp'),
            tokens: { code },
        });
        if (!sent.success) {
            await this.redis.del(this.otpKey(phone));
            throw new common_1.HttpException(persian_errors_1.PERSIAN_ERRORS.SMS_FAILED, common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    async verifyOtp(phoneNumber, code) {
        const phone = this.normalizePersianPhone(phoneNumber);
        const stored = await this.redis.get(this.otpKey(phone));
        if (!stored) {
            throw new common_1.UnauthorizedException(persian_errors_1.PERSIAN_ERRORS.OTP_EXPIRED);
        }
        const tries = await this.redis.incr(this.attemptKey(phone));
        if (tries === 1) {
            await this.redis.expire(this.attemptKey(phone), OTP_TTL_SECONDS);
        }
        if (tries > MAX_VERIFY_ATTEMPTS) {
            await this.redis.del(this.otpKey(phone));
            throw new common_1.HttpException(persian_errors_1.PERSIAN_ERRORS.OTP_TOO_MANY_ATTEMPTS, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const latinCode = (0, persian_number_util_1.toLatinDigits)(code);
        if (!this.sameHash(stored, this.hash(phone, latinCode))) {
            throw new common_1.UnauthorizedException(persian_errors_1.PERSIAN_ERRORS.OTP_INVALID);
        }
        await this.redis.del(this.otpKey(phone), this.attemptKey(phone));
    }
    normalizePersianPhone(phone) {
        let normalized = (0, persian_number_util_1.toLatinDigits)(phone).split(' ').join('').split('-').join('');
        if (normalized.startsWith('+98')) {
            normalized = `0${normalized.slice(3)}`;
        }
        else if (normalized.startsWith('98')) {
            normalized = `0${normalized.slice(2)}`;
        }
        if (!/^09[0-9]{9}$/.test(normalized)) {
            throw new common_1.HttpException(persian_errors_1.PERSIAN_ERRORS.INVALID_PHONE, common_1.HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }
    hash(phone, code) {
        return (0, crypto_1.createHash)('sha256')
            .update(`${this.config.getOrThrow('OTP_PEPPER')}:${phone}:${code}`)
            .digest('hex');
    }
    sameHash(left, right) {
        const a = Buffer.from(left);
        const b = Buffer.from(right);
        return a.length === b.length && (0, crypto_1.timingSafeEqual)(a, b);
    }
    otpKey(phone) {
        return `otp:${phone}`;
    }
    rateKey(phone) {
        return `otp:rate:${phone}`;
    }
    attemptKey(phone) {
        return `otp:tries:${phone}`;
    }
};
exports.OtpService = OtpService;
exports.OtpService = OtpService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('OTP_REDIS')),
    __metadata("design:paramtypes", [ioredis_1.default,
        sms_nestjs_1.SmsService,
        config_1.ConfigService])
], OtpService);
