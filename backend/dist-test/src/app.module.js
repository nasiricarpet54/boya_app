"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const cache_manager_1 = require("@nestjs/cache-manager");
const event_emitter_1 = require("@nestjs/event-emitter");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const schedule_1 = require("@nestjs/schedule");
const throttler_1 = require("@nestjs/throttler");
const typeorm_1 = require("@nestjs/typeorm");
const nestjs_cls_1 = require("nestjs-cls");
const sms_core_1 = require("@mirad-work/sms-core");
const sms_nestjs_1 = require("@mirad-work/sms-nestjs");
const env_validation_1 = require("./config/env.validation");
const typeorm_config_1 = require("./config/typeorm.config");
const jwt_auth_guard_1 = require("./modules/auth/guards/jwt-auth.guard");
const admin_module_1 = require("./modules/admin/admin.module");
const auth_module_1 = require("./modules/auth/auth.module");
const booking_module_1 = require("./modules/booking/booking.module");
const health_module_1 = require("./modules/health/health.module");
const notification_module_1 = require("./modules/notification/notification.module");
const payment_module_1 = require("./modules/payment/payment.module");
const referral_module_1 = require("./modules/referral/referral.module");
const review_module_1 = require("./modules/review/review.module");
const salon_module_1 = require("./modules/salon/salon.module");
const service_line_module_1 = require("./modules/service-line/service-line.module");
const service_module_1 = require("./modules/service/service.module");
const specialist_module_1 = require("./modules/specialist/specialist.module");
const tenant_module_1 = require("./modules/tenant/tenant.module");
const user_module_1 = require("./modules/user/user.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                cache: true,
                validate: env_validation_1.validateEnv,
            }),
            nestjs_cls_1.ClsModule.forRoot({
                global: true,
                middleware: { mount: true },
            }),
            typeorm_1.TypeOrmModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: typeorm_config_1.typeOrmConfig,
            }),
            throttler_1.ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
            event_emitter_1.EventEmitterModule.forRoot(),
            schedule_1.ScheduleModule.forRoot(),
            cache_manager_1.CacheModule.register({ isGlobal: true }),
            sms_nestjs_1.SmsModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                isGlobal: true,
                useFactory: (config) => ({
                    defaultDriver: sms_core_1.DriverType.KAVENEGAR,
                    timeout: 10_000,
                    drivers: {
                        kavenegar: {
                            url: 'https://api.kavenegar.com/v1/',
                            apiKey: config.get('KAVENEGAR_API_KEY', ''),
                            lineNumber: config.get('KAVENEGAR_SENDER', ''),
                        },
                    },
                }),
            }),
            auth_module_1.AuthModule,
            tenant_module_1.TenantModule,
            user_module_1.UserModule,
            service_line_module_1.ServiceLineModule,
            specialist_module_1.SpecialistModule,
            service_module_1.ServiceModule,
            booking_module_1.BookingModule,
            health_module_1.HealthModule,
            payment_module_1.PaymentModule,
            notification_module_1.NotificationModule,
            admin_module_1.AdminModule,
            referral_module_1.ReferralModule,
            salon_module_1.SalonModule,
            review_module_1.ReviewModule,
        ],
        providers: [
            { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
            { provide: core_1.APP_GUARD, useClass: jwt_auth_guard_1.JwtAuthGuard },
        ],
    })
], AppModule);
