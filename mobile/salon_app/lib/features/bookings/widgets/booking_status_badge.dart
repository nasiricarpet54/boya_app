import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

import '../domain/booking_summary.dart';

/// The status pill shown on every booking row and detail header.
///
/// The colors are read from [BoyaColors] so the badge picks up the theme's
/// meaning (success/warning/error) rather than carrying its own palette, and
/// the label is the Persian text the backend's status names map to — there is
/// one place where `no_show` becomes «عدم مراجعه», so the list and the detail
/// can never disagree about what a row means.
class BookingStatusBadge extends StatelessWidget {
  const BookingStatusBadge({required this.status, this.compact = false, super.key});

  final BookingStatus status;

  /// A taller variant for the detail header, where the status is the headline
  /// rather than one line among several.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final (color, icon) = switch (status) {
      BookingStatus.pending => (BoyaColors.warning, Icons.hourglass_top_outlined),
      BookingStatus.confirmed => (BoyaColors.primary, Icons.check_circle_outline),
      BookingStatus.completed => (BoyaColors.success, Icons.done_all_outlined),
      BookingStatus.reviewed => (BoyaColors.success, Icons.star_outline),
      BookingStatus.cancelled => (BoyaColors.error, Icons.cancel_outlined),
      BookingStatus.noShow => (BoyaColors.error, Icons.person_off_outlined),
    };

    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(compact ? 10 : 8),
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? 12 : 8,
          vertical: compact ? 6 : 2,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: compact ? 18 : 14, color: color),
            SizedBox(width: compact ? 6 : 4),
            Text(
              status.label,
              style: (compact ? BoyaTypography.body : BoyaTypography.overline)
                  .copyWith(color: color),
            ),
          ],
        ),
      ),
    );
  }
}