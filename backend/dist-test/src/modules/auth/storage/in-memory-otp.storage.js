"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryOtpStorage = void 0;
const common_1 = require("@nestjs/common");
let InMemoryOtpStorage = class InMemoryOtpStorage {
    store = new Map();
    async set(phone, code, ttlSeconds) {
        this.cleanup();
        this.store.set(`otp:${phone}`, { value: code, expiresAt: Date.now() + ttlSeconds * 1000 });
    }
    async get(phone) {
        const entry = this.store.get(`otp:${phone}`);
        if (!entry || entry.expiresAt < Date.now()) {
            this.store.delete(`otp:${phone}`);
            return null;
        }
        return String(entry.value);
    }
    async delete(phone) {
        this.store.delete(`otp:${phone}`);
    }
    async incrementRateLimit(phone, ttlSeconds) {
        this.cleanup();
        const key = `otp:rate:${phone}`;
        const existing = this.store.get(key);
        if (!existing || existing.expiresAt < Date.now()) {
            this.store.set(key, { value: 1, expiresAt: Date.now() + ttlSeconds * 1000 });
            return 1;
        }
        const count = Number(existing.value) + 1;
        this.store.set(key, { value: count, expiresAt: existing.expiresAt });
        return count;
    }
    async getRateLimit(phone) {
        const entry = this.store.get(`otp:rate:${phone}`);
        if (!entry || entry.expiresAt < Date.now())
            return 0;
        return Number(entry.value);
    }
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.store) {
            if (entry.expiresAt < now)
                this.store.delete(key);
        }
    }
};
exports.InMemoryOtpStorage = InMemoryOtpStorage;
exports.InMemoryOtpStorage = InMemoryOtpStorage = __decorate([
    (0, common_1.Injectable)()
], InMemoryOtpStorage);
