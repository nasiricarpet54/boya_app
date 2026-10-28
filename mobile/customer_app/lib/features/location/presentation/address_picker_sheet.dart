import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../domain/customer_address.dart';

/// Bottom sheet: saved addresses + «افزودن آدرس جدید» tile.
///
/// Decision 9: the address UI is shown only inside the booking form.
/// Decision 6: no manual address text field — the customer selects a saved
/// address or picks a fresh one from the map (decision 7: full-screen
/// NeshanLocationPicker).
class AddressPickerSheet extends StatelessWidget {
  const AddressPickerSheet({
    super.key,
    required this.addresses,
    required this.selectedId,
    required this.onSelect,
    required this.onCreate,
    required this.onUpdateTitle,
    required this.enabled,
  });

  final List<CustomerAddress> addresses;
  final String? selectedId;
  final ValueChanged<CustomerAddress> onSelect;
  final Future<void> Function(String title, String address) onCreate;
  final ValueChanged<CustomerAddress> onUpdateTitle;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: const BorderRadius.vertical(topRadius: 20),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            container(
              height: 6,
              color: theme.colorScheme.primary.withValues(alpha: 0.16),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Text(
                'آدرس مورد نظر',
                style: BoyaTypography.headlineMedium,
              ),
            ),
            const SizedBox(height: 4),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: IntrinsicHeight(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (addresses.isEmpty)
                      const Padding(
                        padding: EdgeInsets.all(12),
                        child: Text(
                          'هنوز آدرس ذخیره‌شده‌ای ندارید. دکمه «افزودن آدرس جدید» را بزنید.',
                          style: BoyaTypography.body,
                        ),
                      ),
                    for (final address in addresses)
                      ListTile(
                        onTap: enabled ? () => onSelect(address) : null,
                        leading: container(
                          width: 6,
                          height: 6,
                          color: address.isDefault
                              ? theme.colorScheme.primary
                              : theme.colorScheme.surface,
                        ),
                        title: Text(address.title),
                        subtitle: Text(address.address),
                        trailing: address.isDefault
                            ? const Icon(Icons.check_circle,
                            color: BoyaColors.primary)
                            : null,
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            ListTile(
              onTap: enabled
                  ? () => context.router.push('/booking/address/new')
                  : null,
              leading: const Icon(Icons.add_location,
              color: BoyaColors.primary),
              title: const Text('افزودن آدرس جدید'),
              trailing: const Icon(Icons.chevron_right),
            ),
          ],
        ),
      ),
    );
  }
}
