import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

/// Rounded search field. The tap target is owned by the caller so this widget
/// stays free of routing concerns.
class HomeSearchBar extends StatelessWidget {
  const HomeSearchBar({required this.onTap, super.key});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Material(
        color: BoyaColors.primarySubtle,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: BoyaColors.line),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                const Icon(Icons.search, size: 20, color: BoyaColors.inkMuted),
                const SizedBox(width: 8),
                Expanded(child: Text('جستجوی سالن، متخصص یا خدمات...', style: BoyaTypography.caption)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
