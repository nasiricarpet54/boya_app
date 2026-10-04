import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { BookingStatus } from '../../booking/booking.entity';
import { InAppNotificationService } from './in-app-notification.service';
import { KavenegarAlertService } from './kavenegar-alert.service';
import { PushNotificationService } from './push-notification.service';

interface ReminderRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  title: string;
  body: string;
}

/** Minutes past the start time before an unarrived customer counts as a no-show. */
const NO_SHOW_GRACE_MINUTES = 30;
const REMINDER_LEAD_HOURS = 24;
/** The "how was it?" prompt waits this long after the visit ends... */
const FEEDBACK_DELAY_HOURS = 2;
/** ...and gives up after this, so a stale visit is never pestered again. */
const FEEDBACK_WINDOW_HOURS = 24;

/**
 * The charter fixes every instant to Tehran, so the crons are pinned to it
 * rather than inheriting the host clock: a UTC container would otherwise run
 * the sweeps on a different half-hour than a Tehran laptop does.
 */
const CRON_TIMEZONE = 'Asia/Tehran';

/**
 * Phase 1 reminders, all driven off the `*_reminder_sent_at` columns added in
 * migration 1730000000011.
 *
 * Each sweep marks the row in the same statement that claims it, so a crash
 * mid-send cannot resend: the next tick no longer matches. The SMS and the push
 * are best effort and do not gate the timestamp, because a provider outage
 * should not make the job retry forever.
 */
@Injectable()
export class ReminderScheduler implements OnModuleInit {
  private readonly logger = new Logger(ReminderScheduler.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly inApp: InAppNotificationService,
    private readonly alerts: KavenegarAlertService,
    private readonly push: PushNotificationService,
  ) {}

  /** Makes the three sweeps visible in the boot log instead of silent. */
  onModuleInit(): void {
    this.logger.log(
      `Reminder cron jobs registered (${CRON_TIMEZONE}): booking reminder, feedback reminder, no-show sweep`,
    );
  }

  @Cron(CronExpression.EVERY_30_MINUTES, { timeZone: CRON_TIMEZONE })
  async sendBookingReminders(): Promise<void> {
    await this.run('booking reminder', () => this.claimAndSend('booking'));
  }

  @Cron(CronExpression.EVERY_30_MINUTES, { timeZone: CRON_TIMEZONE })
  async sendFeedbackReminders(): Promise<void> {
    await this.run('feedback reminder', () => this.claimAndSend('feedback'));
  }

  // Every 15 minutes; the preset list has no such entry, so the raw
  // 6-field expression is used.
  @Cron('*/15 * * * *', { timeZone: CRON_TIMEZONE })
  async detectNoShows(): Promise<void> {
    await this.run('no-show sweep', () => this.markNoShows());
  }

  private async run(label: string, job: () => Promise<number>): Promise<void> {
    try {
      const affected = await job();
      if (affected > 0) this.logger.log(`${label}: ${affected} booking(s)`);
    } catch (error) {
      this.logger.error(`${label} failed: ${(error as Error).message}`);
    }
  }

  /**
   * Claims due bookings with a single UPDATE ... RETURNING, then notifies.
   * Claiming before sending is what makes the job safe to re-run.
   */
  private async claimAndSend(kind: 'booking' | 'feedback'): Promise<number> {
    const due = await this.claimDue(kind);
    for (const row of due) {
      await this.notify(row, kind);
    }
    return due.length;
  }

  private async claimDue(kind: 'booking' | 'feedback'): Promise<ReminderRow[]> {
    if (kind === 'booking') {
      return this.dataSource.query<ReminderRow[]>(
        `UPDATE bookings b
         SET booking_reminder_sent_at = NOW()
         WHERE b.id IN (
           SELECT id FROM bookings
           WHERE status = $1
             AND booking_reminder_sent_at IS NULL
             AND lower(time_slot) > NOW()
             AND lower(time_slot) <= NOW() + ($2 || ' hours')::interval
         )
         RETURNING b.id, b.tenant_id, b.customer_id`,
        [BookingStatus.Confirmed, REMINDER_LEAD_HOURS],
      );
    }

    return this.dataSource.query<ReminderRow[]>(
      `UPDATE bookings b
       SET feedback_reminder_sent_at = NOW()
       WHERE b.id IN (
         SELECT id FROM bookings
         WHERE status = $1
           AND feedback_reminder_sent_at IS NULL
           AND upper(time_slot) <= NOW() - ($2 || ' hours')::interval
           AND upper(time_slot) > NOW() - ($3 || ' hours')::interval
       )
       RETURNING b.id, b.tenant_id, b.customer_id`,
      [BookingStatus.Completed, FEEDBACK_DELAY_HOURS, FEEDBACK_WINDOW_HOURS],
    );
  }

  private async notify(row: ReminderRow, kind: 'booking' | 'feedback'): Promise<void> {
    const isBooking = kind === 'booking';
    const title = isBooking ? 'یادآوری نوبت' : 'نظر شما درباره نوبت';
    // Phase 1 has no online payment: the booking is already confirmed here, so
    // the wording points at the salon rather than at a pending transaction.
    const body = isBooking
      ? 'نوبت شما نزدیک است و توسط سالن تایید شده است. برای هماهنگی بیشتر با سالن تماس بگیرید.'
      : 'بازخورد شما به سالن کمک می‌کند خدمات بهتری ارائه دهد.';

    try {
      await this.inApp.create({
        tenantId: row.tenant_id,
        userId: row.customer_id,
        type: isBooking ? 'booking_reminder' : 'feedback_reminder',
        title,
        body,
        data: { bookingId: row.id },
      });
    } catch (error) {
      this.logger.warn(`in-app ${kind} reminder failed for ${row.id}: ${(error as Error).message}`);
    }

    // Push rides on the in-app row the app already renders, so a tap on the
    // notification lands on the same booking screen. Best effort: the sweep has
    // already claimed the row and must not fail because FCM is down.
    try {
      await this.push.sendToUser(row.customer_id, {
        title,
        body,
        data: { bookingId: row.id, type: isBooking ? 'booking_reminder' : 'feedback_reminder' },
      });
    } catch (error) {
      this.logger.warn(`push ${kind} reminder failed for ${row.id}: ${(error as Error).message}`);
    }

    // The phone is looked up per booking because customers are tenant-scoped.
    const phone = await this.dataSource.query<{ phone: string }[]>(
      `SELECT u.phone FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [row.customer_id],
    );
    if (phone[0]?.phone) {
      await this.alerts.sendBookingAlert(phone[0].phone, title);
    }
  }

  /**
   * confirmed → no_show once the grace window has passed and the customer has
   * not confirmed they turned up. A salon that already marked the visit
   * complete is never swept, because the status is no longer `confirmed`.
   */
  private async markNoShows(): Promise<number> {
    const rows = await this.dataSource.query<{ id: string; customer_id: string }[]>(
      `UPDATE bookings
       SET status = $1
       WHERE status = $2
         AND visit_confirmed_by_customer_at IS NULL
         AND lower(time_slot) + ($3 || ' minutes')::interval < NOW()
       RETURNING id, customer_id`,
      [BookingStatus.NoShow, BookingStatus.Confirmed, NO_SHOW_GRACE_MINUTES],
    );

    for (const row of rows) {
      await this.dataSource.query(
        `UPDATE users SET no_show_count = no_show_count + 1 WHERE id = $1`,
        [row.customer_id],
      );
    }
    return rows.length;
  }
}