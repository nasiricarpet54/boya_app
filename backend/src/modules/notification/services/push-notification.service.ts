import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { Repository } from 'typeorm';

import { DevicePlatform, DeviceToken } from '../entities/device-token.entity';

/** FCM answers these when a token has been rotated out; the row is pruned. */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export interface PushPayload {
  title: string;
  body: string;
  /** FCM data values must be strings, so every value is coerced below. */
  data?: Record<string, unknown>;
}

/**
 * FCM delivery for reminders.
 *
 * Best effort by design: push is the third channel, after the in-app row and
 * the SMS, so a missing or broken Firebase configuration must never take the
 * cron sweep down with it. Without credentials the service stays disabled and
 * every call is a no-op, which is what a local run with no `.env` values does.
 */
@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private app: App | null = null;
  private credentialsMissing = false;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(DeviceToken) private readonly deviceTokens: Repository<DeviceToken>,
  ) {}

  /**
   * Stores a token for [userId], upserting on the token itself: FCM rotates
   * the value on reinstall, and a second row would double every push. A token
   * that already belongs to someone else is reassigned, since the same handset
   * re-registered after a logout/login swap belongs to the new account.
   */
  async register(userId: string, token: string, platform: DevicePlatform): Promise<void> {
    if (!token.trim()) return;
    await this.deviceTokens.upsert(
      { token, userId, platform, lastSeenAt: new Date() },
      { conflictPaths: ['token'] },
    );
  }

  async unregister(userId: string, token: string): Promise<void> {
    await this.deviceTokens.delete({ token, userId });
  }

  /** Sends one message per registered token, pruning the ones FCM reports dead. */
  async sendToUser(userId: string, payload: PushPayload): Promise<boolean> {
    const app = this.resolveApp();
    if (!app) return false;

    const rows = await this.deviceTokens.find({ where: { userId } });
    if (rows.length === 0) {
      // Visible at debug level so a local run can tell "no device registered"
      // apart from "FCM rejected the send".
      this.logger.debug(`No FCM device token for user ${userId}; push skipped`);
      return false;
    }

    const data: Record<string, string> = {};
    for (const [key, value] of Object.entries(payload.data ?? {})) {
      if (value !== null && value !== undefined) data[key] = String(value);
    }

    let delivered = false;
    for (const row of rows) {
      try {
        await getMessaging(app).send({
          token: row.token,
          notification: { title: payload.title, body: payload.body },
          data,
        });
        delivered = true;
      } catch (error) {
        const code = (error as { code?: string }).code ?? '';
        if (DEAD_TOKEN_CODES.has(code)) {
          await this.deviceTokens.delete({ token: row.token });
          this.logger.debug(`Pruned dead FCM token for user ${userId}`);
        } else {
          this.logger.warn(`FCM push failed for user ${userId}: ${(error as Error).message}`);
        }
      }
    }
    return delivered;
  }

  /**
   * Lazily initialises the Firebase app from the service account in the env.
   * Returns null — warning once — when the credentials are absent, so the
   * sweep keeps running on the in-app and SMS channels alone.
   */
  private resolveApp(): App | null {
    if (this.app) return this.app;
    if (this.credentialsMissing) return null;

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    // A PEM key pasted into .env arrives with escaped newlines.
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY are unset; push disabled',
      );
      this.credentialsMissing = true;
      return null;
    }

    try {
      // getApps() first: hot reload and tests can build this provider twice and
      // firebase-admin throws on a duplicate default app.
      this.app =
        getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
      this.logger.log('Firebase push enabled');
      return this.app;
    } catch (error) {
      this.logger.warn(`Firebase initialisation failed: ${(error as Error).message}`);
      this.credentialsMissing = true;
      return null;
    }
  }
}