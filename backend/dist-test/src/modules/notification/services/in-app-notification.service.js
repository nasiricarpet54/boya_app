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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InAppNotificationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notification_entity_1 = require("../entities/notification.entity");
let InAppNotificationService = class InAppNotificationService {
    notifications;
    constructor(notifications) {
        this.notifications = notifications;
    }
    create(input) {
        return this.notifications.save(this.notifications.create({
            tenantId: input.tenantId,
            userId: input.userId,
            type: input.type,
            title: input.title,
            body: input.body,
            data: input.data ?? {},
            isRead: false,
        }));
    }
    async list(tenantId, userId, page = 1, limit = 20) {
        const safeLimit = Math.min(Math.max(limit, 1), 50);
        const safePage = Math.max(page, 1);
        const where = { tenantId, userId };
        const [data, total] = await this.notifications.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip: (safePage - 1) * safeLimit,
            take: safeLimit,
        });
        const unreadCount = await this.notifications.count({ where: { ...where, isRead: false } });
        return { data, total, page: safePage, totalPages: Math.ceil(total / safeLimit), unreadCount };
    }
    unreadCount(tenantId, userId) {
        return this.notifications.count({ where: { tenantId, userId, isRead: false } });
    }
    async markRead(tenantId, userId, id) {
        const result = await this.notifications.update({ id, tenantId, userId }, { isRead: true, readAt: new Date() });
        if (!result.affected)
            throw new common_1.NotFoundException('اعلان مورد نظر یافت نشد');
    }
    async markAllRead(tenantId, userId) {
        const result = await this.notifications.update({ tenantId, userId, isRead: false }, { isRead: true, readAt: new Date() });
        return result.affected ?? 0;
    }
    async listForUser(userId, page = 1, limit = 20) {
        const safeLimit = Math.min(Math.max(limit, 1), 50);
        const safePage = Math.max(page, 1);
        const [data, total] = await this.notifications.findAndCount({
            where: { userId },
            order: { createdAt: 'DESC' },
            skip: (safePage - 1) * safeLimit,
            take: safeLimit,
        });
        const unreadCount = await this.notifications.count({ where: { userId, isRead: false } });
        return { data, total, page: safePage, totalPages: Math.ceil(total / safeLimit), unreadCount };
    }
    unreadCountForUser(userId) {
        return this.notifications.count({ where: { userId, isRead: false } });
    }
    markAllReadForUser(userId) {
        return this.notifications
            .update({ userId, isRead: false }, { isRead: true, readAt: new Date() })
            .then((result) => result.affected ?? 0);
    }
    async markReadForUser(userId, id) {
        const result = await this.notifications.update({ id, userId }, { isRead: true, readAt: new Date() });
        if (!result.affected)
            throw new common_1.NotFoundException('اعلان مورد نظر یافت نشد');
    }
    async pruneOlderThan(days) {
        const cutoff = new Date(Date.now() - days * 86_400_000);
        const result = await this.notifications.delete({ createdAt: (0, typeorm_2.LessThan)(cutoff) });
        return result.affected ?? 0;
    }
};
exports.InAppNotificationService = InAppNotificationService;
exports.InAppNotificationService = InAppNotificationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], InAppNotificationService);
