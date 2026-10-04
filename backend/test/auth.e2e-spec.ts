import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { normalizePhone, validatePhone } from '../src/modules/auth/utils/phone.util';

describe('Phone number validation', () => {
  test('accepts Persian phone number', () => {
    const normalized = normalizePhone('۰۹۱۲۱۲۳۴۵۶۷');
    assert.equal(normalized, '09121234567');
    assert.equal(validatePhone(normalized), true);
  });

  test('rejects short phone 12345', () => {
    assert.equal(validatePhone(normalizePhone('12345')), false);
  });

  test('rejects Persian short phone', () => {
    assert.equal(validatePhone(normalizePhone('۱۲۳۴۵')), false);
  });

  test('accepts phone with +98 prefix', () => {
    const normalized = normalizePhone('+989121234567');
    assert.equal(normalized, '09121234567');
    assert.equal(validatePhone(normalized), true);
  });
});
