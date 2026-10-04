import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BookingModule } from '../booking/booking.module';
import { ServiceModule } from '../service/service.module';
import { SpecialistModule } from '../specialist/specialist.module';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from '../user/user.module';
import { DeviceToken } from './entities/device-token.entity';
import { Notification } from './entities/notification.entity';
import { NotificationListener } from './listeners/notification.listener';
import { NotificationController } from './notification.controller';
import { DeviceTokenController } from './device-token.controller';
import { InAppNotificationService } from './services/in-app-notification.service';
import { KavenegarAlertService } from './services/kavenegar-alert.service';
import { PushNotificationService } from './services/push-notification.service';
import { ReminderScheduler } from './services/reminder.scheduler';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, DeviceToken]),
    BookingModule,
    ServiceModule,
    SpecialistModule,
    TenantModule,
    UserModule,
  ],
  // NotificationController and DeviceTokenController stay in this module, and
  // ReminderScheduler is a provider here so ScheduleModule picks its three
  // @Cron methods up on boot: a provider registered anywhere else would never
  // be instantiated and the sweeps would silently never run.
  controllers: [NotificationController, DeviceTokenController],
  providers: [
    InAppNotificationService,
    KavenegarAlertService,
    PushNotificationService,
    NotificationListener,
    ReminderScheduler,
  ],
  exports: [InAppNotificationService, PushNotificationService],
})
export class NotificationModule {}

