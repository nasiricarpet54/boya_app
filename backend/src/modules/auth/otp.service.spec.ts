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

  beforeEach(async () => {
    jest.clearAllMocks();
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
      'otp:09121234567',
      expect.stringMatching(/^[a-f0-9]{64}$/),
      'EX',
      120,
    );
  });

  it('rejects a fourth send inside the window', async () => {
    redis.incr.mockResolvedValue(4);
    await expect(service.sendOtp('09121234567')).rejects.toThrow('بیش از حد مجاز');
    expect(sms.verify).not.toHaveBeenCalled();
  });
});
