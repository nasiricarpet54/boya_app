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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryOtpService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const sms_sender_interface_1 = require("./interfaces/sms-sender.interface");
const otp_storage_interface_1 = require("./storage/otp-storage.interface");
const OTP_TTL_SECONDS = 120;
const RATE_WINDOW_SECONDS = 600;
const MAX_SENDS = 3;
let MemoryOtpService = class MemoryOtpService {
    storage;
    sms;
    constructor(storage, sms) {
        this.storage = storage;
        this.sms = sms;
    }
    async sendOtp(phone) {
        const attempts = await this.storage.incrementRateLimit(phone, RATE_WINDOW_SECONDS);
        if (attempts > MAX_SENDS) {
            throw new common_1.HttpException('تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً ۱۰ دقیقه دیگر تلاش کنید.', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const code = (0, crypto_1.randomInt)(100000, 1000000).toString();
        await this.storage.set(phone, code, OTP_TTL_SECONDS);
        try {
            await this.sms.sendOtp(phone, code);
        }
        catch {
            throw new common_1.BadRequestException('ارسال پیامک با خطا مواجه شد. لطفاً دوباره تلاش کنید.');
        }
        return { success: true, message: 'کد تایید ارسال شد' };
    }
    async verifyOtp(phone, code) {
        if (!/^[0-9]{6}$/.test(code)) {
            throw new common_1.BadRequestException('کد وارد شده باید ۶ رقم باشد');
        }
        const stored = await this.storage.get(phone);
        if (!stored) {
            throw new common_1.BadRequestException('کد تایید منقضی شده است. لطفاً کد جدید دریافت کنید');
        }
        if (stored !== code) {
            throw new common_1.BadRequestException('کد وارد شده صحیح نیست');
        }
        await this.storage.delete(phone);
        return { valid: true };
    }
};
exports.MemoryOtpService = MemoryOtpService;
exports.MemoryOtpService = MemoryOtpService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(otp_storage_interface_1.OTP_STORAGE)),
    __param(1, (0, common_1.Inject)(sms_sender_interface_1.SMS_SENDER)),
    __metadata("design:paramtypes", [Object, Object])
], MemoryOtpService);
