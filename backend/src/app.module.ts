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
import { TenantModule } from './modules/tenant/tenant.module';
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
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    CacheModule.register({ isGlobal: true }),
    SmsModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      isGlobal: true,
      useFactory: (config: ConfigService) => ({
        defaultDriver: DriverType.KAVENEGAR,
        timeout: 10_000,
        drivers: {
          kavenegar: {
            url: 'https://api.kavenegar.com/v1/',
            apiKey: config.get<string>('KAVENEGAR_API_KEY', ''),
            lineNumber: config.get<string>('KAVENEGAR_SENDER', ''),
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
  ],
  // Order matters: the throttler runs first so an unauthenticated flood is
  // still rate limited before token verification, and `RolesGuard` last so
  // `@Roles()` is only read from a request whose token has already verified.
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
