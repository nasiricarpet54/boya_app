import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

class BookingBar extends StatelessWidget {
  const BookingBar({required this.ready, required this.onConfirm, super.key, this.price});

  final bool ready;
  final String? price;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: BoyaColors.surface,
      elevation: 8,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (price != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('مبلغ خدمت', style: BoyaTypography.body),
                      Text(price!, style: BoyaTypography.title.copyWith(color: BoyaColors.primary)),
                    ],
                  ),
                ),
              // Phase 1 is payment-free: the money never moves through the app.
              Text('پرداخت آنلاین ندارد، تسویه در محل انجام می‌شود', style: BoyaTypography.caption),
              const SizedBox(height: 12),
              FilledButton(onPressed: ready ? onConfirm : null, child: const Text('تایید نهایی')),
            ],
          ),
        ),
      ),
    );
  }
}
