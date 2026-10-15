import { AccountingModule } from './modules/accounting/accounting.module';
import { TenantRlsInterceptor } from './modules/tenant/tenant-rls.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantHierarchyGuard } from './modules/auth/guards/tenant-hierarchy.guard';
import { SlidingWindowThrottlerStorage, SlidingWindowThrottlerModule } from 'nestjs-sliding-window-throttler';
import { Redis } from 'ioredis';
import { CacheModule } from '@nestjs/cache-manager';
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
import { SpecialistModule } from './modules/specialist/specialist.module';
import { SupportModule } from './modules/support/support.module';
import { TenantModule } from './modules/tenant/tenant.module';
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
      useFactory: (config: any) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6380),
          password: config.get('REDIS_PASSWORD'),
        }
      } as any),
    }),
    ThrottlerModule.forRootAsync({

      inject: [SlidingWindowThrottlerStorage],
      useFactory: (storage: SlidingWindowThrottlerStorage) => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        storage,
      }),
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const { createCache } = await import('cache-manager');
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
      useFactory: (config: any) => ({
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
    UploadModule,
    AccountingModule,
  ],
  // Order matters: the throttler runs first so an unauthenticated flood is
  // still rate limited before token verification, and `RolesGuard` last so
  // `@Roles()` is only read from a request whose token has already verified.
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TenantRlsInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: TenantHierarchyGuard },
  ],
})
export class AppModule {}
