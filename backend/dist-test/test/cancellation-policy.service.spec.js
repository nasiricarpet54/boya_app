"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const cancellation_policy_service_1 = require("../src/modules/booking/cancellation-policy.service");
(0, node_test_1.describe)('CancellationPolicyService', () => {
    const service = new cancellation_policy_service_1.CancellationPolicyService();
    const startsAt = new Date('2026-10-20T10:00:00Z');
    const before = (hours) => new Date(startsAt.getTime() - hours * 3_600_000);
    (0, node_test_1.test)('full refund at 24 hours', () => {
        const result = service.calculate({ totalPrice: 1_000_000, startsAt, now: before(24), reason: 'customer_request' });
        strict_1.default.equal(result.refundPercentage, 100);
        strict_1.default.equal(result.penaltyAmount, 0);
    });
    (0, node_test_1.test)('half refund at 12 hours', () => {
        const result = service.calculate({ totalPrice: 1_000_000, startsAt, now: before(12), reason: 'customer_request' });
        strict_1.default.equal(result.refundAmount, 500_000);
    });
    (0, node_test_1.test)('no refund inside 2 hours or on no-show', () => {
        strict_1.default.equal(service.calculate({ totalPrice: 1_000_000, startsAt, now: before(1), reason: 'customer_request' }).refundPercentage, 0);
        strict_1.default.equal(service.calculate({ totalPrice: 1_000_000, startsAt, now: before(0), reason: 'no_show' }).refundPercentage, 0);
    });
    (0, node_test_1.test)('specialist unavailability is always a full refund', () => {
        strict_1.default.equal(service.calculate({ totalPrice: 1_000_000, startsAt, now: before(1), reason: 'specialist_unavailable' }).refundPercentage, 100);
    });
});
