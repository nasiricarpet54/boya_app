import 'package:flutter/material.dart';

/// BOYA color tokens matching the official palette:
/// Primary, Cream, Rose, Light Rose, Sage (success), Error.
abstract final class BoyaColors {
  // Primary palette
  static const Color primary = Color(0xFF173B3F); // Deep Petrol Teal
  static const Color primaryHover = Color(0xFF0F3232);
  static const Color primaryPressed = Color(0xFF0B2626);
  static const Color primarySubtle = Color(0xFFE8F0EF);

  static const Color cream = Color(0xFFF7F3EE); // Soft Cream Background
  static const Color surface = Color(0xFFFFFFFF); // Card surface
  static const Color white = Color(0xFFFFFFFF);

  // Accent colors for 60-25-10 ratio
  static const Color rose = Color(0xFFD9A2B0); // Rose Gold accent
  static const Color lightRose = Color(0xFFE6B5C0); // Light Rose subtle

  // Semantic colors
  static const Color success = Color(0xFF6F9A8D); // Sage Green (Success)
  static const Color successSubtle = Color(0xFFEAF2EF); // Light Sage background
  static const Color error = Color(0xFFB35D67); // Error Wine
  static const Color errorSubtle = Color(0xFFF8ECEE); // Error background

  // Neutrals
  static const Color ink = Color(0xFF1C1C1C); // Primary text
  static const Color inkMuted = Color(0xFF6C6C6C); // Muted text
  static const Color line = Color(0xFFE8E8E8); // Divider lines
  static const Color divider = Color(0xFFE8E8E8);

  // Additional semantics (not part of core palette; kept for compatibility)
  static const Color info = Color(0xFF5E8B95);
  static const Color infoSubtle = Color(0xFFEDF4F5);
  static const Color warning = Color(0xFFC99558);
  static const Color warningSubtle = Color(0xFFFBF4EC);

  // Radii
  static const double radiusCard = 20.0;
  static const double radiusButton = 12.0;
}
