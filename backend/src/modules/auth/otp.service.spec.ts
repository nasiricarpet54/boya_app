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
  let configValues: Record<string, string | undefined>;
  const fetchMock = jest.fn();
  const originalEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    originalEnv.OTP_DEV_MODE = process.env.OTP_DEV_MODE;
  });

  const originalFetch: unknown =
    (globalThis as { fetch?: unknown }).fetch;

  afterAll(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (originalFetch === undefined) delete (globalThis as { fetch?: unknown }).fetch;
    else (globalThis as { fetch?: unknown }).fetch = originalFetch;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // Explicit dev flag off + a configured pattern bodyId: sendOtp reaches sms.verify.
    process.env.OTP_DEV_MODE = 'false';
    redis.incr.mockResolvedValue(1);
    redis.expire.mockResolvedValue(1);
    redis.set.mockResolvedValue('OK');
    redis.del.mockResolvedValue(1);
    sms.verify.mockResolvedValue({ success: true });
    // Direct-SMS fallback credentials + a successful provider answer.
    configValues = {
      MELIPAYAMAK_OTP_BODY_ID: '123456',
      MELIPAYAMAK_USERNAME: 'user',
      MELIPAYAMAK_PASSWORD: 'pass',
      MELIPAYAMAK_SENDER: '3000123',
      MELIPAYAMAK_URL: 'https://rest.payamak-panel.com/api/SendSMS/',
    };
    fetchMock.mockResolvedValue({
      json: async () => ({ RetStatus: 1, StrRetStatus: 'Ok' }),
      status: 200,
    });
    (globalThis as { fetch?: unknown }).fetch = fetchMock as unknown as typeof fetch;

    const moduleRef = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: 'OTP_REDIS', useValue: redis },
        { provide: SmsService, useValue: sms },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) => configValues[key] ?? fallback,
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

  it('sends an OTP through the Melipayamak pattern without returning the code', async () => {
    await service.sendOtp('09121234567');
    expect(sms.verify).toHaveBeenCalledWith({
      to: '09121234567',
      template: '123456',
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

  it('falls back to direct REST SMS when no pattern bodyId is configured', async () => {
    configValues.MELIPAYAMAK_OTP_BODY_ID = '';
    await service.sendOtp('09121234567');
    expect(sms.verify).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://rest.payamak-panel.com/api/SendSMS/SendSMS');
    expect(init.method).toBe('POST');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('to')).toBe('09121234567');
    expect(body.get('from')).toBe('3000123');
    expect(body.get('text')).toMatch(/کد ورود شما به بویا: /u);
  });

  it('falls back to direct REST SMS when the pattern call throws', async () => {
    sms.verify.mockRejectedValueOnce(new Error('pattern not approved'));
    await service.sendOtp('09121234567');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(redis.del).not.toHaveBeenCalledWith('otp:login:09121234567');
  });

  it('answers SMS_FAILED when pattern and direct SMS both fail', async () => {
    sms.verify.mockRejectedValueOnce(new Error('pattern down'));
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ RetStatus: 0, StrRetStatus: 'Error' }),
      status: 200,
    });
    await expect(service.sendOtp('09121234567')).rejects.toThrow('پیامک');
    expect(redis.del).toHaveBeenCalledWith('otp:login:09121234567');
  });
});
