import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

/// ADR-011: the «سیار» pill marking something that travels to the customer.
///
/// Used by the salon card (a travelling specialist), the service/specialist
/// tabs of the detail page and the booking history card. One widget so the
/// colour, the icon and the label stay identical everywhere the flag shows up.
class MobileBadge extends StatelessWidget {
  const MobileBadge({super.key, this.dense = false});

  /// Shrinks the pill for rows that are already tight on space (a service tile
  /// next to its price, for instance).
  final bool dense;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? 6 : 8,
        vertical: dense ? 2 : 3,
      ),
      decoration: BoxDecoration(
        color: BoyaColors.primarySubtle,
        borderRadius: BorderRadius.circular(dense ? 6 : 8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.directions_car,
            size: dense ? 11 : 12,
            color: BoyaColors.primary,
          ),
          SizedBox(width: dense ? 3 : 4),
          Text(
            'سیار',
            style: BoyaTypography.overline.copyWith(
              color: BoyaColors.primary,
              fontWeight: FontWeight.w700,
              fontSize: dense ? 9 : 10,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}
