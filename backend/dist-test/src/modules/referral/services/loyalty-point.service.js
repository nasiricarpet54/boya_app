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
var LoyaltyPointService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoyaltyPointService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const loyalty_point_entity_1 = require("../entities/loyalty-point.entity");
const DEFAULT_EXPIRY_DAYS = 365;
let LoyaltyPointService = LoyaltyPointService_1 = class LoyaltyPointService {
    points;
    logger = new common_1.Logger(LoyaltyPointService_1.name);
    constructor(points) {
        this.points = points;
    }
    async award(input) {
        if (input.points <= 0)
            throw new common_1.BadRequestException('تعداد امتیاز باید بیشتر از صفر باشد');
        const expiresInDays = input.expiresInDays ?? DEFAULT_EXPIRY_DAYS;
        return this.points.save(this.points.create({
            userId: input.userId,
            points: input.points,
            type: 'earned',
            source: input.source,
            sourceId: null,
            description: input.description ?? null,
            expiresAt: new Date(Date.now() + expiresInDays * 86_400_000),
        }));
    }
    async redeem(userId, points, description) {
        if (points <= 0)
            throw new common_1.BadRequestException('تعداد امتیاز باید بیشتر از صفر باشد');
        const balance = await this.getBalance(userId);
        if (balance < points) {
            throw new common_1.BadRequestException(`موجودی امتیاز شما کافی نیست. موجودی فعلی: ${balance}`);
        }
        return this.points.save(this.points.create({
            userId,
            points,
            type: 'spent',
            source: 'redemption',
            sourceId: null,
            description,
            expiresAt: null,
        }));
    }
    async getBalance(userId) {
        const row = await this.points
            .createQueryBuilder('lp')
            .select(`COALESCE(SUM(
          CASE
            WHEN lp.type = 'earned' AND (lp.expires_at IS NULL OR lp.expires_at > NOW())
              THEN lp.points
            WHEN lp.type = 'spent'
              THEN -lp.points
            ELSE 0
          END
        ), 0)`, 'balance')
            .where('lp.user_id = :userId', { userId })
            .getRawOne();
        return Number.parseInt(row?.balance ?? '0', 10);
    }
    getHistory(userId, limit = 50) {
        return this.points.find({ where: { userId }, order: { createdAt: 'DESC' }, take: limit });
    }
    async expireOldPoints() {
        const expired = await this.points.find({
            where: { type: 'earned', expiresAt: (0, typeorm_2.LessThanOrEqual)(new Date()), sourceId: (0, typeorm_2.IsNull)() },
            order: { createdAt: 'ASC' },
        });
        if (expired.length === 0)
            return 0;
        const alreadyCancelled = await this.points.find({
            where: { type: 'expired', sourceId: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()) },
            select: { sourceId: true },
        });
        const cancelled = new Set(alreadyCancelled.map((row) => row.sourceId));
        const pending = expired.filter((row) => !cancelled.has(row.id));
        if (pending.length === 0)
            return 0;
        await this.points
            .createQueryBuilder()
            .insert()
            .into(loyalty_point_entity_1.LoyaltyPoint)
            .values(pending.map((row) => ({
            userId: row.userId,
            points: row.points,
            type: 'expired',
            source: row.source,
            sourceId: row.id,
            description: `انقضای امتیاز ${row.id}`,
            expiresAt: null,
        })))
            .orIgnore()
            .execute();
        this.logger.log(`Expired ${pending.length} loyalty point entries`);
        return pending.length;
    }
};
exports.LoyaltyPointService = LoyaltyPointService;
exports.LoyaltyPointService = LoyaltyPointService = LoyaltyPointService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(loyalty_point_entity_1.LoyaltyPoint)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], LoyaltyPointService);
