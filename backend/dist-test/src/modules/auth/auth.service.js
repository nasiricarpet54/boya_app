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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("typeorm");
const otp_service_1 = require("./otp.service");
let AuthService = class AuthService {
    otpService;
    jwtService;
    dataSource;
    constructor(otpService, jwtService, dataSource) {
        this.otpService = otpService;
        this.jwtService = jwtService;
        this.dataSource = dataSource;
    }
    async verifyOtpAndIssueToken(phoneNumber, code) {
        await this.otpService.verifyOtp(phoneNumber, code);
        const normalized = this.normalizePhone(phoneNumber);
        const rows = await this.dataSource.query(`SELECT id, phone, full_name, role, is_new, tenant_id FROM find_or_create_customer_by_phone($1)`, [normalized]);
        const row = rows[0];
        if (!row) {
            throw new Error('find_or_create_customer_by_phone returned no rows');
        }
        const tenantId = row.tenant_id ?? null;
        const token = await this.jwtService.signAsync({
            sub: row.id,
            phone: row.phone,
            role: row.role,
            tenantId,
        });
        return {
            token,
            user: {
                id: row.id,
                phoneNumber: row.phone,
                fullName: row.full_name,
                role: row.role,
                isNewUser: row.is_new,
                tenantId,
            },
        };
    }
    normalizePhone(input) {
        const map = {
            '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
            '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
            '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
            '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
        };
        let p = input.replace(/[۰-۹٠-٩]/g, (d) => map[d] ?? d);
        p = p.replace(/\s|-|\(|\)/g, '');
        if (p.startsWith('+98'))
            p = '0' + p.slice(3);
        if (p.startsWith('98') && p.length === 12)
            p = '0' + p.slice(2);
        return p;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [otp_service_1.OtpService,
        jwt_1.JwtService,
        typeorm_1.DataSource])
], AuthService);
