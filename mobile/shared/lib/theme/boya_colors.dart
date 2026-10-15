import 'package:flutter/material.dart';

/// BOYA color tokens matching the official brand guidelines.
abstract final class BoyaColors {
  // رنگ‌های اصلی و زمینه
  static const Color primary = Color(0xFF173B3F);        // سبز نفتی بویا
  static const Color cream = Color(0xFFF7F3EE);          // شیری گرم (پس‌زمینه اصلی)
  static const Color surface = Color(0xFFFFFFFF);        // سفید سطوح و کارت‌ها
  static const Color white = Color(0xFFFFFFFF);

  // رنگ‌های تأکیدی
  static const Color rose = Color(0xFFD9A2B0);           // رز خاکی (خطوط لوگو، بج‌ها)
  static const Color silk = Color(0xFFE6B5C0);           // صورتی ابریشمی (هایلایت ملایم)

  // رنگ‌های متن و خطوط
  static const Color ink = Color(0xFF173B3F);            // متن اصلی
  static const Color inkMuted = Color(0xFF46565A);       // خاکستری زغالی (متادیتا و زیرعنوان‌ها)
  static const Color line = Color(0xFFD9D2CA);           // خاکستری گرم (دیوایدرها و بوردرها)

  // رنگ‌های وضعیت
  static const Color success = Color(0xFF6F9A8D);        // سبز مریم‌گلی (تأیید نوبت)
  static const Color successSubtle = Color(0xFFEAF2EF);
  static const Color warning = Color(0xFFC99558);        // کهربایی نرم (ظرفیت محدود)
  static const Color warningSubtle = Color(0xFFFBF4EC);
  static const Color error = Color(0xFFB35D67);          // آلبالویی مات (لغو / خطا)
  static const Color errorSubtle = Color(0xFFF8ECEE);
  static const Color info = Color(0xFF5E8B95);
  static const Color infoSubtle = Color(0xFFEDF4F5);

  // شعاع گوشه‌ها
  static const double radiusCard = 20.0;
  static const double radiusButton = 12.0;
}
