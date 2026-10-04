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
exports.SalonQueryDto = exports.SalonSort = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
var SalonSort;
(function (SalonSort) {
    SalonSort["Distance"] = "distance";
    SalonSort["Rating"] = "rating";
    SalonSort["Price"] = "price";
    SalonSort["Newest"] = "newest";
})(SalonSort || (exports.SalonSort = SalonSort = {}));
function toOptionalNumber({ value }) {
    if (value === undefined || value === null || value === '')
        return undefined;
    return typeof value === 'string' ? Number(value.trim()) : Number(value);
}
class SalonQueryDto {
    lat;
    lng;
    category;
    categorySlug;
    sort;
    page = 1;
    limit = 20;
}
exports.SalonQueryDto = SalonQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 35.758, description: 'Consumer latitude, for distance sorting' }),
    (0, class_transformer_1.Transform)(toOptionalNumber),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(-90),
    (0, class_validator_1.Max)(90),
    __metadata("design:type", Number)
], SalonQueryDto.prototype, "lat", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 51.41 }),
    (0, class_transformer_1.Transform)(toOptionalNumber),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(-180),
    (0, class_validator_1.Max)(180),
    __metadata("design:type", Number)
], SalonQueryDto.prototype, "lng", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'hair-color', description: 'service_categories.slug' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], SalonQueryDto.prototype, "category", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'hair-color', deprecated: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], SalonQueryDto.prototype, "categorySlug", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: SalonSort, default: SalonSort.Rating }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(SalonSort),
    __metadata("design:type", String)
], SalonQueryDto.prototype, "sort", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, minimum: 1 }),
    (0, class_transformer_1.Transform)(toOptionalNumber),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], SalonQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 20, minimum: 1, maximum: 50 }),
    (0, class_transformer_1.Transform)(toOptionalNumber),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(50),
    __metadata("design:type", Number)
], SalonQueryDto.prototype, "limit", void 0);
