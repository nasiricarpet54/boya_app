"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.neshanConfig = exports.kavenegarConfig = exports.stripeConfig = void 0;
const config_1 = require("@nestjs/config");
exports.stripeConfig = (0, config_1.registerAs)('stripe', () => ({
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    connectClientId: process.env.STRIPE_CONNECT_CLIENT_ID ?? '',
}));
exports.kavenegarConfig = (0, config_1.registerAs)('kavenegar', () => ({
    apiKey: process.env.KAVENEGAR_API_KEY ?? '',
    sender: process.env.KAVENEGAR_SENDER ?? '',
}));
exports.neshanConfig = (0, config_1.registerAs)('neshan', () => ({
    apiKey: process.env.NESHAN_API_KEY ?? '',
}));
