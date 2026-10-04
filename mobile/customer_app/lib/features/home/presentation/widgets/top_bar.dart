import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../notifications/data/notifications_api.dart';
import '../../application/home_providers.dart';

/// White header of the home screen: city picker and notification bell on top,
/// then the "انتخاب آدرس" pill.
class HomeTopBar extends ConsumerWidget {
  const HomeTopBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final city = ref.watch(homeCityProvider);
    // Signed out there is no session to count against and the endpoint answers
    // 401, so the badge is simply absent rather than showing a stale zero.
    final unread = ref.watch(unreadCountProvider).value ?? 0;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: BoyaColors.surface,
        boxShadow: [
          BoxShadow(
            color: BoyaColors.ink.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
              child: Row(
                children: [
                  // In RTL the first child renders on the right edge, so the city
                  // pill sits on the right and the notification bell on the left.
                  InkWell(
                    borderRadius: BorderRadius.circular(20),
                    onTap: () => _showCityPicker(context, ref),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.keyboard_arrow_down,
                            size: 18,
                            color: BoyaColors.inkMuted,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            city,
                            style: BoyaTypography.caption.copyWith(
                              color: BoyaColors.ink,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.location_on_outlined, size: 18, color: BoyaColors.primary),
                        ],
                      ),
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: () => context.push('/notifications'),
                    tooltip: 'اعلان‌ها',
                    icon: Badge(
                      isLabelVisible: unread > 0,
                      backgroundColor: BoyaColors.error,
                      label: Text(
                        // Above 99 the exact number stops being readable at
                        // badge size; the ceiling is what the eye compares.
                        unread > 99 ? '۹۹+' : toPersianDigits(unread),
                        style: BoyaTypography.overline.copyWith(color: BoyaColors.white),
                      ),
                      child: const Icon(Icons.notifications_outlined, color: BoyaColors.ink),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 2, bottom: 10),
              child: Center(
                child: Material(
                  color: BoyaColors.primarySubtle,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(24),
                    onTap: () {},
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.keyboard_arrow_down, size: 16, color: BoyaColors.primary),
                          const SizedBox(width: 6),
                          Text(
                            'انتخاب آدرس',
                            style: BoyaTypography.overline.copyWith(
                              color: BoyaColors.primary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> _showCityPicker(BuildContext context, WidgetRef ref) async {
  final selected = await showModalBottomSheet<String>(
    context: context,
    backgroundColor: BoyaColors.surface,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetContext) {
      String searchQuery = '';
      return StatefulBuilder(
        builder: (context, setState) {
          final filteredCities = searchQuery.isEmpty
              ? homeCities
              : homeCities.where((city) => city.name.contains(searchQuery)).toList();
          return SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 16),
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: BoyaColors.inkMuted.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 16),
                Text('انتخاب شهر', style: BoyaTypography.title),
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: TextField(
                    onChanged: (value) => setState(() => searchQuery = value.trim()),
                    decoration: InputDecoration(
                      hintText: 'جستجوی شهر...',
                      hintStyle: BoyaTypography.body.copyWith(color: BoyaColors.inkMuted),
                      prefixIcon: const Icon(Icons.search, color: BoyaColors.inkMuted),
                      filled: true,
                      fillColor: BoyaColors.cream,
                      contentPadding: const EdgeInsets.symmetric(vertical: 12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Flexible(
                  child: filteredCities.isEmpty
                      ? const Padding(
                          padding: EdgeInsets.all(24),
                          child: Center(
                            child: Text('شهری یافت نشد', style: BoyaTypography.body),
                          ),
                        )
                      : ListView.builder(
                          shrinkWrap: true,
                          itemCount: filteredCities.length,
                          itemBuilder: (context, index) {
                            final city = filteredCities[index];
                            return ListTile(
                              title: Text(city.name, style: BoyaTypography.body),
                              trailing: city.name == ref.read(homeCityProvider)
                                  ? const Icon(Icons.check, color: BoyaColors.primary)
                                  : null,
                              onTap: () => Navigator.of(sheetContext).pop(city.name),
                            );
                          },
                        ),
                ),
                const SizedBox(height: 8),
              ],
            ),
          );
        },
      );
    },
  );
  if (selected != null) ref.read(homeCityProvider.notifier).select(selected);
}
