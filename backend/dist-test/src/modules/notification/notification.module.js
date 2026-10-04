"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const booking_module_1 = require("../booking/booking.module");
const service_module_1 = require("../service/service.module");
const specialist_module_1 = require("../specialist/specialist.module");
const tenant_module_1 = require("../tenant/tenant.module");
const user_module_1 = require("../user/user.module");
const notification_entity_1 = require("./entities/notification.entity");
const notification_listener_1 = require("./listeners/notification.listener");
const notification_controller_1 = require("./notification.controller");
const in_app_notification_service_1 = require("./services/in-app-notification.service");
const kavenegar_alert_service_1 = require("./services/kavenegar-alert.service");
const reminder_scheduler_1 = require("./services/reminder.scheduler");
let NotificationModule = class NotificationModule {
};
exports.NotificationModule = NotificationModule;
exports.NotificationModule = NotificationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([notification_entity_1.Notification]),
            booking_module_1.BookingModule,
            service_module_1.ServiceModule,
            specialist_module_1.SpecialistModule,
            tenant_module_1.TenantModule,
            user_module_1.UserModule,
        ],
        controllers: [notification_controller_1.NotificationController],
        providers: [
            in_app_notification_service_1.InAppNotificationService,
            kavenegar_alert_service_1.KavenegarAlertService,
            notification_listener_1.NotificationListener,
            reminder_scheduler_1.ReminderScheduler,
        ],
        exports: [in_app_notification_service_1.InAppNotificationService],
    })
], NotificationModule);
