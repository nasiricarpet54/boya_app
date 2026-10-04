"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const loyalty_point_service_1 = require("../src/modules/referral/services/loyalty-point.service");
function isFindOperator(value) {
    return (typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        typeof value.type === 'string');
}
function matches(actual, expected) {
    if (isFindOperator(expected)) {
        if (expected.type === 'isNull')
            return actual === null || actual === undefined;
        if (expected.type === 'not')
            return !matches(actual, expected.value);
        if (expected.type === 'lessThanOrEqual') {
            return (actual instanceof Date &&
                expected.value instanceof Date &&
                actual.getTime() <= expected.value.getTime());
        }
        throw new Error(`unsupported find operator: ${expected.type}`);
    }
    return actual === expected;
}
class QueryBuilderLike {
    repo;
    userId = '';
    insertStaged = false;
    constructor(repo) {
        this.repo = repo;
    }
    select(..._args) {
        return this;
    }
    where(_sql, params) {
        this.userId = params?.userId ?? '';
        return this;
    }
    async getRawOne() {
        return { balance: String(this.repo.balanceFor(this.userId)) };
    }
    insert() {
        return this;
    }
    into(..._args) {
        return this;
    }
    values(rows) {
        this.repo.stageInsert(rows);
        this.insertStaged = true;
        return this;
    }
    orIgnore() {
        return this;
    }
    async execute() {
        if (!this.insertStaged)
            throw new Error('execute() called without values()');
        const before = this.repo.rows.length;
        await this.repo.flushInsert();
        this.insertStaged = false;
        return { affected: this.repo.rows.length - before };
    }
}
class MemoryPoints {
    rows = [];
    sequence = 0;
    pendingInsert = null;
    create(input) {
        return { ...input };
    }
    async save(row) {
        const saved = {
            ...row,
            id: row.id ?? `lp-${++this.sequence}`,
            createdAt: row.createdAt ?? new Date(),
        };
        const existing = this.rows.findIndex((candidate) => candidate.id === saved.id);
        if (existing >= 0)
            this.rows[existing] = saved;
        else
            this.rows.push(saved);
        return saved;
    }
    async find(options = {}) {
        const entries = Object.entries(options.where ?? {});
        let matched = this.rows.filter((row) => entries.every(([key, expected]) => matches(row[key], expected)));
        if (options.order?.createdAt === 'DESC') {
            matched = [...matched].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (options.take !== undefined)
            matched = matched.slice(0, options.take);
        return matched;
    }
    createQueryBuilder() {
        return new QueryBuilderLike(this);
    }
    balanceFor(userId) {
        let sum = 0;
        for (const row of this.rows) {
            if (row.userId !== userId)
                continue;
            if (row.type === 'earned') {
                if (row.expiresAt && row.expiresAt.getTime() <= Date.now())
                    continue;
                sum += row.points;
            }
            else if (row.type === 'spent') {
                sum -= row.points;
            }
        }
        return sum;
    }
    stageInsert(rows) {
        this.pendingInsert = rows;
    }
    async flushInsert() {
        for (const row of this.pendingInsert ?? []) {
            if (row.type === 'expired' && row.sourceId) {
                const duplicate = this.rows.some((existing) => existing.type === 'expired' && existing.sourceId === row.sourceId);
                if (duplicate)
                    continue;
            }
            await this.save(row);
        }
        this.pendingInsert = null;
    }
}
const USER = '11111111-1111-1111-1111-111111111111';
const OTHER_USER = '22222222-2222-2222-2222-222222222222';
function makeService() {
    const repo = new MemoryPoints();
    return { service: new loyalty_point_service_1.LoyaltyPointService(repo), repo };
}
(0, node_test_1.describe)('LoyaltyPointService', () => {
    (0, node_test_1.test)('award stores an earned row with no sourceId and a future expiry', async () => {
        const { service } = makeService();
        const row = await service.award({ userId: USER, points: 100, source: 'referral', description: 'پاداش' });
        strict_1.default.equal(row.type, 'earned');
        strict_1.default.equal(row.source, 'referral');
        strict_1.default.equal(row.points, 100);
        strict_1.default.equal(row.sourceId, null);
        strict_1.default.ok(row.expiresAt !== null && row.expiresAt.getTime() > Date.now() + 300 * 86_400_000);
    });
    (0, node_test_1.test)('award rejects a non-positive amount', async () => {
        const { service } = makeService();
        await strict_1.default.rejects(() => service.award({ userId: USER, points: 0, source: 'manual' }), /بیشتر از صفر/);
        await strict_1.default.rejects(() => service.award({ userId: USER, points: -5, source: 'manual' }), /بیشتر از صفر/);
    });
    (0, node_test_1.test)('balance is earned minus spent and stays per user', async () => {
        const { service } = makeService();
        await service.award({ userId: USER, points: 500, source: 'referral' });
        await service.award({ userId: OTHER_USER, points: 900, source: 'birthday' });
        await service.redeem(USER, 200, 'استفاده در رزرو');
        strict_1.default.equal(await service.getBalance(USER), 300);
        strict_1.default.equal(await service.getBalance(OTHER_USER), 900);
        strict_1.default.equal(await service.getBalance('33333333-3333-3333-3333-333333333333'), 0);
    });
    (0, node_test_1.test)('redeem rejects when the balance is too low', async () => {
        const { service } = makeService();
        await service.award({ userId: USER, points: 50, source: 'review' });
        await strict_1.default.rejects(() => service.redeem(USER, 51, 'استفاده در رزرو'), /موجودی امتیاز/);
        strict_1.default.equal(await service.getBalance(USER), 50);
    });
    (0, node_test_1.test)('redeem writes a spent row with no expiry', async () => {
        const { service } = makeService();
        await service.award({ userId: USER, points: 100, source: 'booking' });
        const spent = await service.redeem(USER, 100, 'تخفیف رزرو');
        strict_1.default.equal(spent.type, 'spent');
        strict_1.default.equal(spent.source, 'redemption');
        strict_1.default.equal(spent.sourceId, null);
        strict_1.default.equal(spent.expiresAt, null);
        strict_1.default.equal(await service.getBalance(USER), 0);
    });
    (0, node_test_1.test)('expireOldPoints cancels each expired grant exactly once', async () => {
        const { service, repo } = makeService();
        const expiredGrant = await repo.save(repo.create({
            userId: USER,
            points: 20,
            type: 'earned',
            source: 'booking',
            sourceId: null,
            description: null,
            expiresAt: new Date(Date.now() - 1_000),
        }));
        await service.award({ userId: USER, points: 50, source: 'booking' });
        strict_1.default.equal(await service.getBalance(USER), 50);
        strict_1.default.equal(await service.expireOldPoints(), 1);
        strict_1.default.equal(await service.expireOldPoints(), 0);
        const cancelling = repo.rows.filter((row) => row.type === 'expired');
        strict_1.default.equal(cancelling.length, 1);
        strict_1.default.equal(cancelling[0].sourceId, expiredGrant.id);
        strict_1.default.equal(cancelling[0].points, 20);
        strict_1.default.equal(await service.getBalance(USER), 50);
    });
    (0, node_test_1.test)('getHistory returns the newest entries first and honours the limit', async () => {
        const { service, repo } = makeService();
        const seed = (points, userId, createdAt) => ({
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
        strict_1.default.equal(newestOnly.length, 1);
        strict_1.default.equal(newestOnly[0].points, 20);
        strict_1.default.equal((await service.getHistory(USER)).length, 2);
    });
});
