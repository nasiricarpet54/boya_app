import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { LoyaltyPoint } from '../src/modules/referral/entities/loyalty-point.entity';
import { LoyaltyPointService } from '../src/modules/referral/services/loyalty-point.service';

interface FindOptions {
  where?: Record<string, unknown>;
  order?: { createdAt?: 'ASC' | 'DESC' };
  take?: number;
  select?: { sourceId?: boolean };
}

interface FindOperatorLike {
  type: string;
  value?: unknown;
}

function isFindOperator(value: unknown): value is FindOperatorLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as { type: unknown }).type === 'string'
  );
}

/** Only the three operators the service actually uses are supported. */
function matches(actual: unknown, expected: unknown): boolean {
  if (isFindOperator(expected)) {
    if (expected.type === 'isNull') return actual === null || actual === undefined;
    if (expected.type === 'not') return !matches(actual, expected.value);
    if (expected.type === 'lessThanOrEqual') {
      return (
        actual instanceof Date &&
        expected.value instanceof Date &&
        actual.getTime() <= expected.value.getTime()
      );
    }
    throw new Error(`unsupported find operator: ${expected.type}`);
  }
  return actual === expected;
}


class QueryBuilderLike {
  private userId = '';
  private insertStaged = false;

  constructor(private readonly repo: MemoryPoints) {}

  select(..._args: unknown[]): this {
    return this;
  }

  where(_sql: string, params?: { userId?: string }): this {
    this.userId = params?.userId ?? '';
    return this;
  }

  async getRawOne<T>(): Promise<T> {
    return { balance: String(this.repo.balanceFor(this.userId)) } as T;
  }

  insert(): this {
    return this;
  }

  into(..._args: unknown[]): this {
    return this;
  }

  values(rows: Partial<LoyaltyPoint>[]): this {
    this.repo.stageInsert(rows);
    this.insertStaged = true;
    return this;
  }

  orIgnore(): this {
    return this;
  }

  async execute(): Promise<{ affected: number }> {
    if (!this.insertStaged) throw new Error('execute() called without values()');
    const before = this.repo.rows.length;
    await this.repo.flushInsert();
    this.insertStaged = false;
    return { affected: this.repo.rows.length - before };
  }
}

class MemoryPoints {
  rows: LoyaltyPoint[] = [];
  private sequence = 0;
  private pendingInsert: Partial<LoyaltyPoint>[] | null = null;

  create(input: Partial<LoyaltyPoint>): LoyaltyPoint {
    return { ...input } as LoyaltyPoint;
  }

  async save(row: LoyaltyPoint): Promise<LoyaltyPoint> {
    const saved: LoyaltyPoint = {
      ...row,
      id: row.id ?? `lp-${++this.sequence}`,
      createdAt: row.createdAt ?? new Date(),
    };
    const existing = this.rows.findIndex((candidate) => candidate.id === saved.id);
    if (existing >= 0) this.rows[existing] = saved;
    else this.rows.push(saved);
    return saved;
  }

  async find(options: FindOptions = {}): Promise<LoyaltyPoint[]> {
    const entries = Object.entries(options.where ?? {});
    let matched = this.rows.filter((row) =>
      entries.every(([key, expected]) =>
        matches((row as unknown as Record<string, unknown>)[key], expected),
      ),
    );
    if (options.order?.createdAt === 'DESC') {
      matched = [...matched].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    if (options.take !== undefined) matched = matched.slice(0, options.take);
    return matched;
  }

  createQueryBuilder(): QueryBuilderLike {
    return new QueryBuilderLike(this);
  }

  balanceFor(userId: string): number {
    let sum = 0;
    for (const row of this.rows) {
      if (row.userId !== userId) continue;
      if (row.type === 'earned') {
        // An earned row counts only while its expiry is still in the future.
        if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) continue;
        sum += row.points;
      } else if (row.type === 'spent') {
        // 'expired' rows are audit bookkeeping: they do not subtract.
        sum -= row.points;
      }
    }
    return sum;
  }

  stageInsert(rows: Partial<LoyaltyPoint>[]): void {
    this.pendingInsert = rows;
  }

  /** Mirrors `uq_loyalty_points_expiry_once`: (source_id, type) is unique. */
  async flushInsert(): Promise<void> {
    for (const row of this.pendingInsert ?? []) {
      if (row.type === 'expired' && row.sourceId) {
        const duplicate = this.rows.some(
          (existing) => existing.type === 'expired' && existing.sourceId === row.sourceId,
        );
        if (duplicate) continue;
      }
      await this.save(row as LoyaltyPoint);
    }
    this.pendingInsert = null;
  }
}

const USER = '11111111-1111-1111-1111-111111111111';
const OTHER_USER = '22222222-2222-2222-2222-222222222222';

function makeService(): { service: LoyaltyPointService; repo: MemoryPoints } {
  const repo = new MemoryPoints();
  return { service: new LoyaltyPointService(repo as never), repo };
}

describe('LoyaltyPointService', () => {
  test('award stores an earned row with no sourceId and a future expiry', async () => {
    const { service } = makeService();
    const row = await service.award({ userId: USER, points: 100, source: 'referral', description: 'پاداش' });

    assert.equal(row.type, 'earned');
    assert.equal(row.source, 'referral');
    assert.equal(row.points, 100);
    assert.equal(row.sourceId, null);
    assert.ok(row.expiresAt !== null && row.expiresAt.getTime() > Date.now() + 300 * 86_400_000);
  });

  test('award rejects a non-positive amount', async () => {
    const { service } = makeService();
    await assert.rejects(() => service.award({ userId: USER, points: 0, source: 'manual' }), /بیشتر از صفر/);
    await assert.rejects(() => service.award({ userId: USER, points: -5, source: 'manual' }), /بیشتر از صفر/);
  });

  test('balance is earned minus spent and stays per user', async () => {
    const { service } = makeService();
    await service.award({ userId: USER, points: 500, source: 'referral' });
    await service.award({ userId: OTHER_USER, points: 900, source: 'birthday' });
    await service.redeem(USER, 200, 'استفاده در رزرو');

    assert.equal(await service.getBalance(USER), 300);
    assert.equal(await service.getBalance(OTHER_USER), 900);
    assert.equal(await service.getBalance('33333333-3333-3333-3333-333333333333'), 0);
  });

  test('redeem rejects when the balance is too low', async () => {
    const { service } = makeService();
    await service.award({ userId: USER, points: 50, source: 'review' });

    await assert.rejects(() => service.redeem(USER, 51, 'استفاده در رزرو'), /موجودی امتیاز/);
    assert.equal(await service.getBalance(USER), 50);
  });

  test('redeem writes a spent row with no expiry', async () => {
    const { service } = makeService();
    await service.award({ userId: USER, points: 100, source: 'booking' });
    const spent = await service.redeem(USER, 100, 'تخفیف رزرو');

    assert.equal(spent.type, 'spent');
    assert.equal(spent.source, 'redemption');
    assert.equal(spent.sourceId, null);
    assert.equal(spent.expiresAt, null);
    assert.equal(await service.getBalance(USER), 0);
  });

  test('expireOldPoints cancels each expired grant exactly once', async () => {
    const { service, repo } = makeService();
    const expiredGrant = await repo.save(
      repo.create({
        userId: USER,
        points: 20,
        type: 'earned',
        source: 'booking',
        sourceId: null,
        description: null,
        expiresAt: new Date(Date.now() - 1_000),
      }),
    );
    await service.award({ userId: USER, points: 50, source: 'booking' });

    // The lapsed grant no longer counts, so only the live one is in the balance.
    assert.equal(await service.getBalance(USER), 50);

    assert.equal(await service.expireOldPoints(), 1);
    assert.equal(await service.expireOldPoints(), 0);

    const cancelling = repo.rows.filter((row) => row.type === 'expired');
    assert.equal(cancelling.length, 1);
    assert.equal(cancelling[0].sourceId, expiredGrant.id);
    assert.equal(cancelling[0].points, 20);
    assert.equal(await service.getBalance(USER), 50);
  });

  test('getHistory returns the newest entries first and honours the limit', async () => {
    const { service, repo } = makeService();
    const seed = (points: number, userId: string, createdAt: string): Partial<LoyaltyPoint> => ({
      userId,
      points,
      type: 'earned',
      source: 'booking',
      sourceId: null,
      description: null,
      expiresAt: null,
      createdAt: new Date(createdAt),
    });
    await repo.save(repo.create(seed(10, USER, '2026-01-01T00:00:00Z')));
    await repo.save(repo.create(seed(20, USER, '2026-02-01T00:00:00Z')));
    await repo.save(repo.create(seed(30, OTHER_USER, '2026-03-01T00:00:00Z')));

    const newestOnly = await service.getHistory(USER, 1);
    assert.equal(newestOnly.length, 1);
    assert.equal(newestOnly[0].points, 20);
    assert.equal((await service.getHistory(USER)).length, 2);
  });
});

