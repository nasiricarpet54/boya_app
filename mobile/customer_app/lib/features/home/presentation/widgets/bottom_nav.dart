import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

/// Four-tab bottom bar: خانه، رزروها، تخفیف‌ها، حساب من.
class HomeBottomNav extends StatelessWidget {
  const HomeBottomNav({required this.currentIndex, required this.onSelect, super.key});

  final int currentIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: BoyaColors.surface,
        border: Border(top: BorderSide(color: BoyaColors.line)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            for (var index = 0; index < _navItems.length; index++)
              Expanded(
                child: _NavTab(
                  item: _navItems[index],
                  selected: index == currentIndex,
                  onTap: () => onSelect(index),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _NavTab extends StatelessWidget {
  const _NavTab({required this.item, required this.selected, required this.onTap});

  final _NavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? BoyaColors.primary : BoyaColors.inkMuted;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(item.icon, size: 22, color: color),
            const SizedBox(height: 2),
            Text(item.label, style: BoyaTypography.overline.copyWith(fontSize: 10, color: color)),
          ],
        ),
      ),
    );
  }
}

class _NavItem {
  const _NavItem(this.label, this.icon);

  final String label;
  final IconData icon;
}

const _navItems = <_NavItem>[
  _NavItem('خانه', Icons.home_outlined),
  _NavItem('رزروها', Icons.receipt_long_outlined),
  _NavItem('تخفیف‌ها', Icons.local_offer_outlined),
  _NavItem('حساب من', Icons.person_outline),
];
