import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../salon/data/salon_api.dart';
import '../../../salon/domain/available_slot.dart';
import '../../../salon/domain/salon_detail.dart';
import 'booking_choices.dart';
import 'jalali_date_picker_card.dart';
import 'slot_grid.dart';

class BookingForm extends ConsumerWidget {
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final showCalendar = specialistId != null && serviceId != null;
    // Picking a date in step 3 refetches the real slots for step 4: the
    // provider is keyed by the civil day, service and specialist.
    final slotsAsync = showCalendar
        ? ref.watch(
            availableSlotsProvider((
              salonId: salon.id,
              date: DateTime(date.year, date.month, date.day),
              serviceId: serviceId!,
              specialistId: specialistId,
            )),
          )
        : null;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('۱. انتخاب متخصص', style: BoyaTypography.title),
        const SizedBox(height: 8),
        for (final specialist in salon.specialists)
          BookingChoice(
            title: specialist.fullName,
            selected: specialistId == specialist.id,
            onTap: () => onSpecialist(specialist.id),
          ),
        const SizedBox(height: 24),
        Text('۲. انتخاب خدمت', style: BoyaTypography.title),
        const SizedBox(height: 8),
        for (final service in salon.services)
          BookingChoice(
            title: service.name,
            trailing: formatPrice(service.price),
            selected: serviceId == service.id,
            onTap: () => onService(service.id),
          ),
        if (showCalendar) ...[
          const SizedBox(height: 24),
          Text('۳. انتخاب تاریخ', style: BoyaTypography.title),
          const SizedBox(height: 8),
          JalaliDatePickerCard(
            selectedDate: date,
            onDateSelected: onDate,
            salonId: salon.id,
            serviceId: serviceId!,
            specialistId: specialistId,
          ),
          const SizedBox(height: 24),
          Text('۴. انتخاب ساعت', style: BoyaTypography.title),
          const SizedBox(height: 8),
          SlotGrid(slots: slotsAsync!, date: date, selectedSlot: selectedSlot, onSlot: onSlot),
        ],
        const SizedBox(height: 100),
      ],
    );
  }
}
