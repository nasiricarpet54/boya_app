import { toLatinDigits, toPersianDigits } from './persian-number.util';

describe('Persian digits', () => {
  it('converts Latin digits to Persian digits', () => {
    expect(toPersianDigits('1403/1/1')).toBe('۱۴۰۳/۱/۱');
    expect(toPersianDigits(14)).toBe('۱۴');
  });

  it('converts Arabic-Indic digits to Persian digits', () => {
    expect(toPersianDigits('١٤٠٣')).toBe('۱۴۰۳');
  });

  it('converts Persian and Arabic-Indic digits back to Latin digits', () => {
    expect(toLatinDigits('۱۴۰۳/۱/۱')).toBe('1403/1/1');
    expect(toLatinDigits('١٤:٣٠')).toBe('14:30');
  });
});
