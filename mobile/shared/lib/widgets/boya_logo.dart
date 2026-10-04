import 'package:flutter/material.dart';

import '../theme/boya_colors.dart';
import '../theme/boya_typography.dart';

/// Wordmark until a brand asset is added. Do not invent a logo file.
class BoyaLogo extends StatelessWidget {
  const BoyaLogo({super.key, this.size = 80});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: BoyaColors.primarySubtle,
        borderRadius: BorderRadius.circular(size * 0.28),
      ),
      child: Text('بویا', style: BoyaTypography.headline.copyWith(color: BoyaColors.primary)),
    );
  }
}
