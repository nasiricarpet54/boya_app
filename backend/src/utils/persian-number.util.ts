const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;
const PERSIAN_DIGIT_PATTERN = /[۰-۹]/g;
const LATIN_DIGIT_PATTERN = /\d/g;
const ARABIC_INDIC_DIGIT_OFFSET = 0x0660;
const PERSIAN_DIGIT_OFFSET = 0x06f0;

/** Converts Latin and Arabic-Indic digits to Persian numerals. */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(LATIN_DIGIT_PATTERN, (digit) => PERSIAN_DIGITS[Number(digit)]).replace(
    /[٠-٩]/g,
    (digit) => PERSIAN_DIGITS[digit.charCodeAt(0) - ARABIC_INDIC_DIGIT_OFFSET],
  );
}

/** Converts Persian and Arabic-Indic digits to Latin digits. */
export function toLatinDigits(value: string): string {
  return value
    .replace(PERSIAN_DIGIT_PATTERN, (digit) => String(digit.charCodeAt(0) - PERSIAN_DIGIT_OFFSET))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - ARABIC_INDIC_DIGIT_OFFSET));
}
