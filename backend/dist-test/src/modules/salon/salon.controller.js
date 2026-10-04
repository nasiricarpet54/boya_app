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
exports.CategoryController = exports.SalonPanelController = exports.SalonController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const public_decorator_1 = require("../auth/decorators/public.decorator");
const match_salons_dto_1 = require("./dto/match-salons.dto");
const salon_bookings_query_dto_1 = require("./dto/salon-bookings-query.dto");
const salon_availability_query_dto_1 = require("./dto/salon-availability-query.dto");
const salon_query_dto_1 = require("./dto/salon-query.dto");
const specialist_panel_dto_1 = require("./dto/specialist-panel.dto");
const update_salon_profile_dto_1 = require("./dto/update-salon-profile.dto");
const update_salon_schedule_dto_1 = require("./dto/update-salon-schedule.dto");
const update_service_line_dto_1 = require("./dto/update-service-line.dto");
const salon_service_1 = require("./salon.service");
let SalonController = class SalonController {
    salons;
    constructor(salons) {
        this.salons = salons;
    }
    list(query) {
        return this.salons.list(query);
    }
    match(body) {
        return this.salons.match(body);
    }
    detail(id, query) {
        return this.salons.findOne(id, query);
    }
    availableSlots(id, query) {
        return this.salons.availableSlots(id, query);
    }
    specialists(id) {
        return this.salons.specialists(id);
    }
    portfolio(id) {
        return this.salons.portfolio(id);
    }
};
exports.SalonController = SalonController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'فهرست عمومی سالن‌های زیبایی' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [salon_query_dto_1.SalonQueryDto]),
    __metadata("design:returntype", Promise)
], SalonController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('match'),
    (0, swagger_1.ApiOperation)({
        summary: 'پیشنهاد بهترین سالن بر اساس فیلترها و وزن‌دهی',
        description: 'پایهٔ قابلیت «بهترین تطابق». خروجی هم‌شکل GET /salons است اما بر اساس امتیاز وزن‌دار مرتب شده. ' +
            'پرچم‌های پریمیوم در فاز ۲ روی همین امتیاز ضرب می‌شوند.',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [match_salons_dto_1.MatchSalonsDto]),
    __metadata("design:returntype", Promise)
], SalonController.prototype, "match", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'جزئیات یک سالن',
        description: 'از ورودی‌های این مسیر فقط lat/lng مصرف می‌شوند.',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, salon_query_dto_1.SalonQueryDto]),
    __metadata("design:returntype", Promise)
], SalonController.prototype, "detail", null);
__decorate([
    (0, common_1.Get)(':id/available-slots'),
    (0, swagger_1.ApiOperation)({
        summary: 'زمان‌های خالی سالن در یک روز برای یک خدمت',
        description: 'بر اساس working_hours سالن، مدت خدمت و رزروهای موجود. روز تعطیل (مثلاً جمعه) لیست خالی می‌دهد.',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, salon_availability_query_dto_1.SalonAvailabilityQueryDto]),
    __metadata("design:returntype", Promise)
], SalonController.prototype, "availableSlots", null);
__decorate([
    (0, common_1.Get)(':id/specialists'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({
        summary: 'متخصصان فعال یک سالن',
        description: 'برای فرم رزرو، پیش از ورود کاربر.',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SalonController.prototype, "specialists", null);
__decorate([
    (0, common_1.Get)(':id/portfolio'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({
        summary: 'نمونه‌کارهای متخصصان یک سالن',
        description: 'همه تصاویر portfolio_images متخصصان فعال سالن. ' +
            'هر آیتم: id، imageUrl، specialistId، specialistName. سالن بدون نمونه‌کار لیست خالی می‌دهد.',
    }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SalonController.prototype, "portfolio", null);
exports.SalonController = SalonController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiTags)('salons'),
    (0, common_1.Controller)('salons'),
    __metadata("design:paramtypes", [salon_service_1.SalonService])
], SalonController);
let SalonPanelController = class SalonPanelController {
    salons;
    constructor(salons) {
        this.salons = salons;
    }
    status(user) {
        return this.salons.staffApprovalStatus(user);
    }
    me(user) {
        return this.salons.staffTenant(user);
    }
    updateMe(user, dto) {
        return this.salons.updateStaffProfile(user, dto);
    }
    updateSchedule(user, dto) {
        return this.salons.updateStaffSchedule(user, dto);
    }
    listLines(user) {
        return this.salons.listServiceLines(user);
    }
    createLine(user, dto) {
        return this.salons.createServiceLine(user, dto);
    }
    updateLine(user, id, dto) {
        return this.salons.updateServiceLine(user, id, dto);
    }
    deleteLine(user, id) {
        return this.salons.deleteServiceLine(user, id);
    }
    listServices(user, lineId) {
        return this.salons.listServices(user, lineId);
    }
    createService(user, lineId, dto) {
        return this.salons.createService(user, lineId, dto);
    }
    updateService(user, id, dto) {
        return this.salons.updateService(user, id, dto);
    }
    deleteService(user, id) {
        return this.salons.deleteService(user, id);
    }
    listSpecialists(user) {
        return this.salons.listPanelSpecialists(user);
    }
    createSpecialist(user, dto) {
        return this.salons.createPanelSpecialist(user, dto);
    }
    updateSpecialist(user, id, dto) {
        return this.salons.updatePanelSpecialist(user, id, dto);
    }
    deleteSpecialist(user, id) {
        return this.salons.deletePanelSpecialist(user, id);
    }
    listPortfolio(user) {
        return this.salons.listPanelPortfolio(user);
    }
    addPortfolioItem(user, dto) {
        return this.salons.addPanelPortfolioItem(user, dto);
    }
    deletePortfolioItem(user, id) {
        return this.salons.deletePanelPortfolioItem(user, id);
    }
    listBookings(user, query) {
        return this.salons.listPanelBookings(user, query);
    }
    getBooking(user, id) {
        return this.salons.getPanelBooking(user, id);
    }
    approveBooking(user, id) {
        return this.salons.approvePanelBooking(user, id);
    }
    rejectBooking(user, id, dto) {
        return this.salons.rejectPanelBooking(user, id, dto);
    }
    markVisitedBooking(user, id) {
        return this.salons.markVisitedPanelBooking(user, id);
    }
    noShowBooking(user, id) {
        return this.salons.noShowPanelBooking(user, id);
    }
    dashboard(user) {
        return this.salons.staffDashboard(user);
    }
};
exports.SalonPanelController = SalonPanelController;
__decorate([
    (0, common_1.Get)('me/status'),
    (0, swagger_1.ApiOperation)({
        summary: 'وضعیت تایید سالن کاربر واردشده',
        description: 'وضعیت تایید سالن به همراه دلیل رد (در صورت وجود) و اینکه ' +
            'تغییراتی در انتظار بررسی ادمین هست یا نه.',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "status", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'اطلاعات سالن کاربر واردشده' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "me", null);
__decorate([
    (0, common_1.Patch)('me'),
    (0, swagger_1.ApiOperation)({
        summary: 'ویرایش اطلاعات سالن (نیازمند تایید ادمین)',
        description: 'فیلدهای name/address/phone/coverImage/workingHours در pending_changes ' +
            'ذخیره و وضعیت به pending_approval تغییر می‌کند. رکورد اصلی تا تایید ادمین ' +
            'تغییر نمی‌کند، بنابراین GET /salons همچنان نام قبلی را برمی‌گرداند.',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_salon_profile_dto_1.UpdateSalonProfileDto]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "updateMe", null);
__decorate([
    (0, common_1.Patch)('me/schedule'),
    (0, swagger_1.ApiOperation)({
        summary: 'ویرایش ساعات کاری سالن (نیازمند تایید ادمین)',
        description: 'همان منطق PATCH /salon/me: workingHours در pending_changes ذخیره می‌شود و ' +
            'تا تایید ادمین اعمال نمی‌شود.',
    }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_salon_schedule_dto_1.UpdateSalonScheduleDto]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "updateSchedule", null);
__decorate([
    (0, common_1.Get)('me/lines'),
    (0, swagger_1.ApiOperation)({ summary: 'لاین‌های خدماتی سالن کاربر واردشده' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "listLines", null);
__decorate([
    (0, common_1.Post)('me/lines'),
    (0, swagger_1.ApiOperation)({ summary: 'افزودن لاین خدماتی (نیازمند تایید ادمین)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_service_line_dto_1.CreateServiceLineDto]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "createLine", null);
__decorate([
    (0, common_1.Patch)('me/lines/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'ویرایش لاین خدماتی' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_service_line_dto_1.UpdateServiceLineDto]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "updateLine", null);
__decorate([
    (0, common_1.Delete)('me/lines/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'حذف لاین خدماتی' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "deleteLine", null);
__decorate([
    (0, common_1.Get)('me/lines/:lineId/services'),
    (0, swagger_1.ApiOperation)({ summary: 'خدمات یک لاین خدماتی' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('lineId', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "listServices", null);
__decorate([
    (0, common_1.Post)('me/lines/:lineId/services'),
    (0, swagger_1.ApiOperation)({ summary: 'افزودن خدمت به لاین' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('lineId', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_service_line_dto_1.CreateServiceDto]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "createService", null);
__decorate([
    (0, common_1.Patch)('me/services/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'ویرایش خدمت' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_service_line_dto_1.UpdateServiceDto]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "updateService", null);
__decorate([
    (0, common_1.Delete)('me/services/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'حذف خدمت' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "deleteService", null);
__decorate([
    (0, common_1.Get)('me/specialists'),
    (0, swagger_1.ApiOperation)({ summary: 'متخصصان سالن کاربر واردشده' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "listSpecialists", null);
__decorate([
    (0, common_1.Post)('me/specialists'),
    (0, swagger_1.ApiOperation)({ summary: 'افزودن متخصص' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, specialist_panel_dto_1.CreateSpecialistPanelDto]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "createSpecialist", null);
__decorate([
    (0, common_1.Patch)('me/specialists/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'ویرایش متخصص' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, specialist_panel_dto_1.UpdateSpecialistPanelDto]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "updateSpecialist", null);
__decorate([
    (0, common_1.Delete)('me/specialists/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'حذف متخصص' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "deleteSpecialist", null);
__decorate([
    (0, common_1.Get)('me/portfolio'),
    (0, swagger_1.ApiOperation)({ summary: 'نمونه‌کارهای سالن کاربر واردشده' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "listPortfolio", null);
__decorate([
    (0, common_1.Post)('me/portfolio'),
    (0, swagger_1.ApiOperation)({ summary: 'افزودن نمونه‌کار (نیازمند تایید ادمین)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, specialist_panel_dto_1.AddPortfolioItemDto]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "addPortfolioItem", null);
__decorate([
    (0, common_1.Delete)('me/portfolio/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'حذف نمونه‌کار (نیازمند تایید ادمین)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "deletePortfolioItem", null);
__decorate([
    (0, common_1.Get)('me/bookings'),
    (0, swagger_1.ApiOperation)({ summary: 'لیست رزروهای سالن کاربر واردشده' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, salon_bookings_query_dto_1.SalonPanelBookingsQueryDto]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "listBookings", null);
__decorate([
    (0, common_1.Get)('me/bookings/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'جزئیات یک رزرو' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "getBooking", null);
__decorate([
    (0, common_1.Post)('me/bookings/:id/approve'),
    (0, swagger_1.ApiOperation)({ summary: 'تایید رزرو' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "approveBooking", null);
__decorate([
    (0, common_1.Post)('me/bookings/:id/reject'),
    (0, swagger_1.ApiOperation)({ summary: 'رد رزرو' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, salon_bookings_query_dto_1.SalonPanelRejectBookingDto]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "rejectBooking", null);
__decorate([
    (0, common_1.Post)('me/bookings/:id/mark-visited'),
    (0, swagger_1.ApiOperation)({ summary: 'ثبت مراجعه انجام‌شده' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "markVisitedBooking", null);
__decorate([
    (0, common_1.Post)('me/bookings/:id/no-show'),
    (0, swagger_1.ApiOperation)({ summary: 'ثبت عدم مراجعه' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "noShowBooking", null);
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, swagger_1.ApiOperation)({ summary: 'داشبورد سالن کاربر واردشده' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SalonPanelController.prototype, "dashboard", null);
exports.SalonPanelController = SalonPanelController = __decorate([
    (0, swagger_1.ApiTags)('salon-panel'),
    (0, common_1.Controller)('salon'),
    __metadata("design:paramtypes", [salon_service_1.SalonService])
], SalonPanelController);
let CategoryController = class CategoryController {
    salons;
    constructor(salons) {
        this.salons = salons;
    }
    list() {
        return this.salons.listCategories();
    }
};
exports.CategoryController = CategoryController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'دسته‌بندی‌های خدمات زیبایی' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CategoryController.prototype, "list", null);
exports.CategoryController = CategoryController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiTags)('salons'),
    (0, common_1.Controller)('categories'),
    __metadata("design:paramtypes", [salon_service_1.SalonService])
], CategoryController);
