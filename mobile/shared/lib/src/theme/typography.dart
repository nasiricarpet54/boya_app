import 'package:flutter/material.dart';
import 'colors.dart';

class BoyaTypography {
  BoyaTypography._();

  static const String primaryFontFamily = 'Vazirmatn';

  static const TextStyle displayLarge = TextStyle(
    fontFamily: primaryFontFamily,
    fontWeight: FontWeight.w700,
    height: 1.35,
    color: BoyaColors.textPrimary,
  );

  static const TextStyle bodyLarge = TextStyle(
    fontFamily: primaryFontFamily,
    fontWeight: FontWeight.w400,
    height: 1.8,
    color: BoyaColors.textPrimary,
  );

  static const TextStyle bodyMedium = TextStyle(
    fontFamily: primaryFontFamily,
    fontWeight: FontWeight.w500,
    height: 1.8,
    color: BoyaColors.textPrimary,
  );

  static const TextTheme textTheme = TextTheme(
    displayLarge: displayLarge,
    bodyLarge: bodyLarge,
    bodyMedium: bodyMedium,
  );
}
