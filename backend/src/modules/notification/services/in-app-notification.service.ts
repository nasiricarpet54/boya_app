import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { Notification, NotificationType } from '../entities/notification.entity';

export interface CreateNotificationInput {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface NotificationPage {
  data: Notification[];
  total: number;
  page: number;
  totalPages: number;
  unreadCount: number;
}

@Injectable()
export class InAppNotificationService {
  constructor(@InjectRepository(Notification) private readonly notifications: Repository<Notification>) {}

  create(input: CreateNotificationInput): Promise<Notification> {
    return this.notifications.save(
      this.notifications.create({
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ?? {},
        isRead: false,
      }),
    );
  }

  async list(tenantId: string, userId: string, page = 1, limit = 20): Promise<NotificationPage> {
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

  unreadCount(tenantId: string, userId: string): Promise<number> {
    return this.notifications.count({ where: { tenantId, userId, isRead: false } });
  }

  async markRead(tenantId: string, userId: string, id: string): Promise<void> {
    const result = await this.notifications.update(
      { id, tenantId, userId },
      { isRead: true, readAt: new Date() },
    );
    if (!result.affected) throw new NotFoundException('اعلان مورد نظر یافت نشد');
  }

  async markAllRead(tenantId: string, userId: string): Promise<number> {
    const result = await this.notifications.update(
      { tenantId, userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return result.affected ?? 0;
  }

  /**
   * User-scoped reads for the app. A customer belongs to no single tenant, so
   * these span every tenant they have been booked into; the tenant-scoped
   * variants above stay for internal listeners.
   */
  async listForUser(userId: string, page = 1, limit = 20): Promise<NotificationPage> {
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

  unreadCountForUser(userId: string): Promise<number> {
    return this.notifications.count({ where: { userId, isRead: false } });
  }

  markAllReadForUser(userId: string): Promise<number> {
    return this.notifications
      .update({ userId, isRead: false }, { isRead: true, readAt: new Date() })
      .then((result) => result.affected ?? 0);
  }

  async markReadForUser(userId: string, id: string): Promise<void> {
    const result = await this.notifications.update({ id, userId }, { isRead: true, readAt: new Date() });
    if (!result.affected) throw new NotFoundException('اعلان مورد نظر یافت نشد');
  }

  async pruneOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const result = await this.notifications.delete({ createdAt: LessThan(cutoff) });
    return result.affected ?? 0;
  }
}
