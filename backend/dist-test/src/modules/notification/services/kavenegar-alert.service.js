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
var KavenegarAlertService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KavenegarAlertService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sms_nestjs_1 = require("@mirad-work/sms-nestjs");
let KavenegarAlertService = KavenegarAlertService_1 = class KavenegarAlertService {
    sms;
    config;
    logger = new common_1.Logger(KavenegarAlertService_1.name);
    constructor(sms, config) {
        this.sms = sms;
        this.config = config;
    }
    async sendBookingAlert(phone, token) {
        const template = this.config.get('KAVENEGAR_BOOKING_TEMPLATE');
        if (!template) {
            this.logger.warn('KAVENEGAR_BOOKING_TEMPLATE is unset; SMS alert skipped');
            return false;
        }
        const sent = await this.sms.verify({ to: phone, template, tokens: { token } });
        if (!sent.success)
            this.logger.warn('Kavenegar booking alert was not accepted');
        return sent.success;
    }
};
exports.KavenegarAlertService = KavenegarAlertService;
exports.KavenegarAlertService = KavenegarAlertService = KavenegarAlertService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [sms_nestjs_1.SmsService,
        config_1.ConfigService])
], KavenegarAlertService);
