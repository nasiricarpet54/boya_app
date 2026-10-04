import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';

import { LoyaltyPoint, LoyaltyPointSource } from '../entities/loyalty-point.entity';

const DEFAULT_EXPIRY_DAYS = 365;

export interface AwardPointsInput {
  userId: string;
  points: number;
  source: LoyaltyPointSource;
  description?: string;
  expiresInDays?: number;
}

/**
 * Append-only ledger over `loyalty_points`. Nothing here updates or deletes a
 * row: every change is a new entry, and the balance is a single SUM.
 */
@Injectable()
export class LoyaltyPointService {
  private readonly logger = new Logger(LoyaltyPointService.name);

  constructor(@InjectRepository(LoyaltyPoint) private readonly points: Repository<LoyaltyPoint>) {}

  async award(input: AwardPointsInput): Promise<LoyaltyPoint> {
    if (input.points <= 0) throw new BadRequestException('تعداد امتیاز باید بیشتر از صفر باشد');

    const expiresInDays = input.expiresInDays ?? DEFAULT_EXPIRY_DAYS;
    return this.points.save(
      this.points.create({
        userId: input.userId,
        points: input.points,
        type: 'earned',
        source: input.source,
        sourceId: null,
        description: input.description ?? null,
        expiresAt: new Date(Date.now() + expiresInDays * 86_400_000),
      }),
    );
  }

  async redeem(userId: string, points: number, description: string): Promise<LoyaltyPoint> {
    if (points <= 0) throw new BadRequestException('تعداد امتیاز باید بیشتر از صفر باشد');

    const balance = await this.getBalance(userId);
    if (balance < points) {
      throw new BadRequestException(`موجودی امتیاز شما کافی نیست. موجودی فعلی: ${balance}`);
    }

    return this.points.save(
      this.points.create({
        userId,
        points,
        type: 'spent',
        source: 'redemption',
        sourceId: null,
        description,
        expiresAt: null,
      }),
    );
  }

  /**
   * One aggregate, no rows loaded. Column names are spelled out because the
   * select string is raw SQL. Only live 'earned' rows add; only 'spent' rows
   * subtract. An 'expired' row is bookkeeping and must not subtract, because
   * its 'earned' row already stopped counting when it lapsed.
   */
  async getBalance(userId: string): Promise<number> {
    const row = await this.points
      .createQueryBuilder('lp')
      .select(
        `COALESCE(SUM(
          CASE
            WHEN lp.type = 'earned' AND (lp.expires_at IS NULL OR lp.expires_at > NOW())
              THEN lp.points
            WHEN lp.type = 'spent'
              THEN -lp.points
            ELSE 0
          END
        ), 0)`,
        'balance',
      )
      .where('lp.user_id = :userId', { userId })
      .getRawOne<{ balance: string }>();

    return Number.parseInt(row?.balance ?? '0', 10);
  }

  getHistory(userId: string, limit = 50): Promise<LoyaltyPoint[]> {
    return this.points.find({ where: { userId }, order: { createdAt: 'DESC' }, take: limit });
  }

  /**
   * Writes one 'expired' row per expired 'earned' row. The partial unique index
   * `uq_loyalty_points_expiry_once` on (source_id, type) makes a second run a
   * no-op instead of a duplicate, and `orIgnore` turns the violation into a skip.
   */
  async expireOldPoints(): Promise<number> {
    const expired = await this.points.find({
      where: { type: 'earned', expiresAt: LessThanOrEqual(new Date()), sourceId: IsNull() },
      order: { createdAt: 'ASC' },
    });

    if (expired.length === 0) return 0;

    const alreadyCancelled = await this.points.find({
      where: { type: 'expired', sourceId: Not(IsNull()) },
      select: { sourceId: true },
    });
    const cancelled = new Set(alreadyCancelled.map((row) => row.sourceId));

    const pending = expired.filter((row) => !cancelled.has(row.id));
    if (pending.length === 0) return 0;

    await this.points
      .createQueryBuilder()
      .insert()
      .into(LoyaltyPoint)
      .values(
        pending.map((row) => ({
          userId: row.userId,
          points: row.points,
          type: 'expired' as const,
          source: row.source,
          sourceId: row.id,
          description: `انقضای امتیاز ${row.id}`,
          expiresAt: null,
        })),
      )
      .orIgnore()
      .execute();

    this.logger.log(`Expired ${pending.length} loyalty point entries`);
    return pending.length;
  }
}
