import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';

import { SmsSender } from '../src/modules/auth/interfaces/sms-sender.interface';
import { MemoryOtpService } from '../src/modules/auth/memory-otp.service';
import { InMemoryOtpStorage } from '../src/modules/auth/storage/in-memory-otp.storage';

class FakeSms implements SmsSender {
  sent: Array<{ phone: string; code: string }> = [];
  async sendOtp(phone: string, code: string): Promise<void> {
    this.sent.push({ phone, code });
  }
}

class FailingSms implements SmsSender {
  async sendOtp(): Promise<void> {
    throw new Error('provider down');
  }
}

describe('MemoryOtpService', () => {
  let storage: InMemoryOtpStorage;
  let sms: FakeSms;
  let service: MemoryOtpService;

  beforeEach(() => {
    storage = new InMemoryOtpStorage();
    sms = new FakeSms();
    service = new MemoryOtpService(storage, sms);
  });

  test('sends a six-digit code and a Persian message', async () => {
    const result = await service.sendOtp('09121234567');
    assert.equal(result.success, true);
    assert.equal(result.message.includes('ارسال شد'), true);
    assert.equal(sms.sent.length, 1);
    assert.match(sms.sent[0].code, /^[0-9]{6}$/);
  });

  test('verifies the stored code once', async () => {
    await service.sendOtp('09121234567');
    const code = sms.sent[0].code;
    assert.equal((await service.verifyOtp('09121234567', code)).valid, true);
    await assert.rejects(() => service.verifyOtp('09121234567', code), /منقضی شده/);
  });

  test('rejects a wrong code', async () => {
    await service.sendOtp('09121234567');
    await assert.rejects(() => service.verifyOtp('09121234567', '000000'), /صحیح نیست/);
  });

  test('limits a phone after three sends', async () => {
    await service.sendOtp('09121234567');
    await service.sendOtp('09121234567');
    await service.sendOtp('09121234567');
    await assert.rejects(() => service.sendOtp('09121234567'), /تعداد درخواست/);
    assert.equal((await service.sendOtp('09129876543')).success, true);
  });

  test('returns a Persian SMS failure', async () => {
    const failing = new MemoryOtpService(storage, new FailingSms());
    await assert.rejects(() => failing.sendOtp('09121234567'), /پیامک/);
  });

  test('rejects a short verification code', async () => {
    await assert.rejects(() => service.verifyOtp('09121234567', '123'), /۶ رقم/);
  });
});
