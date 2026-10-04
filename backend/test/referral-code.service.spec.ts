import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { ReferralCodeService } from '../src/modules/referral/services/referral-code.service';

const CODE_PATTERN = /^BOYA[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

describe('ReferralCodeService', () => {
  const service = new ReferralCodeService();

  test('generates codes with the BOYA prefix and a 6 character suffix', () => {
    for (let i = 0; i < 100; i++) {
      assert.match(service.generate(), CODE_PATTERN);
    }
  });

  test('normalize uppercases the input', () => {
    assert.equal(service.normalize('boya7k3m9p'), 'BOYA7K3M9P');
  });

  test('normalize trims surrounding whitespace', () => {
    assert.equal(service.normalize('  BOYA7K3M9P  '), 'BOYA7K3M9P');
  });

  test('normalize rejects a wrong prefix', () => {
    assert.equal(service.normalize('XXXX7K3M9P'), null);
  });

  test('normalize rejects ambiguous characters', () => {
    assert.equal(service.normalize('BOYA0K3M9P'), null);
    assert.equal(service.normalize('BOYA1K3M9P'), null);
    assert.equal(service.normalize('BOYAOK3M9P'), null);
    assert.equal(service.normalize('BOYALK3M9P'), null);
  });

  test('normalize rejects the wrong length', () => {
    assert.equal(service.normalize('BOYA7K3M9'), null);
    assert.equal(service.normalize('BOYA7K3M9PQ'), null);
  });

  test('normalize rejects empty input', () => {
    assert.equal(service.normalize(''), null);
  });

  test('every generated code round-trips through normalize', () => {
    for (let i = 0; i < 50; i++) {
      const code = service.generate();
      assert.equal(service.normalize(code), code);
    }
  });
});
