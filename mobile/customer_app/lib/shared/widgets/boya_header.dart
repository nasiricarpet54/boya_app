import 'package:flutter/material.dart';
import 'package:boya_shared/theme/boya_colors.dart';
import 'package:boya_shared/theme/boya_typography.dart';

/// هدر Shared اپ مشتری: لوگو، نام شهر و دکمه انتخاب شهر.
/// رنگ‌ها بر اساس توکن‌های موجود در boya_shared/…/boya_colors.dart تنظیم شده‌اند.
class BoyaHeader extends StatelessWidget implements PreferredSizeWidget {
  final String selectedCity;
  final VoidCallback onCityTapped;

  const BoyaHeader({
    super.key,
    required this.selectedCity,
    required this.onCityTapped,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: BoyaColors.cream,
        border: Border(bottom: BorderSide(color: BoyaColors.line, width: 1)),
      ),
      child: SafeArea(
        bottom: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Logo & Title
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: const BoxDecoration(
                    color: BoyaColors.primary,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    'ب',
                    style: TextStyle(
                      fontFamily: BoyaTypography.fontFamily,
                      color: BoyaColors.cream,
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'بویا BOYA',
                      style: TextStyle(
                        fontFamily: BoyaTypography.fontFamily,
                        color: BoyaColors.ink,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'زیبایی که پیدا می‌شود.',
                      style: TextStyle(
                        fontFamily: BoyaTypography.fontFamily,
                        color: BoyaColors.inkMuted,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            // City Selector
            GestureDetector(
              onTap: onCityTapped,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: BoyaColors.surface,
                  border: Border.all(color: BoyaColors.line),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.location_on_outlined, size: 16, color: BoyaColors.primary),
                    const SizedBox(width: 4),
                    Text(
                      selectedCity,
                      style: const TextStyle(
                        fontSize: 12,
                        color: BoyaColors.ink,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(70);
}