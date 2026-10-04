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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddPortfolioItemDto = exports.UpdateSpecialistPanelDto = exports.CreateSpecialistPanelDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const phone_util_1 = require("../../auth/utils/phone.util");
class CreateSpecialistPanelDto {
    phone;
    fullName;
    bio;
    skills;
    commissionRate;
}
exports.CreateSpecialistPanelDto = CreateSpecialistPanelDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '09121234567', description: 'شماره موبایل متخصص' }),
    (0, class_transformer_1.Transform)(({ value }) => (typeof value === 'string' ? (0, phone_util_1.normalizePhone)(value) : value)),
    (0, class_validator_1.Matches)(/^09[0-9]{9}$/, { message: 'شماره موبایل وارد شده معتبر نیست' }),
    __metadata("design:type", String)
], CreateSpecialistPanelDto.prototype, "phone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 200, example: 'مریم رضایی' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateSpecialistPanelDto.prototype, "fullName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 1000, example: 'رنگ، مش و کوتاه کردن' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CreateSpecialistPanelDto.prototype, "bio", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], example: ['رنگ', 'کوتاهی', 'شینیون'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(100, { each: true }),
    __metadata("design:type", Array)
], CreateSpecialistPanelDto.prototype, "skills", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 50, description: 'درصد پورسانت' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], CreateSpecialistPanelDto.prototype, "commissionRate", void 0);
class UpdateSpecialistPanelDto {
    bio;
    skills;
    commissionRate;
    isActive;
}
exports.UpdateSpecialistPanelDto = UpdateSpecialistPanelDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 1000, example: 'رنگ، مش و کوتاه کردن' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], UpdateSpecialistPanelDto.prototype, "bio", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], example: ['رنگ', 'کوتاهی'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(100, { each: true }),
    __metadata("design:type", Array)
], UpdateSpecialistPanelDto.prototype, "skills", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 50, description: 'درصد پورسانت' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], UpdateSpecialistPanelDto.prototype, "commissionRate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: true, description: 'نمایش متخصص در کاتالوگ عمومی' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], UpdateSpecialistPanelDto.prototype, "isActive", void 0);
class AddPortfolioItemDto {
    specialistId;
    imageUrl;
}
exports.AddPortfolioItemDto = AddPortfolioItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddPortfolioItemDto.prototype, "specialistId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 500, example: 'https://cdn.boya.ir/portfolio/before.jpg' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AddPortfolioItemDto.prototype, "imageUrl", void 0);
