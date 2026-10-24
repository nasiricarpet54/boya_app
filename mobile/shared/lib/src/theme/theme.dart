import 'package:flutter/material.dart';
import 'colors.dart';
import 'typography.dart';
import 'icon_theme.dart';

class BoyaTheme {
  BoyaTheme._();

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: BoyaColors.background,
      colorScheme: ColorScheme.light(
        primary: BoyaColors.petrolGreen,
        secondary: BoyaColors.dustyRose,
        background: BoyaColors.background,
        error: BoyaColors.error,
      ),
      textTheme: BoyaTypography.textTheme,
      iconTheme: BoyaIconTheme.light,
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        selectedIconTheme: BoyaIconTheme.light,
        unselectedIconTheme: BoyaIconTheme.unselected,
        selectedItemColor: BoyaColors.petrolGreen,
        unselectedItemColor: BoyaColors.textSecondary,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: BoyaColors.petrolGreen,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          elevation: 0,
        ),
      ),
      cardTheme: CardThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        elevation: 2,
        shadowColor: BoyaColors.petrolGreen.withValues(alpha: 0.1),
      ),
    );
  }
}
