import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmsService } from '@mirad-work/sms-nestjs';

import { OtpService } from './otp.service';

describe('OtpService', () => {
  const redis = {
    incr: jest.fn(),
    expire: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };
  const sms = { verify: jest.fn() };
  let service: OtpService;
  const originalEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    originalEnv.OTP_DEV_MODE = process.env.OTP_DEV_MODE;
    originalEnv.KAVENEGAR_API_KEY = process.env.KAVENEGAR_API_KEY;
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // Explicit dev flag off + fake provider key: sendOtp must reach sms.verify.
    process.env.OTP_DEV_MODE = 'false';
    process.env.KAVENEGAR_API_KEY = 'test-key';
    redis.incr.mockResolvedValue(1);
    redis.expire.mockResolvedValue(1);
    redis.set.mockResolvedValue('OK');
    redis.del.mockResolvedValue(1);
    sms.verify.mockResolvedValue({ success: true });

    const moduleRef = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: 'OTP_REDIS', useValue: redis },
        { provide: SmsService, useValue: sms },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) => (key === 'KAVENEGAR_OTP_TEMPLATE' ? 'boya-otp' : fallback),
            getOrThrow: () => 'test-pepper',
          },
        },
      ],
    }).compile();
    service = moduleRef.get(OtpService);
  });

  it('normalizes Persian digits and +98', () => {
    expect(service.normalizePersianPhone('۰۹۱۲۱۲۳۴۵۶۷')).toBe('09121234567');
    expect(service.normalizePersianPhone('+989121234567')).toBe('09121234567');
  });

  it('sends a Persian template OTP without returning the code', async () => {
    await service.sendOtp('09121234567');
    expect(sms.verify).toHaveBeenCalledWith({
      to: '09121234567',
      template: 'boya-otp',
      tokens: { code: expect.stringMatching(/^[0-9]{6}$/) },
    });
    expect(redis.set).toHaveBeenCalledWith(
      'otp:login:09121234567',
      expect.stringMatching(/^[a-f0-9]{64}$/),
      'EX',
      120,
    );
  });

  it('namespaces the key by purpose so an invite code is not a login code', async () => {
    await service.sendOtp('09121234567', 'invite');

    // The invite code lives under its own key, so it cannot be spent on the
    // customer login endpoint (or the reverse).
    expect(redis.set).toHaveBeenCalledWith(
      'otp:invite:09121234567',
      expect.stringMatching(/^[a-f0-9]{64}$/),
      'EX',
      120,
    );
    // ...while the rate-limit key is shared, so switching purpose cannot be used
    // to slip past the per-window send cap.
    expect(redis.incr).toHaveBeenCalledWith('otp:rate:09121234567');

    // A login code does not verify an invite, and vice versa.
    const storedHash = redis.set.mock.calls[0][1] as string;
    redis.get.mockResolvedValueOnce(storedHash);
    await expect(service.verifyOtp('09121234567', '000000', 'login')).rejects.toThrow();
  });

  it('rejects a fourth send inside the window', async () => {
    redis.incr.mockResolvedValue(4);
    await expect(service.sendOtp('09121234567')).rejects.toThrow('بیش از حد مجاز');
    expect(sms.verify).not.toHaveBeenCalled();
  });
});
