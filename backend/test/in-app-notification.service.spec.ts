import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { InAppNotificationService } from '../src/modules/notification/services/in-app-notification.service';
import { Notification } from '../src/modules/notification/entities/notification.entity';

class MemoryNotifications {
  rows: Notification[] = [];

  create(input: Partial<Notification>): Notification {
    return input as Notification;
  }

  async save(row: Notification): Promise<Notification> {
    const saved = { ...row, id: row.id ?? `n-${this.rows.length + 1}`, createdAt: row.createdAt ?? new Date() };
    this.rows.push(saved);
    return saved;
  }

  async findAndCount(options: { where: { tenantId: string; userId: string }; skip: number; take: number }): Promise<[Notification[], number]> {
    const matched = this.rows.filter((row) => row.tenantId === options.where.tenantId && row.userId === options.where.userId);
    return [matched.slice(options.skip, options.skip + options.take), matched.length];
  }

  async count(options: { where: { tenantId: string; userId: string; isRead?: boolean } }): Promise<number> {
    return this.rows.filter((row) => {
      if (row.tenantId !== options.where.tenantId || row.userId !== options.where.userId) return false;
      return options.where.isRead === undefined || row.isRead === options.where.isRead;
    }).length;
  }
}

describe('InAppNotificationService', () => {
  test('stores an unread notification with empty data', async () => {
    const repo = new MemoryNotifications();
    const service = new InAppNotificationService(repo as never);
    const saved = await service.create({
      tenantId: 'tenant-1',
      userId: 'user-1',
      type: 'booking_created',
      title: 'ثبت شد',
      body: 'نوبت ثبت شد',
    });
    assert.deepEqual(saved.data, {});
    assert.equal(saved.isRead, false);
    const page = await service.list('tenant-1', 'user-1');
    assert.equal(page.total, 1);
    assert.equal(page.unreadCount, 1);
  });
});
