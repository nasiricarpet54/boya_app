import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../data/booking_history_api.dart';
import '../../data/review_api.dart';
import '../../domain/booking_record.dart';

/// Post-visit feedback for a `completed` booking.
///
/// Pops `true` once the backend accepted the review, so the caller can refresh
/// the list (the booking is now `reviewed`).
class ReviewDialog extends ConsumerStatefulWidget {
  const ReviewDialog({required this.booking, super.key});

  final BookingRecord booking;

  @override
  ConsumerState<ReviewDialog> createState() => _ReviewDialogState();
}

class _ReviewDialogState extends ConsumerState<ReviewDialog> {
  final TextEditingController _comment = TextEditingController();
  int _rating = 0;
  bool _submitting = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_rating == 0 || _submitting) return;
    setState(() => _submitting = true);
    try {
      await ref.read(reviewApiProvider).submit(
            tenantId: widget.booking.tenantId,
            bookingId: widget.booking.id,
            rating: _rating,
            comment: _comment.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(messageFromDio(error))));
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('ثبت بازخورد'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('تجربه شما از این مراجعه چطور بود؟', style: BoyaTypography.body),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var star = 1; star <= 5; star++)
                IconButton(
                  onPressed: _submitting ? null : () => setState(() => _rating = star),
                  tooltip: toPersianDigits(star),
                  icon: Icon(
                    star <= _rating ? Icons.star : Icons.star_border,
                    color: BoyaColors.warning,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _comment,
            enabled: !_submitting,
            maxLines: 3,
            maxLength: 1000,
            decoration: const InputDecoration(hintText: 'توضیحات (اختیاری)'),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.of(context).pop(false),
          child: const Text('انصراف'),
        ),
        FilledButton(
          onPressed: _rating == 0 || _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: BoyaColors.white),
                )
              : const Text('ثبت بازخورد'),
        ),
      ],
    );
  }
}

/// Opens [ReviewDialog] and refreshes the booking lists once feedback lands.
Future<void> showReviewDialog(BuildContext context, WidgetRef ref, BookingRecord booking) async {
  final submitted = await showDialog<bool>(
    context: context,
    builder: (_) => ReviewDialog(booking: booking),
  );
  if (submitted != true) return;
  if (!context.mounted) return;
  ref.invalidate(bookingsProvider);
  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('بازخورد شما ثبت شد. سپاسگزاریم!')));
}
