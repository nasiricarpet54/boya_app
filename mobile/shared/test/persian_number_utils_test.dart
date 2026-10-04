import 'package:flutter_test/flutter_test.dart';

import 'package:boya_shared/utils/persian_number_utils.dart';

void main() {
  test('converts Latin and Arabic-Indic digits to Persian digits', () {
    expect(toPersianDigits('1403/1/1'), '۱۴۰۳/۱/۱');
    expect(toPersianDigits('١٤٠٣'), '۱۴۰۳');
  });

  test('converts Persian and Arabic-Indic digits to Latin digits', () {
    expect(toLatinDigits('۱۴۰۳/۱/۱'), '1403/1/1');
    expect(toLatinDigits('١٤:٣٠'), '14:30');
  });
}
