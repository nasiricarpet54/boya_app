"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralCodeService = void 0;
const common_1 = require("@nestjs/common");
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_PREFIX = 'BOYA';
const CODE_LENGTH = 6;
let ReferralCodeService = class ReferralCodeService {
    generate() {
        let suffix = '';
        for (let i = 0; i < CODE_LENGTH; i++) {
            suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
        }
        return `${CODE_PREFIX}${suffix}`;
    }
    normalize(input) {
        if (!input)
            return null;
        const upper = input.trim().toUpperCase();
        const pattern = new RegExp(`^${CODE_PREFIX}[${ALPHABET}]{${CODE_LENGTH}}$`);
        return pattern.test(upper) ? upper : null;
    }
};
exports.ReferralCodeService = ReferralCodeService;
exports.ReferralCodeService = ReferralCodeService = __decorate([
    (0, common_1.Injectable)()
], ReferralCodeService);
