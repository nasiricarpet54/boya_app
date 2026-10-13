import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/boya_app_bar.dart';
import '../data/faq_content.dart';

/// Full FAQ, grouped by category, every question expandable.
///
/// Reads [faqProvider]; a parse failure shows a retry rather than an empty list,
/// so the support page never silently looks like an empty knowledge base.
class FaqScreen extends ConsumerWidget {
  const FaqScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final faqAsync = ref.watch(faqProvider);
    return Scaffold(
      backgroundColor: BoyaColors.cream,
      appBar: const BoyaAppBar(title: 'سوالات متداول'),
      body: faqAsync.when(
        data: (categories) {
          if (categories.isEmpty) {
            return const Center(
              child: Text('هنوز سوالی ثبت نشده است', style: BoyaTypography.body),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: categories.length,
            itemBuilder: (context, index) => _FaqGroup(category: categories[index]),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
        error: (_, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('بارگذاری سوالات متداول ناموفق بود', style: BoyaTypography.body),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () => ref.invalidate(faqProvider),
                icon: const Icon(Icons.refresh),
                label: const Text('تلاش دوباره'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FaqGroup extends StatelessWidget {
  const _FaqGroup({required this.category});

  final FaqCategory category;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(category.title, style: BoyaTypography.title),
          ),
          Card(
            color: BoyaColors.surface,
            elevation: 1,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Column(
              children: [
                for (final item in category.questions)
                  ExpansionTile(
                    tilePadding: const EdgeInsets.symmetric(horizontal: 16),
                    title: Text(item.question, style: BoyaTypography.body.copyWith(fontSize: 14)),
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                        child: Align(
                          alignment: Alignment.centerRight,
                          child: Text(item.answer, style: BoyaTypography.caption),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
