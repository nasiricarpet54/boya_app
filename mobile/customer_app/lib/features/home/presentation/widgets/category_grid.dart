import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../application/home_providers.dart';
import '../../domain/service_category.dart';

/// Two-row horizontally scrolling category grid.
class CategoryGrid extends ConsumerWidget {
  const CategoryGrid({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categories = ref.watch(homeCategoriesProvider).asData?.value ?? const [];
    return SizedBox(
      height: 172,
      child: GridView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          // For a horizontal grid this is the number of rows.
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 8,
          childAspectRatio: 0.8,
        ),
        itemCount: categories.length,
        itemBuilder: (context, index) => _CategoryCell(
          categories[index],
          onTap: () => context.push('/search?category=${categories[index].id}'),
        ),
      ),
    );
  }
}

class _CategoryCell extends StatelessWidget {
  const _CategoryCell(this.category, {required this.onTap});

  final ServiceCategory category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 60,
            height: 60,
            child: Material(
              color: BoyaColors.primarySubtle,
              borderRadius: BorderRadius.circular(18),
              child: Center(child: Text(category.emoji, style: const TextStyle(fontSize: 26))),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            category.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: BoyaTypography.overline.copyWith(fontSize: 10, color: BoyaColors.ink),
          ),
        ],
      ),
    );
  }
}
