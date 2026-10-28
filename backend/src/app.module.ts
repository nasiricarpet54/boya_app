import { AccountingModule } from './modules/accounting/accounting.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { TenantRlsInterceptor } from './modules/tenant/tenant-rls.interceptor';
import { QueryLimitInterceptor } from './common/interceptors/query-limit.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SlidingWindowThrottlerStorage, SlidingWindowThrottlerModule } from 'nestjs-sliding-window-throttler';
import { RedisFailureStrategy } from 'nestjs-sliding-window-throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheServiceModule } from './modules/cache/cache-service.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClsModule } from 'nestjs-cls';
import { DriverType } from '@mirad-work/sms-core';
import { SmsModule } from '@mirad-work/sms-nestjs';
import { validateEnv } from './config/env.validation';
import { typeOrmConfig } from './config/typeorm.config';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingModule } from './modules/booking/booking.module';
import { HealthModule } from './modules/health/health.module';
import { LocationModule } from './modules/location/location.module';
import { NotificationModule } from './modules/notification/notification.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ReferralModule } from './modules/referral/referral.module';
import { ReviewModule } from './modules/review/review.module';
import { SalonModule } from './modules/salon/salon.module';
import { ServiceLineModule } from './modules/service-line/service-line.module';
import { ServiceModule } from './modules/service/service.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SpecialistModule } from './modules/specialist/specialist.module';
import { SupportModule } from './modules/support/support.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { TicketModule } from './modules/tickets/ticket.module';
import { UploadModule } from './modules/upload/upload.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: typeOrmConfig,
    }),
    SlidingWindowThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (...args: unknown[]) => {
        const config = args[0] as ConfigService;
        return {
          redis: {
            host: config.get<string>('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6380),
            password: config.get<string>('REDIS_PASSWORD'),
          },
          throttler: {
            keyPrefix: 'throttler',
            // ✅ اضافه کردن این خط برای رفع خطای Type
            failureStrategy: RedisFailureStrategy.FAIL_OPEN, 
          },
        } as unknown as import('nestjs-sliding-window-throttler').ThrottlerConfig; // ✅ کست کردن به تایپ درست
      },
    }),
    ThrottlerModule.forRootAsync({

      inject: [SlidingWindowThrottlerStorage],
      useFactory: (storage: SlidingWindowThrottlerStorage) => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        storage,
      }),
    }),
    EventEmitterModule.forRoot(),
    CacheServiceModule,
    ScheduleModule.forRoot(),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const { Keyv } = await import('keyv');
        const KeyvRedis = (await import('@keyv/redis')).default;

        return {
          stores: [
            new Keyv({
              store: new KeyvRedis(`redis://${config.get<string>('REDIS_HOST', 'localhost')}:${config.get<number>('REDIS_PORT', 6380)}`)
            })
          ],
        };
      },
    }),
    SmsModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      isGlobal: true,
      useFactory: (config: ConfigService) => ({
        defaultDriver: DriverType.MELIPAYAMAK,
        timeout: 10_000,
        drivers: {
          melipayamak: {
            url: config.get(
              'MELIPAYAMAK_URL',
              'https://rest.payamak-panel.com/api/SendSMS/',
            ),
            username: config.get('MELIPAYAMAK_USERNAME', ''),
            password: config.get('MELIPAYAMAK_PASSWORD', ''),
          },
        },
      }),
    }),
    AuthModule,
    TenantModule,
    UserModule,
    ServiceLineModule,
    SpecialistModule,
    ServiceModule,
    BookingModule,
    HealthModule,
    LocationModule,
    PaymentModule,
    NotificationModule,
    AdminModule,
    ReferralModule,
    SalonModule,
    ReviewModule,
    SupportModule,
    TicketModule,
    UploadModule,
    AccountingModule,
    AddressesModule,
  ],
  // Order matters: the throttler runs first so an unauthenticated flood is
  // still rate limited before token verification, `JwtAuthGuard` next, and
  // `RolesGuard` last so `@Roles()` is only read from a request whose token has
  // already verified. RolesGuard is the one that denies by default, so this
  // ordering is what makes an unannotated route unreachable rather than open.
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TenantRlsInterceptor },
    // Innermost interceptor: it only counts what the handler itself issues, so
    // the RLS `set_config` round trip of authenticated requests is not part of
    // the budget.
    { provide: APP_INTERCEPTOR, useClass: QueryLimitInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
