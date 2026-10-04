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

  @IsString()
  KAVENEGAR_API_KEY!: string;

  @IsOptional()
  @IsString()
  KAVENEGAR_OTP_TEMPLATE?: string;

  @IsOptional()
  @IsString()
  KAVENEGAR_BOOKING_TEMPLATE?: string;

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
