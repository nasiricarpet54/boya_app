import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../shared/widgets/boya_app_bar.dart';
import '../../../salon/data/salon_api.dart';
import '../../../salon/domain/available_slot.dart';
import '../../../salon/domain/salon_detail.dart';
import '../../application/booking_controller.dart';
import '../../domain/booking_draft.dart';
import '../widgets/booking_bar.dart';
import '../widgets/booking_confirm_dialog.dart';
import '../widgets/booking_form.dart';

class BookingScreen extends ConsumerStatefulWidget {
  const BookingScreen({required this.salonId, super.key});

  final String salonId;

  @override
  ConsumerState<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends ConsumerState<BookingScreen> {
  String? _specialistId;
  String? _serviceId;
  DateTime _date = DateTime.now();
  AvailableSlot? _selectedSlot;

  @override
  Widget build(BuildContext context) {
    final salonAsync = ref.watch(salonDetailProvider(widget.salonId));
    final bookingState = ref.watch(bookingProvider);
    return Scaffold(
      appBar: const BoyaAppBar(title: 'رزرو نوبت'),
      body: salonAsync.when(
        data: (salon) => BookingForm(
          salon: salon,
          specialistId: _specialistId,
          serviceId: _serviceId,
          date: _date,
          selectedSlot: _selectedSlot,
          onSpecialist: (id) => setState(() {
            _specialistId = id;
            _selectedSlot = null;
          }),
          onService: (id) => setState(() {
            _serviceId = id;
            _selectedSlot = null;
          }),
          onDate: (date) => setState(() {
            _date = date;
            _selectedSlot = null;
          }),
          onSlot: (slot) => setState(() => _selectedSlot = slot),
        ),
        loading: () => const Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
        error: (_, _) => const Center(child: Text('خطا در دریافت اطلاعات', style: BoyaTypography.body)),
      ),
      bottomNavigationBar: salonAsync.maybeWhen(
        data: (salon) => BookingBar(
          ready: _ready && !bookingState.isSubmitting,
          price: _price(salon),
          onConfirm: () => _confirm(salon),
        ),
        orElse: () => const SizedBox.shrink(),
      ),
    );
  }

  bool get _ready =>
      _specialistId != null && _serviceId != null && !isFriday(_date) && _selectedSlot != null;

  /// The picked slot's `HH:MM` label combined with the picked civil day.
  DateTime? get _slotStart {
    final slot = _selectedSlot;
    if (slot == null) return null;
    final parts = slot.start.split(':');
    if (parts.length != 2) return null;
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) return null;
    return DateTime(_date.year, _date.month, _date.day, hour, minute);
  }

  String? _price(SalonDetail salon) {
    for (final service in salon.services) {
      if (service.id == _serviceId) return formatPrice(service.price);
    }
    return null;
  }

  Future<void> _confirm(SalonDetail salon) async {
    // No payment stage exists in Phase 1: the last step is a confirmation,
    // and the request is then left waiting for the salon's approval.
    final slotStart = _slotStart;
    if (slotStart == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => BookingConfirmDialog(
        salonName: salon.name,
        specialistName: _specialistName(salon),
        serviceName: _serviceName(salon),
        date: _date,
        price: _price(salon),
        time: formatJalaliTime(slotStart),
      ),
    );
    if (confirmed != true || !mounted) return;

    final controller = ref.read(bookingProvider.notifier);
    controller.save(
      BookingDraft(
        salonId: widget.salonId,
        specialistId: _specialistId!,
        serviceId: _serviceId!,
        date: _date,
        slotStart: slotStart,
      ),
    );
    try {
      await controller.submit();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(messageFromDio(error))),
      );
      return;
    }
    if (!mounted) return;
    context.push('/booking/success');
  }

  String _specialistName(SalonDetail salon) {
    for (final specialist in salon.specialists) {
      if (specialist.id == _specialistId) return specialist.fullName;
    }
    return 'انتخاب نشده';
  }

  String _serviceName(SalonDetail salon) {
    for (final service in salon.services) {
      if (service.id == _serviceId) return service.name;
    }
    return 'انتخاب نشده';
  }
}
