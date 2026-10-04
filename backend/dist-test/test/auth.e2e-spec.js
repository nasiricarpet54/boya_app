"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const phone_util_1 = require("../src/modules/auth/utils/phone.util");
(0, node_test_1.describe)('Phone number validation', () => {
    (0, node_test_1.test)('accepts Persian phone number', () => {
        const normalized = (0, phone_util_1.normalizePhone)('۰۹۱۲۱۲۳۴۵۶۷');
        strict_1.default.equal(normalized, '09121234567');
        strict_1.default.equal((0, phone_util_1.validatePhone)(normalized), true);
    });
    (0, node_test_1.test)('rejects short phone 12345', () => {
        strict_1.default.equal((0, phone_util_1.validatePhone)((0, phone_util_1.normalizePhone)('12345')), false);
    });
    (0, node_test_1.test)('rejects Persian short phone', () => {
        strict_1.default.equal((0, phone_util_1.validatePhone)((0, phone_util_1.normalizePhone)('۱۲۳۴۵')), false);
    });
    (0, node_test_1.test)('accepts phone with +98 prefix', () => {
        const normalized = (0, phone_util_1.normalizePhone)('+989121234567');
        strict_1.default.equal(normalized, '09121234567');
        strict_1.default.equal((0, phone_util_1.validatePhone)(normalized), true);
    });
});
