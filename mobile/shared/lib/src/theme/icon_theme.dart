import 'package:flutter/material.dart';
import 'colors.dart';

class BoyaIconTheme {
  BoyaIconTheme._();

  static const IconThemeData light = IconThemeData(
    color: BoyaColors.petrolGreen,
    size: 24.0,
    weight: 1.8, // Approximation for 1.8px stroke on supported icon fonts (like Material Symbols)
  );

  static const IconThemeData unselected = IconThemeData(
    color: BoyaColors.textSecondary,
    size: 24.0,
    weight: 1.8,
  );
}
