import 'package:flutter/material.dart';
import '../theme/boya_colors.dart';
import '../theme/boya_typography.dart';

enum SlotStatus { free, booked, blocked }

class BoyaTimeSlot extends StatelessWidget {
  final String timeLabel;
  final SlotStatus status;
  final VoidCallback onTap;
  final String? title;

  const BoyaTimeSlot({
    super.key,
    required this.timeLabel,
    required this.status,
    required this.onTap,
    this.title,
  });

  @override
  Widget build(BuildContext context) {
    Color bgColor;
    Color borderColor;
    Color textColor;
    String label;

    switch (status) {
      case SlotStatus.free:
        bgColor = BoyaColors.cream;
        borderColor = const Color(0xFFD9D2CA); // Warm gray border
        textColor = BoyaColors.ink;
        label = title ?? 'آزاد';
        break;
      case SlotStatus.booked:
        bgColor = BoyaColors.primary;
        borderColor = BoyaColors.primary;
        textColor = BoyaColors.white;
        label = title ?? 'رزرو پلتفرم';
        break;
      case SlotStatus.blocked:
        bgColor = const Color(0xFF46565A); // Charcoal gray
        borderColor = const Color(0xFF46565A);
        textColor = BoyaColors.white;
        label = title ?? 'رزرو خارج از سیستم';
        break;
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(12), // Button/Slot radius
          border: Border.all(color: borderColor, width: 1),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 50,
              child: Text(
                timeLabel,
                style: BoyaTypography.body.copyWith(
                  color: textColor,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                label,
                style: BoyaTypography.body.copyWith(color: textColor),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class BoyaTimeSlotActionSheet {
  static Future<void> showFreeSlotOptions(
    BuildContext context,
    VoidCallback onBlock,
    VoidCallback onRest,
  ) {
    return showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.block, color: BoyaColors.ink),
                title: const Text(
                  'مسدودسازی / نوبت خارج از سیستم',
                  style: BoyaTypography.body,
                ),
                onTap: () {
                  Navigator.pop(context);
                  onBlock();
                },
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.coffee, color: BoyaColors.ink),
                title: const Text(
                  'تنظیم ساعات استراحت',
                  style: BoyaTypography.body,
                ),
                onTap: () {
                  Navigator.pop(context);
                  onRest();
                },
              ),
            ],
          ),
        );
      },
    );
  }

  static Future<void> showBlockedSlotOptions(
    BuildContext context,
    VoidCallback onUnblock,
  ) {
    return showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          title: const Text('آزادسازی زمان', style: BoyaTypography.title),
          content: const Text(
            'آیا مایلید این زمان را برای رزرو آنلاین باز کنید؟',
            style: BoyaTypography.body,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text(
                'انصراف',
                style: TextStyle(color: BoyaColors.inkMuted),
              ),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: BoyaColors.primary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: () {
                Navigator.pop(context);
                onUnblock();
              },
              child: const Text(
                'آزادسازی',
                style: TextStyle(color: BoyaColors.white),
              ),
            ),
          ],
        );
      },
    );
  }
}
