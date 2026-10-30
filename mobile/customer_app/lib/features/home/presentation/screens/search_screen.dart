import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/widgets/boya_app_bar.dart';
import '../../../../shared/widgets/boya_salon_card.dart';
import '../../application/home_providers.dart';
import '../widgets/salon_card.dart';

/// Search screen that supports filtering by category via query parameter.
///
/// Reads `category` from the query string and applies it to [selectedCategoryProvider]
/// so the salon list filters immediately.
class SearchScreen extends ConsumerWidget {
  const SearchScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Extract the category slug from the query parameters.
    final queryParameters = GoRouterState.of(context).uri.queryParameters;
    final categorySlug = queryParameters['category'];
    final searchQuery = queryParameters['q'] ?? '';

    // If a category slug is present, apply it to the provider so the salon
    // feed filters immediately. We do this once on build; the provider will
    // retain the value across rebuilds.
    if (categorySlug != null && categorySlug.isNotEmpty) {
      final current = ref.read(selectedCategoryProvider);
      if (current != categorySlug) {
        // Use a post-frame callback to avoid modifying state during build.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          ref.read(selectedCategoryProvider.notifier).select(categorySlug);
        });
      }
    }

    final salonsAsync = ref.watch(nearbySalonsProvider);
    return Scaffold(
      backgroundColor: BoyaColors.surface,
      appBar: const BoyaAppBar(title: 'جستجو', backgroundColor: BoyaColors.surface),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              autofocus: searchQuery.isEmpty,
              textInputAction: TextInputAction.search,
              controller: TextEditingController(text: searchQuery),
              onChanged: (value) => ref.read(searchQueryProvider.notifier).state = value,
              decoration: InputDecoration(
                hintText: 'جستجو در بویا...',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: BoyaColors.cream,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          if (categorySlug != null && categorySlug.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Row(
                children: [
                  Text(
                    'فیلتر: ',
                    style: BoyaTypography.caption.copyWith(color: BoyaColors.inkMuted),
                  ),
                  Expanded(
                    child: Text(
                      _categoryDisplayName(categorySlug),
                      style: BoyaTypography.caption.copyWith(color: BoyaColors.primary),
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      ref.read(selectedCategoryProvider.notifier).select(null);
                      context.go('/search?q=$searchQuery');
                    },
                    child: const Text('حذف فیلتر'),
                  ),
                ],
              ),
            ),
          Expanded(
            child: salonsAsync.when(
              data: (salons) {
                if (salons.isEmpty) {
                  return Center(
                    child: Text(
                      'سالنی یافت نشد',
                      style: BoyaTypography.body,
                    ),
                  );
                }
                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: salons.length,
                  itemBuilder: (context, index) {
                    final salon = salons[index];
                    return BoyaSalonCard(
                      name: salon.name,
                      district: salon.cityName.isNotEmpty ? salon.cityName : salon.provinceName,
                      coverUrl: salon.imageUrl,
                      rating: salon.rating,
                      reviewsCount: salon.reviewCount,
                      isApproved: false,
                      onBookTapped: () => context.push('/salon/${salon.id}'),
                    );
                  },
                );
              },
              loading: () => const Center(
                child: CircularProgressIndicator(color: BoyaColors.primary),
              ),
              error: (_, _) => Center(
                child: Text(
                  'خطا در دریافت اطلاعات',
                  style: BoyaTypography.body,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Maps a category slug to a human-readable label. If the slug is unknown,
  /// it falls back to the slug itself.
  String _categoryDisplayName(String slug) {
    final displayNames = <String, String>{
      'hair': 'موی و آرایش',
      'nails': 'ناخن',
      'skin': 'پوست و زیبایی',
      'eyelash': 'مژه و ابرو',
      'massage': 'ماساژ و استرخاء',
      'makeup': 'آرایش و عروس',
      'beard': 'ریش و موهای صورت',
      'spa': 'اسپا و حمام',
      'epilation': 'ازالة مو',
      'cosmetics': 'میدیکال استتیک',
    };
    return displayNames[slug] ?? slug;
  }
}
