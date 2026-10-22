import 'package:flutter/material.dart';

/// BOYA color tokens matching the official brand guidelines.
abstract final class BoyaColors {
  // رنگ‌های اصلی و زمینه
  static const Color primary = Color(0xFF133E3E);        // سبز نفتی بویا (Deep Petrol Teal)
  static const Color primaryHover = Color(0xFF0F3232);
  static const Color primaryPressed = Color(0xFF0B2626);
  static const Color primarySubtle = Color(0xFFE8F0EF);

  static const Color cream = Color(0xFFF8F9FA);          // سطح خنثی روشن
  static const Color surface = Color(0xFFFFFFFF);        // سفید کارت‌ها و سطوح
  static const Color white = Color(0xFFFFFFFF);

  // رنگ‌های تأکیدی
  static const Color sage = Color(0xFF8A9684);           // مریم/زیتونی ملایم (accent)
  static const Color sageSubtle = Color(0xFFEFF1EE);    // پس‌زمینهٔ بج و هایلایت

  // متون و خطوط
  static const Color ink = Color(0xFF133E3E);            // قلم اصلی
  static const Color inkMuted = Color(0xFF5A6B6B);       // خاکستری زغالی
  static const Color line = Color(0xFFD9DEDB);           // خاکستری گرم (دیوایدرها و بردرها)

  // رنگ‌های وضعیت
  static const Color success = Color(0xFF6F9A8D);        // سبز مریم‌گلی
  static const Color successSubtle = Color(0xFFEAF2EF);
  static const Color warning = Color(0xFFC99558);        // کهربایی نرم
  static const Color warningSubtle = Color(0xFFFBF4EC);
  static const Color error = Color(0xFFB35D67);          // آلبالویی مات
  static const Color errorSubtle = Color(0xFFF8ECEE);
  static const Color info = Color(0xFF5E8B95);
  static const Color infoSubtle = Color(0xFFEDF4F5);

  // ابعاد و شعاع گوشه‌ها
  static const double radiusCard = 20.0;
  static const double radiusButton = 12.0;
}
