"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const referral_code_service_1 = require("../src/modules/referral/services/referral-code.service");
const CODE_PATTERN = /^BOYA[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
(0, node_test_1.describe)('ReferralCodeService', () => {
    const service = new referral_code_service_1.ReferralCodeService();
    (0, node_test_1.test)('generates codes with the BOYA prefix and a 6 character suffix', () => {
        for (let i = 0; i < 100; i++) {
            strict_1.default.match(service.generate(), CODE_PATTERN);
        }
    });
    (0, node_test_1.test)('normalize uppercases the input', () => {
        strict_1.default.equal(service.normalize('boya7k3m9p'), 'BOYA7K3M9P');
    });
    (0, node_test_1.test)('normalize trims surrounding whitespace', () => {
        strict_1.default.equal(service.normalize('  BOYA7K3M9P  '), 'BOYA7K3M9P');
    });
    (0, node_test_1.test)('normalize rejects a wrong prefix', () => {
        strict_1.default.equal(service.normalize('XXXX7K3M9P'), null);
    });
    (0, node_test_1.test)('normalize rejects ambiguous characters', () => {
        strict_1.default.equal(service.normalize('BOYA0K3M9P'), null);
        strict_1.default.equal(service.normalize('BOYA1K3M9P'), null);
        strict_1.default.equal(service.normalize('BOYAOK3M9P'), null);
        strict_1.default.equal(service.normalize('BOYALK3M9P'), null);
    });
    (0, node_test_1.test)('normalize rejects the wrong length', () => {
        strict_1.default.equal(service.normalize('BOYA7K3M9'), null);
        strict_1.default.equal(service.normalize('BOYA7K3M9PQ'), null);
    });
    (0, node_test_1.test)('normalize rejects empty input', () => {
        strict_1.default.equal(service.normalize(''), null);
    });
    (0, node_test_1.test)('every generated code round-trips through normalize', () => {
        for (let i = 0; i < 50; i++) {
            const code = service.generate();
            strict_1.default.equal(service.normalize(code), code);
        }
    });
});
