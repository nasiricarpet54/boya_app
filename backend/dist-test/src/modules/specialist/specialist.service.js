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
exports.SpecialistService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const specialist_entity_1 = require("./entities/specialist.entity");
let SpecialistService = class SpecialistService {
    specialists;
    constructor(specialists) {
        this.specialists = specialists;
    }
    async create(input) {
        const duplicate = await this.specialists.findOne({
            where: { tenantId: input.tenantId, userId: input.userId },
        });
        if (duplicate)
            throw new common_1.BadRequestException('این کاربر قبلاً به عنوان متخصص در این سالن ثبت شده است');
        return this.specialists.save(this.specialists.create({
            tenantId: input.tenantId,
            userId: input.userId,
            bio: input.bio ?? null,
            skills: input.skills ?? [],
            commissionRate: (input.commissionRate ?? 50).toFixed(2),
        }));
    }
    findAll(tenantId) {
        return this.specialists.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
    }
    async findById(tenantId, id) {
        const specialist = await this.specialists.findOne({ where: { tenantId, id } });
        if (!specialist)
            throw new common_1.NotFoundException('متخصص مورد نظر یافت نشد');
        return specialist;
    }
};
exports.SpecialistService = SpecialistService;
exports.SpecialistService = SpecialistService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(specialist_entity_1.Specialist)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], SpecialistService);
