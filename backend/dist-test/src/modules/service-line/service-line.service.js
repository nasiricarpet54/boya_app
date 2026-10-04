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
exports.ServiceLineService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const service_line_entity_1 = require("./entities/service-line.entity");
let ServiceLineService = class ServiceLineService {
    lines;
    constructor(lines) {
        this.lines = lines;
    }
    async create(input) {
        const duplicate = await this.lines.findOne({ where: { tenantId: input.tenantId, name: input.name } });
        if (duplicate)
            throw new common_1.BadRequestException('خطی با این نام قبلاً ثبت شده است');
        return this.lines.save(this.lines.create({
            tenantId: input.tenantId,
            name: input.name,
            description: input.description ?? null,
            managerId: input.managerId ?? null,
        }));
    }
    findAll(tenantId) {
        return this.lines.find({ where: { tenantId }, order: { createdAt: 'ASC' } });
    }
    async findById(tenantId, id) {
        const line = await this.lines.findOne({ where: { tenantId, id } });
        if (!line)
            throw new common_1.NotFoundException('خط خدماتی مورد نظر یافت نشد');
        return line;
    }
};
exports.ServiceLineService = ServiceLineService;
exports.ServiceLineService = ServiceLineService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(service_line_entity_1.ServiceLine)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ServiceLineService);
