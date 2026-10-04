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
exports.SalonPanelRejectBookingDto = exports.SalonPanelBookingsQueryDto = exports.SalonBookingStatus = void 0;
exports.isSalonBookingStatus = isSalonBookingStatus;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
function toOptionalNumber({ value }) {
    if (value === undefined || value === null || value === '')
        return undefined;
    return typeof value === 'string' ? Number(value.trim()) : Number(value);
}
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;
var SalonBookingStatus;
(function (SalonBookingStatus) {
    SalonBookingStatus["Pending"] = "pending";
    SalonBookingStatus["Confirmed"] = "confirmed";
    SalonBookingStatus["Completed"] = "completed";
    SalonBookingStatus["Reviewed"] = "reviewed";
    SalonBookingStatus["Cancelled"] = "cancelled";
    SalonBookingStatus["NoShow"] = "no_show";
})(SalonBookingStatus || (exports.SalonBookingStatus = SalonBookingStatus = {}));
function isSalonBookingStatus(value) {
    return (typeof value === 'string' &&
        Object.values(SalonBookingStatus).includes(value));
}
class SalonPanelBookingsQueryDto {
    status;
    date;
    from;
    to;
    specialistId;
    page = 1;
    limit = 50;
}
exports.SalonPanelBookingsQueryDto = SalonPanelBookingsQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: SalonBookingStatus, description: 'فیلتر وضعیت رزرو' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(SalonBookingStatus),
    __metadata("design:type", String)
], SalonPanelBookingsQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-10-15', description: 'یک روز به تاریخ میلادی' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(CALENDAR_DAY, { message: 'تاریخ باید در قالب YYYY-MM-DD باشد' }),
    __metadata("design:type", String)
], SalonPanelBookingsQueryDto.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-10-01', description: 'ابتدای بازه (میلادی، شامل)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(CALENDAR_DAY, { message: 'تاریخ باید در قالب YYYY-MM-DD باشد' }),
    __metadata("design:type", String)
], SalonPanelBookingsQueryDto.prototype, "from", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-10-31', description: 'انتهای بازه (میلادی، شامل)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(CALENDAR_DAY, { message: 'تاریخ باید در قالب YYYY-MM-DD باشد' }),
    __metadata("design:type", String)
], SalonPanelBookingsQueryDto.prototype, "to", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'فقط رزروهای این متخصص' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('loose'),
    __metadata("design:type", String)
], SalonPanelBookingsQueryDto.prototype, "specialistId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 1, minimum: 1 }),
    (0, class_transformer_1.Transform)(toOptionalNumber),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], SalonPanelBookingsQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 50, minimum: 1, maximum: 100 }),
    (0, class_transformer_1.Transform)(toOptionalNumber),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], SalonPanelBookingsQueryDto.prototype, "limit", void 0);
class SalonPanelRejectBookingDto {
    reason;
}
exports.SalonPanelRejectBookingDto = SalonPanelRejectBookingDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'متخصص در این ساعت در دسترس نیست', minLength: 5, maxLength: 280 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(5, { message: 'دلیل لغو باید حداقل ۵ کاراکتر باشد' }),
    (0, class_validator_1.MaxLength)(280),
    __metadata("design:type", String)
], SalonPanelRejectBookingDto.prototype, "reason", void 0);
