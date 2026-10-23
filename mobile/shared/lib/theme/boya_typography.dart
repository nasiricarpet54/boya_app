import 'package:flutter/material.dart';

import 'boya_colors.dart';

/// BOYA typography using Vazirmatn.
///
/// The Persian font family is Vazirmatn with weights as specified in the
/// design system doc (Regular 400, Medium 500, SemiBold 600, Bold 700).
abstract final class BoyaTypography {
  static const String fontFamily = 'Vazirmatn';
  static const List<String> fontFamilyFallback = ['IRANSans', 'RoobertPRO', 'system-ui'];

  // Headline (24, Semibold 600)
  static const TextStyle headline = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 24,
    fontWeight: FontWeight.w600,
    height: 1.35,
    color: BoyaColors.ink,
  );

  // Display (32, Bold 700)
  static const TextStyle display = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 32,
    fontWeight: FontWeight.w700,
    height: 1.35,
    color: BoyaColors.ink,
  );

  // Title (20, Semibold 600)
  static const TextStyle title = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 20,
    fontWeight: FontWeight.w600,
    height: 1.35,
    color: BoyaColors.ink,
  );

  // Body (16, Regular 400)
  static const TextStyle body = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 16,
    fontWeight: FontWeight.w400,
    height: 1.8,
    color: BoyaColors.ink,
  );

  // Caption (14, Regular 400)
  static const TextStyle caption = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 14,
    fontWeight: FontWeight.w400,
    height: 1.35,
    color: BoyaColors.inkMuted,
  );

  // Overline (12, Medium 500)
  static const TextStyle overline = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 12,
    fontWeight: FontWeight.w500,
    height: 1.35,
    color: BoyaColors.inkMuted,
  );

  // Subtitle (18, SemiBold 600)
  static const TextStyle subtitle = TextStyle(
    fontFamily: fontFamily,
    fontFamilyFallback: fontFamilyFallback,
    fontSize: 18,
    fontWeight: FontWeight.w600,
    height: 1.35,
    color: BoyaColors.ink,
  );

  static TextTheme textTheme(TextTheme base) {
    return base.copyWith(
      displayLarge: display,
      headlineMedium: headline,
      titleLarge: title,
      bodyLarge: body,
      bodyMedium: caption,
      labelSmall: overline,
      titleMedium: subtitle,
    );
  }
}
