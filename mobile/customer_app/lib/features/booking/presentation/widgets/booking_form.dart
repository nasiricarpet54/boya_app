import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../salon/data/salon_api.dart';
import '../../../salon/domain/available_slot.dart';
import '../../../salon/domain/salon_detail.dart';
import 'booking_choices.dart';
import 'jalali_date_picker_card.dart';
import 'slot_grid.dart';

class BookingForm extends ConsumerStatefulWidget {
  const BookingForm({
    required this.salon,
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

  /// ADR-011: the address the specialist travels to. Owned by the screen so it
  /// survives slot changes and rebuilds.
  final String address;

  /// Toggles [isMobile]; the screen validates the address on submit.
  final ValueChanged<bool> onMobile;

  /// Updates [address] on every keystroke.
  final ValueChanged<String> onAddress;

  @override
  ConsumerState<BookingForm> createState() => _BookingFormState();
}

class _BookingFormState extends ConsumerState<BookingForm> {
  late final TextEditingController _addressController;
  final _addressFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    _addressController = TextEditingController(text: widget.address);
  }

  @override
  void didUpdateWidget(covariant BookingForm oldWidget) {
    super.didUpdateWidget(oldWidget);
    // External changes (a stored draft) should land in the field, but a typing
    // loop has to be avoided: a controller rebuild on every keystroke resets
    // the caret to the end and makes Persian composition behave oddly.
    if (oldWidget.address != widget.address && _addressController.text != widget.address) {
      _addressController.text = widget.address;
    }
  }

  @override
  void dispose() {
    _addressController.dispose();
    _addressFocus.dispose();
    super.dispose();
  }

  /// `(service travels, specialist travels)`, or `null` until both are picked.
  (bool, bool)? get _mobilePair {
    final service = widget.salon.services.cast<SalonService?>().firstWhere(
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
    // for a pair the backend would reject with «این خدمت به‌صورت سیار ارائه نمی‌شود».
    final mobile = _mobilePair;
    final canOfferMobile = mobile?.$1 == true && mobile?.$2 == true;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('۱. انتخاب متخصص', style: BoyaTypography.title),
        const SizedBox(height: 8),
        for (final specialist in widget.salon.specialists)
          BookingChoice(
            title: specialist.fullName,
            selected: widget.specialistId == specialist.id,
            onTap: () => widget.onSpecialist(specialist.id),
          ),
        const SizedBox(height: 24),
        Text('۲. انتخاب خدمت', style: BoyaTypography.title),
        const SizedBox(height: 8),
        for (final service in widget.salon.services)
          BookingChoice(
            title: service.name,
            trailing: formatPrice(service.price),
            selected: widget.serviceId == service.id,
            onTap: () => widget.onService(service.id),
          ),
        if (showCalendar) ...[
          const SizedBox(height: 24),
          Text('۳. انتخاب تاریخ', style: BoyaTypography.title),
          const SizedBox(height: 8),
          JalaliDatePickerCard(
            selectedDate: widget.date,
            onDateSelected: widget.onDate,
            salonId: widget.salon.id,
            serviceId: widget.serviceId!,
            specialistId: widget.specialistId,
          ),
          const SizedBox(height: 24),
          Text('۴. انتخاب ساعت', style: BoyaTypography.title),
          const SizedBox(height: 8),
          SlotGrid(slots: slotsAsync!, date: widget.date, selectedSlot: widget.selectedSlot, onSlot: widget.onSlot),
          const SizedBox(height: 24),
          _MobileSection(
            enabled: canOfferMobile,
            isMobile: widget.isMobile,
            address: widget.address,
            addressController: _addressController,
            addressFocus: _addressFocus,
            onMobile: widget.onMobile,
            onAddress: widget.onAddress,
            reason: switch (mobile) {
              (true, false) => 'این متخصص خدمات سیار ارائه نمی‌دهد',
              (false, _) => 'این خدمت به‌صورت سیار ارائه نمی‌شود',
              _ => null,
            },
          ),
        ],
        const SizedBox(height: 100),
      ],
    );
  }
}


/// The ADR-011 «خدمت در محل من» toggle and the address it unlocks.
class _MobileSection extends StatelessWidget {
  const _MobileSection({
    required this.enabled,
    required this.isMobile,
    required this.address,
    required this.addressController,
    required this.addressFocus,
    required this.onMobile,
    required this.onAddress,
    required this.reason,
  });

  /// Whether the picked pair can actually travel.
  final bool enabled;

  /// Whether the toggle is currently on.
  final bool isMobile;

  /// Current address text, shown as an error hint when the toggle is on but the
  /// field is empty.
  final String address;
  final TextEditingController addressController;
  final FocusNode addressFocus;
  final ValueChanged<bool> onMobile;
  final ValueChanged<String> onAddress;

  /// The exact backend message shown when the pair cannot travel, or `null`
  /// while the section is still waiting for the two picks.
  final String? reason;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('۵. محل اجرا', style: BoyaTypography.title),
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
                title: const Text('خدمت در محل من', style: BoyaTypography.body),
                subtitle: enabled
                    ? null
                    : Text(
                        // A null subtitle would still take its slot's height, so
                        // the placeholder message is always present.
                        reason ?? 'ابتدا متخصص و خدمت را انتخاب کنید',
                        style: BoyaTypography.overline.copyWith(color: BoyaColors.inkMuted),
                      ),
              ),
              if (enabled && isMobile) ...[
                const Divider(height: 1, color: BoyaColors.line),
                _AddressField(
                  controller: addressController,
                  focusNode: addressFocus,
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

/// The multi-line address field plus the two on-site affordances under it.
class _AddressField extends StatelessWidget {
  const _AddressField({
    required this.controller,
    required this.focusNode,
    required this.address,
    required this.onChanged,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final String address;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: controller,
            focusNode: focusNode,
            onChanged: onChanged,
            minLines: 2,
            maxLines: 4,
            textInputAction: TextInputAction.done,
            style: BoyaTypography.body.copyWith(color: BoyaColors.ink),
            decoration: InputDecoration(
              // Live: the field must turn red the moment the toggle is flipped
              // on without an address to travel to.
              errorText: address.trim().isEmpty ? 'آدرس مشتری الزامی است' : null,
              errorStyle: BoyaTypography.overline.copyWith(color: BoyaColors.error),
              hintText: 'آدرس کامل، پلاک و کد پستی',
              hintStyle: BoyaTypography.body.copyWith(color: BoyaColors.inkMuted),
              filled: true,
              fillColor: BoyaColors.cream,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: BoyaColors.line),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: BoyaColors.primary),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            ),
          ),
          const SizedBox(height: 8),
          // ADR-011: on-site visits are settled in cash when the specialist
          // arrives, so the customer is told up front.
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: BoyaColors.primarySubtle,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.payments_outlined, size: 14, color: BoyaColors.primary),
                const SizedBox(width: 6),
                Text(
                  'پرداخت در محل',
                  style: BoyaTypography.overline.copyWith(
                    color: BoyaColors.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // Dropping a pin is a Phase 2 concern; the button stays so the row
          // can ship without promising a map that is not wired up yet.
          TextButton.icon(
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('انتخاب از روی نقشه به‌زودی')),
            ),
            icon: const Icon(Icons.map_outlined, size: 16),
            label: const Text('انتخاب از روی نقشه'),
          ),
        ],
      ),
    );
  }
}