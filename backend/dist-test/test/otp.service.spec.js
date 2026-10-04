"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const memory_otp_service_1 = require("../src/modules/auth/memory-otp.service");
const in_memory_otp_storage_1 = require("../src/modules/auth/storage/in-memory-otp.storage");
class FakeSms {
    sent = [];
    async sendOtp(phone, code) {
        this.sent.push({ phone, code });
    }
}
class FailingSms {
    async sendOtp() {
        throw new Error('provider down');
    }
}
(0, node_test_1.describe)('MemoryOtpService', () => {
    let storage;
    let sms;
    let service;
    (0, node_test_1.beforeEach)(() => {
        storage = new in_memory_otp_storage_1.InMemoryOtpStorage();
        sms = new FakeSms();
        service = new memory_otp_service_1.MemoryOtpService(storage, sms);
    });
    (0, node_test_1.test)('sends a six-digit code and a Persian message', async () => {
        const result = await service.sendOtp('09121234567');
        strict_1.default.equal(result.success, true);
        strict_1.default.equal(result.message.includes('ارسال شد'), true);
        strict_1.default.equal(sms.sent.length, 1);
        strict_1.default.match(sms.sent[0].code, /^[0-9]{6}$/);
    });
    (0, node_test_1.test)('verifies the stored code once', async () => {
        await service.sendOtp('09121234567');
        const code = sms.sent[0].code;
        strict_1.default.equal((await service.verifyOtp('09121234567', code)).valid, true);
        await strict_1.default.rejects(() => service.verifyOtp('09121234567', code), /منقضی شده/);
    });
    (0, node_test_1.test)('rejects a wrong code', async () => {
        await service.sendOtp('09121234567');
        await strict_1.default.rejects(() => service.verifyOtp('09121234567', '000000'), /صحیح نیست/);
    });
    (0, node_test_1.test)('limits a phone after three sends', async () => {
        await service.sendOtp('09121234567');
        await service.sendOtp('09121234567');
        await service.sendOtp('09121234567');
        await strict_1.default.rejects(() => service.sendOtp('09121234567'), /تعداد درخواست/);
        strict_1.default.equal((await service.sendOtp('09129876543')).success, true);
    });
    (0, node_test_1.test)('returns a Persian SMS failure', async () => {
        const failing = new memory_otp_service_1.MemoryOtpService(storage, new FailingSms());
        await strict_1.default.rejects(() => failing.sendOtp('09121234567'), /پیامک/);
    });
    (0, node_test_1.test)('rejects a short verification code', async () => {
        await strict_1.default.rejects(() => service.verifyOtp('09121234567', '123'), /۶ رقم/);
    });
});
