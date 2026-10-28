import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../salon/data/salon_api.dart';
import '../../../salon/domain/available_slot.dart';
import '../../../salon/domain/salon_detail.dart';
import '../../../location/domain/customer_address.dart';
import '../../../location/presentation/address_picker_sheet.dart';
import 'booking_choices.dart';
import 'jalali_date_picker_card.dart';
import 'slot_grid.dart';

class BookingForm extends ConsumerStatefulWidget {
  const BookingForm({
    required this.salon,
    required this.services,
    required this.servicesLoading,
    required this.specialistId,
    required this.serviceId,
    required this.date,
    required this.selectedSlot,
    required this.onSpecialist,
    required this.onService,
    required this.onDate,
    required this.onSlot,
    required this.isMobile,
    required this.address,
    required this.onMobile,
    required this.onAddress,
    super.key,
  });

  final SalonDetail salon;

  /// The service picker's list. It is the salon catalogue until a specialist is
  /// chosen, then narrows to that specialist's assigned services
  /// (`specialist_services`) â€” a specialist may only be booked for what the
  /// salon assigned them.
  final List<SalonService> services;

  /// True while a specialist's services are being fetched, so the empty state
  /// can be withheld until the list has actually arrived.
  final bool servicesLoading;

  final String? specialistId;
  final String? serviceId;
  final DateTime date;
  final AvailableSlot? selectedSlot;
  final ValueChanged<String> onSpecialist;
  final ValueChanged<String> onService;
  final ValueChanged<DateTime> onDate;
  final ValueChanged<AvailableSlot> onSlot;

  /// ADR-011: whether the customer asked for the visit at their own place.
  final bool isMobile;

  /// ADR-011: the address the specialist travels to (decision 6 - picked,
  /// not typed). Owned by the screen so it survives slot changes and
  /// rebuilds.
  final CustomerAddress? address;

  /// Toggles [isMobile]; the screen validates the address on submit.
  final ValueChanged<bool> onMobile;

  /// Reports the picked [CustomerAddress] back to the screen.
  final ValueChanged<CustomerAddress?> onAddress;

  @override
  ConsumerState<BookingForm> createState() => _BookingFormState();
}

class _BookingFormState extends ConsumerState<BookingForm> {
  /// `(service travels, specialist travels)`, or `null` until both are picked.
  (bool, bool)? get _mobilePair {
    final service = widget.services.cast<SalonService?>().firstWhere(
          (it) => it?.id == widget.serviceId,
          orElse: () => null,
        );
    final specialist = widget.salon.specialists.cast<SalonSpecialist?>().firstWhere(
          (it) => it?.id == widget.specialistId,
          orElse: () => null,
        );
    if (service == null || specialist == null) return null;
    return (service.isMobileAvailable, specialist.offersMobileService);
  }
  @override
  Widget build(BuildContext context) {
    final showCalendar = widget.specialistId != null && widget.serviceId != null;
    // Picking a date in step 3 refetches the real slots for step 4: the
    // provider is keyed by the civil day, service and specialist.
    final slotsAsync = showCalendar
        ? ref.watch(
            availableSlotsProvider((
              salonId: widget.salon.id,
              date: DateTime(widget.date.year, widget.date.month, widget.date.day),
              serviceId: widget.serviceId!,
              specialistId: widget.specialistId,
            )),
          )
        : null;

    // ADR-011: the contract requires *both* the service and the specialist to
    // travel. Falsy until both picks exist so the toggle can never be flipped
    // for a pair the backend would reject with آ«ط§غŒظ† ط®ط¯ظ…طھ ط¨ظ‡â€Œطµظˆط±طھ ط³غŒط§ط± ط§ط±ط§ط¦ظ‡ ظ†ظ…غŒâ€Œط´ظˆط¯آ».
    final mobile = _mobilePair;
    final canOfferMobile = mobile?.$1 == true && mobile?.$2 == true;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('غ±. ط§ظ†طھط®ط§ط¨ ظ…طھط®طµطµ', style: BoyaTypography.title),
        const SizedBox(height: 8),
        for (final specialist in widget.salon.specialists)
          BookingChoice(
            title: specialist.fullName,
            selected: widget.specialistId == specialist.id,
            onTap: () => widget.onSpecialist(specialist.id),
          ),
        const SizedBox(height: 24),
        Text('غ². ط§ظ†طھط®ط§ط¨ ط®ط¯ظ…طھ', style: BoyaTypography.title),
        const SizedBox(height: 8),
        // The list is the specialist's assigned services once one is picked â€”
        // never the whole salon catalogue â€” so the customer cannot choose a
        // pair the salon never defined and the backend would refuse.
        if (widget.servicesLoading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
          )
        else if (widget.services.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text(
              widget.specialistId == null
                  ? 'ط®ط¯ظ…طھغŒ ط«ط¨طھ ظ†ط´ط¯ظ‡ ط§ط³طھ'
                  : 'ط¨ط±ط§غŒ ط§غŒظ† ظ…طھط®طµطµ ظ‡ظ†ظˆط² ط®ط¯ظ…طھغŒ طھط¹ط±غŒظپ ظ†ط´ط¯ظ‡ ط§ط³طھ.',
              style: BoyaTypography.body,
            ),
          )
        else
          for (final service in widget.services)
            BookingChoice(
              title: service.name,
              trailing: formatPrice(service.price),
              selected: widget.serviceId == service.id,
              onTap: () => widget.onService(service.id),
            ),
        if (showCalendar) ...[
          const SizedBox(height: 24),
          Text('غ³. ط§ظ†طھط®ط§ط¨ طھط§ط±غŒط®', style: BoyaTypography.title),
          const SizedBox(height: 8),
          JalaliDatePickerCard(
            selectedDate: widget.date,
            onDateSelected: widget.onDate,
            salonId: widget.salon.id,
            serviceId: widget.serviceId!,
            specialistId: widget.specialistId,
          ),
          const SizedBox(height: 24),
          Text('غ´. ط§ظ†طھط®ط§ط¨ ط³ط§ط¹طھ', style: BoyaTypography.title),
          const SizedBox(height: 8),
          SlotGrid(slots: slotsAsync!, date: widget.date, selectedSlot: widget.selectedSlot, onSlot: widget.onSlot),
          const SizedBox(height: 24),
          _MobileSection(
            enabled: canOfferMobile,
            isMobile: widget.isMobile,
            address: widget.address,
            onMobile: widget.onMobile,
            onAddress: widget.onAddress,
            reason: switch (mobile) {
              (true, false) => 'ط§غŒظ† ظ…طھط®طµطµ ط®ط¯ظ…ط§طھ ط³غŒط§ط± ط§ط±ط§ط¦ظ‡ ظ†ظ…غŒâ€Œط¯ظ‡ط¯',
              (false, _) => 'ط§غŒظ† ط®ط¯ظ…طھ ط¨ظ‡â€Œطµظˆط±طھ ط³غŒط§ط± ط§ط±ط§ط¦ظ‡ ظ†ظ…غŒâ€Œط´ظˆط¯',
              _ => null,
            },
          ),
        ],
        const SizedBox(height: 100),
      ],
    );
  }
}


/// The ADR-011 آ«ط®ط¯ظ…طھ ط¯ط± ظ…ط­ظ„ ظ…ظ†آ» toggle and the address it unlocks.
class _MobileSection extends StatelessWidget {
  const _MobileSection({
    required this.enabled,
    required this.isMobile,
    required this.address,
    required this.onMobile,
    required this.onAddress,
    required this.reason,
  });

  /// Whether the picked pair can actually travel.
  final bool enabled;

  /// Whether the toggle is currently on.
  final bool isMobile;

  /// The picked address (or null); renders as the picker row's text.
  final CustomerAddress? address;
  final ValueChanged<bool> onMobile;
  final ValueChanged<CustomerAddress?> onAddress;

  /// The exact backend message shown when the pair cannot travel, or `null`
  /// while the section is still waiting for the two picks.
  final String? reason;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('غµ. ظ…ط­ظ„ ط§ط¬ط±ط§', style: BoyaTypography.title),
        const SizedBox(height: 8),
        Card(
          color: BoyaColors.surface,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: isMobile ? BoyaColors.primary : BoyaColors.line),
          ),
          child: Column(
            children: [
              // Disabled on purpose when the pair cannot travel: an on-site
              // request would be rejected by the backend, so the customer is
              // steered back to picking another specialist or service.
              SwitchListTile(
                value: enabled && isMobile,
                onChanged: enabled ? onMobile : null,
                // ignore: deprecated_member_use
                activeColor: BoyaColors.primary,
                title: const Text('ط®ط¯ظ…طھ ط¯ط± ظ…ط­ظ„ ظ…ظ†', style: BoyaTypography.body),
                subtitle: enabled
                    ? null
                    : Text(
                        // A null subtitle would still take its slot's height, so
                        // the placeholder message is always present.
                        reason ?? 'ط§ط¨طھط¯ط§ ظ…طھط®طµطµ ظˆ ط®ط¯ظ…طھ ط±ط§ ط§ظ†طھط®ط§ط¨ ع©ظ†غŒط¯',
                        style: BoyaTypography.overline.copyWith(color: BoyaColors.inkMuted),
                      ),
              ),
              if (enabled && isMobile) ...[
                const Divider(height: 1, color: BoyaColors.line),
                _AddressField(
                  address: address,
                  onChanged: onAddress,
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// On-site address: a picker row (decision 6 - no manual text entry).
/// The customer selects a saved address or drops a pin on the map.
/// Addresses live only inside the booking form (decision 9).
class _AddressField extends StatelessWidget {
  const _AddressField({this.address, required this.onChanged});
  final CustomerAddress? address;
  final ValueChanged<CustomerAddress?> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final hasAddress = address != null;
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Pickable row: saved address text, or a call-to-action tile.
          InkWell(
            onTap: () {
              showModalBottomSheet<CustomerAddress?>(
                context: context,
                isScrollControlled: true,
                useSafeArea: true,
                builder: (context) => const AddressPickerSheet(),
              ).then((picked) {
                if (picked != null && context.mounted) {
                  onChanged(picked);
                }
              });
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  Icon(
                    hasAddress ? Icons.location_pin : Icons.location_on,
                    color: hasAddress
                        ? theme.colorScheme.primary
                        : theme.colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      hasAddress
                          ? address!.address
                          : 'ط¢ط¯ط±ط³ ظ…ط´طھط±غŒ ط±ط§ ط§ظ†طھط®ط§ط¨ ع©ظ†غŒط¯',
                      style: BoyaTypography.body.copyWith(
                        color: hasAddress
                            ? BoyaColors.ink
                            : BoyaColors.inkMuted,
                      ),
                    ),
                  ),
                  const Icon(Icons.chevron_left, size: 18),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          // ADR-011: on-site visits settle in cash when the specialist
          // arrives, so the customer is told up front.
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: BoyaColors.primarySubtle,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.payments_outlined, size: 14, color: BoyaColors.primary),
                SizedBox(width: 6),
                Text('ظ¾ط±ط¯ط§ط®طھ ط¯ط± ظ…ط­ظ„', style: BoyaTypography.overline),
              ],
            ),
          ),
        ],
      ),
    );
  }
}




