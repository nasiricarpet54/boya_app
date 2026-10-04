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
exports.ApprovalsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../../auth/decorators/current-user.decorator");
const reject_approval_dto_1 = require("./dto/reject-approval.dto");
const approvals_service_1 = require("./approvals.service");
let ApprovalsController = class ApprovalsController {
    approvals;
    constructor(approvals) {
        this.approvals = approvals;
    }
    list(user, type, status) {
        return this.approvals.list(user, { type, status });
    }
    findOne(user, type, id) {
        return this.approvals.findOne(user, type, id);
    }
    approve(user, type, id) {
        return this.approvals.approve(user, type, id);
    }
    reject(user, type, id, dto) {
        return this.approvals.reject(user, type, id, dto.reason);
    }
};
exports.ApprovalsController = ApprovalsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'صف تایید تغییرات',
        description: 'صف تایید ادمین. type و status اختیاری‌اند؛ type نامشخص همه صف‌ها را ' +
            'با هم برمی‌گرداند و status پیش‌فرض pending_approval است.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'type', enum: approvals_service_1.APPROVAL_TYPES, required: false }),
    (0, swagger_1.ApiQuery)({ name: 'status', enum: approvals_service_1.APPROVAL_STATUSES, required: false }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('type')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ApprovalsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':type/:id'),
    (0, swagger_1.ApiOperation)({
        summary: 'جزئیات یک درخواست تایید',
        description: 'آخرین وضعیت رکورد به همراه pending_changes در صورت وجود.',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('type')),
    __param(2, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ApprovalsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':type/:id/approve'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'تایید درخواست',
        description: 'در صورت وجود pending_changes مقادیر جدید در همان رکورد اصلی merge می‌شوند.',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('type')),
    __param(2, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ApprovalsController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':type/:id/reject'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'رد درخواست',
        description: 'دلیل رد ذخیره می‌شود و pending_changes پاک می‌شود.',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('type')),
    __param(2, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, reject_approval_dto_1.RejectApprovalDto]),
    __metadata("design:returntype", Promise)
], ApprovalsController.prototype, "reject", null);
exports.ApprovalsController = ApprovalsController = __decorate([
    (0, swagger_1.ApiTags)('admin/approvals'),
    (0, common_1.Controller)('admin/approvals'),
    __metadata("design:paramtypes", [approvals_service_1.ApprovalsService])
], ApprovalsController);
