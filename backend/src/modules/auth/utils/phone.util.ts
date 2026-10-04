import { toLatinDigits } from '../../../utils/persian-number.util';

const IRANIAN_MOBILE = /^09[0-9]{9}$/;

/** ۰۹۱۲… / +98912… / 0098… / 912… → 0912… Empty for non-strings. */
export function normalizePhone(input: string | null | undefined): string {
  if (typeof input !== 'string') return '';
  let value = toLatinDigits(input).trim();
  value = value.replace(/[\s\-().]/g, '');
  if (value.startsWith('+98')) value = `0${value.slice(3)}`;
  else if (value.startsWith('0098')) value = `0${value.slice(4)}`;
  else if (value.startsWith('98') && value.length === 12) value = `0${value.slice(2)}`;
  else if (value.startsWith('9') && value.length === 10) value = `0${value}`;
  return value;
}

/** True only for a normalized 11-digit Iranian mobile. */
export function validatePhone(phone: string): boolean {
  return IRANIAN_MOBILE.test(phone);
}

export function isIranianMobile(input: string | null | undefined): boolean {
  return validatePhone(normalizePhone(input));
}

/** همراه اول / ایرانسل / رایتل, or null when the prefix is unknown. */
export function getOperator(phone: string): string | null {
  if (!validatePhone(phone)) return null;
  const prefix = Number(phone.slice(0, 4));
  if ((prefix >= 910 && prefix <= 919) || (prefix >= 990 && prefix <= 999)) return 'همراه اول';
  if ((prefix >= 901 && prefix <= 905) || (prefix >= 930 && prefix <= 939)) return 'ایرانسل';
  if (prefix >= 920 && prefix <= 922) return 'رایتل';
  return null;
}
