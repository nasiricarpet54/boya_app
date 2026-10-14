import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';
import { Transform } from 'class-transformer';

enum NodeEnv {
  Development = 'development',
  Test = 'test',
  // Staging mirrors production config but keeps dev-friendly CORS so a staging
  // box on a LAN can be reached from localhost origins. Without this entry the
  // env validation rejects NODE_ENV=staging and the app fails to boot.
  Staging = 'staging',
  Production = 'production',
}

class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  DATABASE_HOST!: string;

  @IsInt()
  DATABASE_PORT: number = 5432;

  @IsString()
  DATABASE_USER!: string;

  @IsString()
  DATABASE_PASSWORD!: string;

  @IsString()
  DATABASE_NAME!: string;

  @IsString()
  REDIS_HOST!: string;

  @IsInt()
  REDIS_PORT: number = 6379;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  STRIPE_SECRET_KEY!: string;

  @IsString()
  STRIPE_WEBHOOK_SECRET!: string;

  @IsOptional()
  @IsString()
  ZARINPAL_MERCHANT_ID?: string;

  @IsOptional()
  @IsString()
  ZARINPAL_CALLBACK_URL?: string;

  @IsOptional()
  @IsString()
  ZARINPAL_SANDBOX?: string;

  /**
   * Melipayamak (ملی پیامک) credentials for the shared-service pattern API
   * (`BaseServiceNumber`). Optional so a fresh checkout still boots — the SMS
   * driver is instantiated lazily and only a real send fails without them.
   * Set both wherever SMS is meant to be delivered.
   */
  @IsOptional()
  @IsString()
  MELIPAYAMAK_USERNAME?: string;

  @IsOptional()
  @IsString()
  MELIPAYAMAK_PASSWORD?: string;

  /**
   * Sender number for the direct (non-pattern) REST SendSMS fallback.
   * Only the beta fallback needs it; the pattern API sends from the shared
   * service number instead. Optional so a fresh checkout still boots.
   */
  @IsOptional()
  @IsString()
  MELIPAYAMAK_SENDER?: string;

  /**
   * Base URL of the Melipayamak REST API. Defaults to the public panel
   * endpoint when unset.
   */
  @IsOptional()
  @IsString()
  MELIPAYAMAK_URL?: string;

  /**
   * Numeric shared-service pattern (bodyId) for the login/invite OTP code.
   * One pattern serves both purposes: its single variable receives the code.
   * Empty means the provider rejects the send and OtpService answers
   * SMS_FAILED rather than silently skipping.
   */
  @IsOptional()
  @IsString()
  MELIPAYAMAK_OTP_BODY_ID?: string;

  @IsOptional()
  @IsString()
  MELIPAYAMAK_BOOKING_BODY_ID?: string;

  /**
   * Melipayamak shared-service pattern (bodyId) for the salon-invite link.
   * Falls back to MELIPAYAMAK_INVITE_BODY_ID when unset.
   */
  @IsOptional()
  @IsString()
  MELIPAYAMAK_INVITE_BODY_ID?: string;

  /**
   * Per-role invite overrides. Each is optional and falls back to
   * MELIPAYAMAK_INVITE_BODY_ID, so one pattern serves every role until owner and
   * specialist invites need different wording. `line_manager` has no override and
   * uses the generic pattern.
   */
  @IsOptional()
  @IsString()
  MELIPAYAMAK_INVITE_OWNER_BODY_ID?: string;

  @IsOptional()
  @IsString()
  MELIPAYAMAK_INVITE_SPECIALIST_BODY_ID?: string;

  /**
   * Base of the deep link the invite SMS carries: `${INVITE_BASE_URL}?token=…`.
   * Optional because nothing else in the app reads it, but with it unset the SMS
   * contains only the bare token and the invitee has nothing to open, so set it
   * wherever invites are actually delivered.
   */
  @IsOptional()
  @IsString()
  INVITE_BASE_URL?: string;

  /**
   * How long a staff invite stays redeemable (ADR-010). Days, not seconds, so
   * the value is readable in `.env`. A non-positive or unparsable value falls
   * back to 7 rather than minting an already-expired invite.
   */
  @IsOptional()
  @IsString()
  INVITE_EXPIRY_DAYS?: string;

  /**
   * FCM service account. All three are optional and all three must be present
   * for push to turn on: PushNotificationService stays a logged no-op without
   * them, so a local run or a fresh checkout still boots.
   */
  @IsOptional()
  @IsString()
  FIREBASE_PROJECT_ID?: string;

  @IsOptional()
  @IsString()
  FIREBASE_CLIENT_EMAIL?: string;

  @IsOptional()
  @IsString()
  FIREBASE_PRIVATE_KEY?: string;

  /**
   * Phase 1 is a free showcase: the payment module ships in the tree but stays
   * off. Defaults to false so a missing variable can never enable money
   * movement by accident.
   */
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : value === true || value === 'true'))
  @IsBoolean()
  PAYMENTS_ENABLED: boolean = false;


  /**
   * Directory for uploaded images (cover photos, specialist avatars, portfolio
   * shots), also served statically at `/uploads/`. Optional: unset means
   * `${cwd}/uploads`, which is what a local checkout uses; the compose files set
   * it to the mounted volume.
   */
  @IsOptional()
  @IsString()
  UPLOAD_DIR?: string;

  @IsString()
  OTP_PEPPER!: string;

  /**
   * Explicit OTP development flag. When true, `sendOtp` logs the code instead of
   * calling the SMS provider. Defaults to false so a missing variable can never
   * silently disable real OTP delivery — set it deliberately in dev only.
   */
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : value === true || value === 'true'))
  @IsBoolean()
  OTP_DEV_MODE: boolean = false;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validated;
}
