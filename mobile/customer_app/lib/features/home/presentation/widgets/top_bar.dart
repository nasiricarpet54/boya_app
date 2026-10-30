import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import '../../../location/application/addresses_state.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../notifications/data/notifications_api.dart';
import '../../../location/application/city_provider.dart';
import '../../../location/presentation/address_picker_sheet.dart';
import '../../../location/presentation/city_picker_sheet.dart';

/// White header of the home screen: city picker and notification bell on top,
/// then the "انتخاب آدرس" pill.
class HomeTopBar extends ConsumerWidget {
  const HomeTopBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final city = ref.watch(cityProvider);
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
                    onTap: () => CityPickerSheet.show(context),
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
                            city.displayCityName ?? 'انتخاب شهر',
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
                    tooltip: '�������',
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
                    onTap: () => showModalBottomSheet<void>(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: BoyaColors.surface,
                      shape: const RoundedRectangleBorder(
                        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                      ),
                      builder: (sheetContext) => AddressPickerSheet(
                        // Wiring placeholder: full backend state (address list,
                        // selection) lands in a follow-up. Empty state copies live
                        // on the sheet itself, so the UI still reads correctly.
                        addresses: ref.watch(addressesProvider).addresses,
                        selectedId: ref.watch(addressesProvider).selectedId,
                        onSelect: (address) {
                          ref.read(addressesProvider.notifier).select(address);
                          Navigator.of(sheetContext).pop();
                        },
                      ),
                    ),
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
