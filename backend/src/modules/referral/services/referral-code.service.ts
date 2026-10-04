import { Injectable } from '@nestjs/common';

/** Unambiguous when a code is read aloud or typed: no 0/O, 1/I/L. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_PREFIX = 'BOYA';
const CODE_LENGTH = 6;

/**
 * Pure helper for referral codes. No repository, no randomness injection, so it
 * can be unit tested without a database. `referral_code` is UNIQUE, therefore
 * `generate()` is allowed to collide and the caller retries.
 */
@Injectable()
export class ReferralCodeService {
  generate(): string {
    let suffix = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return `${CODE_PREFIX}${suffix}`;
  }

  /** Uppercases and trims, then returns the code or null when the shape is wrong. */
  normalize(input: string): string | null {
    if (!input) return null;
    const upper = input.trim().toUpperCase();
    const pattern = new RegExp(`^${CODE_PREFIX}[${ALPHABET}]{${CODE_LENGTH}}$`);
    return pattern.test(upper) ? upper : null;
  }
}
