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
exports.ServiceCatalogService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const service_line_service_1 = require("../service-line/service-line.service");
const service_entity_1 = require("./entities/service.entity");
let ServiceCatalogService = class ServiceCatalogService {
    services;
    lines;
    constructor(services, lines) {
        this.services = services;
        this.lines = lines;
    }
    async create(input) {
        if (input.durationMinutes <= 0)
            throw new common_1.BadRequestException('مدت زمان خدمت باید بیشتر از صفر باشد');
        if (input.price < 0)
            throw new common_1.BadRequestException('قیمت خدمت نمی‌تواند منفی باشد');
        if (input.depositRequired && (input.depositAmount == null || input.depositAmount <= 0)) {
            throw new common_1.BadRequestException('برای خدماتی که بیعانه دارند، مبلغ بیعانه باید وارد شود');
        }
        if (input.lineId)
            await this.lines.findById(input.tenantId, input.lineId);
        return this.services.save(this.services.create({
            tenantId: input.tenantId,
            lineId: input.lineId ?? null,
            name: input.name,
            description: input.description ?? null,
            durationMinutes: input.durationMinutes,
            price: input.price.toFixed(0),
            depositRequired: input.depositRequired ?? false,
            depositAmount: input.depositAmount != null ? input.depositAmount.toFixed(0) : null,
        }));
    }
    findAll(tenantId) {
        return this.services.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
    }
    async findById(tenantId, id) {
        const service = await this.services.findOne({ where: { tenantId, id } });
        if (!service)
            throw new common_1.NotFoundException('خدمت مورد نظر یافت نشد');
        return service;
    }
};
exports.ServiceCatalogService = ServiceCatalogService;
exports.ServiceCatalogService = ServiceCatalogService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(service_entity_1.Service)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        service_line_service_1.ServiceLineService])
], ServiceCatalogService);
