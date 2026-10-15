import 'package:flutter/material.dart';

import 'boya_colors.dart';
import 'boya_typography.dart';

/// Shared Material 3 theme. Persian UI is RTL at the app root.
abstract final class BoyaTheme {
  static ThemeData light() {
    final colorScheme = ColorScheme(
      brightness: Brightness.light,
      primary: BoyaColors.primary,
      onPrimary: BoyaColors.white,
      secondary: BoyaColors.rose,
      onSecondary: BoyaColors.ink,
      error: BoyaColors.error,
      onError: BoyaColors.white,
      surface: BoyaColors.surface,
      onSurface: BoyaColors.ink,
    );

    final base = ThemeData(
      useMaterial3: true,
      fontFamily: BoyaTypography.fontFamily,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: BoyaColors.cream,
    );

    return base.copyWith(
      textTheme: BoyaTypography.textTheme(base.textTheme),
      primaryTextTheme: BoyaTypography.textTheme(base.primaryTextTheme),
      appBarTheme: const AppBarTheme(
        backgroundColor: BoyaColors.cream,
        foregroundColor: BoyaColors.ink,
        elevation: 0,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: BoyaColors.primary,
          foregroundColor: BoyaColors.white,
          minimumSize: const Size.fromHeight(48),
          textStyle: BoyaTypography.body.copyWith(fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.0)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: false,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        labelStyle: BoyaTypography.caption.copyWith(fontWeight: FontWeight.w500),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12.0),
          borderSide: const BorderSide(color: BoyaColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12.0),
          borderSide: const BorderSide(color: BoyaColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12.0),
          borderSide: const BorderSide(color: BoyaColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12.0),
          borderSide: const BorderSide(color: BoyaColors.error),
        ),
      ),
      cardTheme: CardThemeData(
        color: BoyaColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20.0)),
      ),
      dividerColor: BoyaColors.line,
    );
  }

  /// Optional dark surfaces from the design system. Light remains the default.
  static ThemeData dark() {
    const darkPrimary = Color(0xFFD4925A);
    final colorScheme = ColorScheme(
      brightness: Brightness.dark,
      primary: darkPrimary,
      onPrimary: BoyaColors.ink,
      secondary: BoyaColors.rose,
      onSecondary: BoyaColors.ink,
      error: BoyaColors.error,
      onError: BoyaColors.white,
      surface: const Color(0xFF1E1E2E),
      onSurface: BoyaColors.cream,
    );
    final base = ThemeData(
      useMaterial3: true,
      fontFamily: BoyaTypography.fontFamily,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: const Color(0xFF12121C),
    );
    return base.copyWith(
      textTheme: BoyaTypography.textTheme(base.textTheme).apply(
        bodyColor: BoyaColors.cream,
        displayColor: BoyaColors.cream,
      ),
    );
  }
}
