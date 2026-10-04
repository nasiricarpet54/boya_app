import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../application/home_providers.dart';
import '../widgets/bottom_nav.dart';
import '../widgets/category_grid.dart';
import '../widgets/filter_chips.dart';
import '../widgets/promo_banner.dart';
import '../widgets/salon_card.dart';
import '../widgets/search_bar.dart';
import '../widgets/top_bar.dart';

/// Snappfood-style landing screen: header, search, categories, banner,
/// filters and the nearby salon feed.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // An empty list while loading and on error keeps the feed from breaking the
    // rest of the screen; the retry control comes with the refresh story.
    final salons = ref.watch(nearbySalonsProvider).asData?.value ?? const [];
    return Scaffold(
      backgroundColor: BoyaColors.cream,
      body: ListView(
        padding: EdgeInsets.zero,
        children: [
          const HomeTopBar(),
          const SizedBox(height: 12),
          HomeSearchBar(onTap: () => context.push('/search')),
          const SizedBox(height: 16),
          const CategoryGrid(),
          const SizedBox(height: 16),
          const PromoBanner(),
          const SizedBox(height: 16),
          const FilterChips(),
          const SizedBox(height: 8),
          _SectionHeader(
            title: 'سالن‌های اطراف شما',
            // The full salon listing screen is not built yet.
            onSeeAll: () {},
          ),
          for (final salon in salons) SalonCard(salon: salon),
          const SizedBox(height: 16),
        ],
      ),
      bottomNavigationBar: HomeBottomNav(
        currentIndex: 0,
        onSelect: (index) => _onTabSelected(context, index),
      ),
    );
  }
}

void _onTabSelected(BuildContext context, int index) {
  switch (index) {
    case 0:
      // Already on home.
      break;
    case 1:
      context.go('/profile/bookings');
      break;
    case 2:
      // Offers screen is not built yet.
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تخفیف‌ها به‌زودی')),
      );
      break;
    case 3:
      context.go('/profile');
      break;
    default:
      break;
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.onSeeAll});

  final String title;
  final VoidCallback onSeeAll;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Row(
        children: [
          Expanded(child: Text(title, style: BoyaTypography.title.copyWith(fontSize: 18))),
          TextButton(
            onPressed: onSeeAll,
            style: TextButton.styleFrom(
              foregroundColor: BoyaColors.primary,
              textStyle: BoyaTypography.caption.copyWith(fontWeight: FontWeight.w600),
            ),
            child: const Text('مشاهده همه'),
          ),
        ],
      ),
    );
  }
}
