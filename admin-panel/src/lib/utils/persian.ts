/**
 * Persian numeral helpers.
 *
 * The charter splits the two directions clearly: English digits in the
 * database, Persian digits on screen. Input may accept either, so everything
 * that goes *out* to the API runs through `toLatinDigits` and everything the
 * user reads runs through `faDigits` / `faNumber`.
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

const LATIN_BY_PERSIAN = new Map<string, string>(
  PERSIAN_DIGITS.flatMap((digit, index) => [
    [digit, String(index)],
    [ARABIC_DIGITS[index], String(index)],
  ]),
);

/**
 * Converts Persian and Arabic-Indic digits to Latin, leaving every other
 * character untouched. Mirrors `toLatinDigits` in
 * `backend/src/utils/persian-number.util.ts` so the panel and the API agree on
 * what `۰۹۱۲۱۲۳۴۵۶۷` means.
 */
export function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (digit) => LATIN_BY_PERSIAN.get(digit) ?? digit);
}

/** Maps every Latin digit in `input` to its Persian form. */
export function faDigits(input: string | number): string {
  return String(input).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

/**
 * Formats a number for display: Persian digits grouped in threes with the
 * Persian thousands separator `٬` (U+066C), as the design system requires.
 *
 * Use `faDigits` for dates and times — a year must not read `۱٬۴۰۵`.
 */
export function faNumber(value: number | string): string {
  const raw = typeof value === 'number' ? String(value) : toLatinDigits(value);
  const sign = raw.startsWith('-') ? '−' : '';
  const digits = sign ? raw.slice(1) : raw;
  const [integer, fraction] = digits.split('.');

  const grouped = (integer ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  const body = fraction ? `${grouped}.${fraction}` : grouped;

  return faDigits(`${sign}${body}`);
}

/**
 * Renders an amount of Toman. The unit is written after the number
 * ("۲۵۰٬۰۰۰ تومان"); Rial is never shown anywhere in the product.
 */
export function faCurrency(amount: number | string): string {
  return `${faNumber(amount)} تومان`;
}

/**
 * Normalises a typed phone number into the `09XXXXXXXXX` form the API's
 * `SendOtpDto` matches on. Persian digits and spaces/dashes/parentheses are
 * accepted, `+98` and `98` prefixes are rewritten to a leading zero.
 */
export function normalizePhone(input: string): string {
  let phone = toLatinDigits(input).replace(/[\s\-()]/g, '');

  if (phone.startsWith('+98')) phone = `0${phone.slice(3)}`;
  else if (phone.startsWith('98') && phone.length === 12) phone = `0${phone.slice(2)}`;

  return phone;
}

/** True when `input` normalises to a complete Iranian mobile number. */
export function isValidPhone(input: string): boolean {
  return /^09[0-9]{9}$/.test(normalizePhone(input));
}
