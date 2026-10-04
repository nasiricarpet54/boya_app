"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const availability_service_1 = require("../src/modules/booking/availability.service");
const hours = {
    sat: { start: '09:00', end: '21:00', active: true },
    fri: { start: '10:00', end: '18:00', active: false },
};
(0, node_test_1.describe)('AvailabilityService', () => {
    const service = new availability_service_1.AvailabilityService();
    (0, node_test_1.test)('Friday is closed unless marked active', () => {
        const slots = service.generateSlots({
            workingHours: hours,
            date: new Date(2026, 9, 16, 12),
            durationMinutes: 60,
        });
        strict_1.default.equal(slots.length, 0);
    });
    (0, node_test_1.test)('Saturday yields twelve hourly slots', () => {
        const slots = service.generateSlots({
            workingHours: hours,
            date: new Date(2026, 9, 17, 12),
            durationMinutes: 60,
            stepMinutes: 60,
        });
        strict_1.default.equal(slots.length, 12);
    });
    (0, node_test_1.test)('an overlapping busy range removes one slot', () => {
        const date = new Date(2026, 9, 17, 12);
        const candidates = service.generateSlots({
            workingHours: hours,
            date,
            durationMinutes: 60,
            stepMinutes: 60,
        });
        const available = service.filterAvailable(candidates, [
            { start: new Date(2026, 9, 17, 10), end: new Date(2026, 9, 17, 11) },
        ]);
        strict_1.default.equal(available.length, 11);
    });
    (0, node_test_1.test)('zero duration is rejected', () => {
        strict_1.default.throws(() => service.generateSlots({ workingHours: hours, date: new Date(2026, 9, 17), durationMinutes: 0 }), /مدت زمان/);
    });
});
