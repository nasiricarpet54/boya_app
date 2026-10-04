"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const in_app_notification_service_1 = require("../src/modules/notification/services/in-app-notification.service");
class MemoryNotifications {
    rows = [];
    create(input) {
        return input;
    }
    async save(row) {
        const saved = { ...row, id: row.id ?? `n-${this.rows.length + 1}`, createdAt: row.createdAt ?? new Date() };
        this.rows.push(saved);
        return saved;
    }
    async findAndCount(options) {
        const matched = this.rows.filter((row) => row.tenantId === options.where.tenantId && row.userId === options.where.userId);
        return [matched.slice(options.skip, options.skip + options.take), matched.length];
    }
    async count(options) {
        return this.rows.filter((row) => {
            if (row.tenantId !== options.where.tenantId || row.userId !== options.where.userId)
                return false;
            return options.where.isRead === undefined || row.isRead === options.where.isRead;
        }).length;
    }
}
(0, node_test_1.describe)('InAppNotificationService', () => {
    (0, node_test_1.test)('stores an unread notification with empty data', async () => {
        const repo = new MemoryNotifications();
        const service = new in_app_notification_service_1.InAppNotificationService(repo);
        const saved = await service.create({
            tenantId: 'tenant-1',
            userId: 'user-1',
            type: 'booking_created',
            title: 'ثبت شد',
            body: 'نوبت ثبت شد',
        });
        strict_1.default.deepEqual(saved.data, {});
        strict_1.default.equal(saved.isRead, false);
        const page = await service.list('tenant-1', 'user-1');
        strict_1.default.equal(page.total, 1);
        strict_1.default.equal(page.unreadCount, 1);
    });
});
