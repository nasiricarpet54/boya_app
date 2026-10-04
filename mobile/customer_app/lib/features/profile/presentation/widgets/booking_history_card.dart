import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/booking_record.dart';
import 'review_dialog.dart';

class BookingHistoryCard extends ConsumerWidget {
  const BookingHistoryCard({required this.booking, super.key});

  final BookingRecord booking;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final title = booking.salonName.isEmpty ? 'سالن' : booking.salonName;
    final service = booking.serviceName.isEmpty ? 'خدمت' : booking.serviceName;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(title, style: BoyaTypography.title)),
                _StatusBadge(status: booking.status),
              ],
            ),
            const SizedBox(height: 8),
            Text(service, style: BoyaTypography.body.copyWith(color: BoyaColors.inkMuted)),
            const SizedBox(height: 12),
            Text(formatJalaliFull(booking.start), style: BoyaTypography.caption.copyWith(color: BoyaColors.ink)),
            Text(formatJalaliTime(booking.start), style: BoyaTypography.caption.copyWith(color: BoyaColors.ink)),
            const SizedBox(height: 12),
            Text(formatPrice(booking.totalPrice), style: BoyaTypography.title.copyWith(color: BoyaColors.primary)),
            if (booking.needsReview) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => showReviewDialog(context, ref, booking),
                  child: const Text('ثبت بازخورد'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// One badge per lifecycle state (see PROJECT_CHARTER.md → Booking Lifecycle).
class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final label = _label(status);
    final tone = _tone(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: tone.background, borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: BoyaTypography.overline.copyWith(color: tone.foreground)),
    );
  }

  String _label(String value) {
    return switch (value) {
      'pending' => 'در انتظار تایید',
      'confirmed' => 'تایید شده',
      'completed' => 'انجام‌شده',
      'reviewed' => 'بازخورد داده شده',
      'cancelled' => 'لغو‌شده',
      'no_show' => 'عدم مراجعه',
      _ => value,
    };
  }

  ({Color background, Color foreground}) _tone(String value) {
    return switch (value) {
      // Yellow: waiting on the salon.
      'pending' => (background: BoyaColors.warningSubtle, foreground: BoyaColors.warning),
      // Green: the salon approved.
      'confirmed' => (background: BoyaColors.successSubtle, foreground: BoyaColors.success),
      // Grey: the visit happened but feedback is still open.
      'completed' => (background: BoyaColors.cream, foreground: BoyaColors.inkMuted),
      // Blue: feedback filed.
      'reviewed' => (background: BoyaColors.infoSubtle, foreground: BoyaColors.info),
      // Red: never happened.
      'cancelled' => (background: BoyaColors.errorSubtle, foreground: BoyaColors.error),
      'no_show' => (background: BoyaColors.errorSubtle, foreground: BoyaColors.error),
      _ => (background: BoyaColors.cream, foreground: BoyaColors.inkMuted),
    };
  }
}
