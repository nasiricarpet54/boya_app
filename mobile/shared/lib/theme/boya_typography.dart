import 'package:flutter/material.dart';

import 'boya_colors.dart';

/// Vazirmatn scale from the BOYA design system.
abstract final class BoyaTypography {
  static const String fontFamily = 'Vazirmatn';
  static const List<String> fontFamilyFallback = ['IRANSans', 'RoobertPRO'];

  static const TextStyle display = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 32,
    fontWeight: FontWeight.w700,
    height: 1.35,
    color: BoyaColors.ink,
  );

  static const TextStyle headline = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 24,
    fontWeight: FontWeight.w700,
    height: 1.35,
    color: BoyaColors.ink,
  );

  static const TextStyle title = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 20,
    fontWeight: FontWeight.w600,
    height: 1.35,
    color: BoyaColors.ink,
  );

  static const TextStyle body = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 16,
    fontWeight: FontWeight.w400,
    height: 1.8,
    color: BoyaColors.ink,
  );

  static const TextStyle caption = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 14,
    fontWeight: FontWeight.w400,
    height: 1.35,
    color: BoyaColors.inkMuted,
  );

  static const TextStyle overline = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 12,
    fontWeight: FontWeight.w500,
    height: 1.35,
    color: BoyaColors.inkMuted,
  );

  static TextTheme textTheme(TextTheme base) {
    return base.copyWith(
      displayLarge: display,
      headlineMedium: headline,
      titleLarge: title,
      bodyLarge: body,
      bodyMedium: caption,
      labelSmall: overline,
    );
  }
}
