import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import '../../../location/domain/customer_address.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../shared/widgets/boya_app_bar.dart';
import '../../../salon/data/salon_api.dart';
import '../../../salon/domain/available_slot.dart';
import '../../../salon/domain/salon_detail.dart';
import '../../../salon/domain/specialist_service.dart';
import '../../application/booking_controller.dart';
import '../../domain/booking_draft.dart';
import '../widgets/booking_bar.dart';
import '../widgets/booking_confirm_dialog.dart';
import '../widgets/booking_form.dart';

class BookingScreen extends ConsumerStatefulWidget {
  const BookingScreen({
    required this.salonId,
    this.initialSpecialistId,
    this.initialServiceId,
    super.key,
  });

  final String salonId;

  /// Pre-selection handed over from the salon page's آ«ط®ط¯ظ…ط§طھ ظ‚ط§ط¨ظ„ ط§ط±ط§ط¦ظ‡آ»
  /// cards, so tapping ط±ط²ط±ظˆ on a specialist's service lands here with both
  /// picks already made instead of asking the customer to repeat them.
  final String? initialSpecialistId;
  final String? initialServiceId;

  @override
  ConsumerState<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends ConsumerState<BookingScreen> {
  String? _specialistId;
  String? _serviceId;
  DateTime _date = DateTime.now();
  AvailableSlot? _selectedSlot;

  @override
  void initState() {
    super.initState();
    _specialistId = widget.initialSpecialistId;
    _serviceId = widget.initialServiceId;
  }

  /// The services the booking form may offer. Before a specialist is picked
  /// that is the salon catalogue; after, it narrows to the services the salon
  /// *assigned to that specialist* (`specialist_services`) â€” picking another
  /// specialist empties the earlier service choice, because that choice
  /// belonged to someone else's list. `loading` separates "the list has not
  /// arrived yet" from "the specialist has nothing assigned", because only the
  /// second deserves the empty-state message.
  ({List<SalonService> services, bool loading}) _bookableServices(SalonDetail salon) {
    final specialistId = _specialistId;
    if (specialistId == null) {
      return (services: salon.services, loading: false);
    }
    final async = ref.watch(
      specialistServicesProvider((salonId: widget.salonId, specialistId: specialistId)),
    );
    final assigned = async.valueOrNull ?? const <SpecialistService>[];
    return (
      services: [
        for (final service in assigned)
          SalonService(
            id: service.serviceId,
            name: service.name,
            price: service.price,
            isMobileAvailable: service.isMobileAvailable,
          ),
      ],
      loading: async.isLoading,
    );
  }

  /// ADR-011: the customer wants the visit at their own place. Kept here rather
  /// than in the form so it survives rebuilds the form does not outlive.
  bool _isMobile = false;

  /// ADR-011: the on-site address. Kept here as well so re-picking a slot does
  /// not discard what the customer typed.
  CustomerAddress? _address;

  @override
  Widget build(BuildContext context) {
    final salonAsync = ref.watch(salonDetailProvider(widget.salonId));
    final bookingState = ref.watch(bookingProvider);
    return Scaffold(
      appBar: const BoyaAppBar(title: 'ط±ط²ط±ظˆ ظ†ظˆط¨طھ'),
      body: salonAsync.when(
        data: (salon) {
          final (:services, :loading) = _bookableServices(salon);
          return BookingForm(
            salon: salon,
            services: services,
            servicesLoading: loading,
            specialistId: _specialistId,
            serviceId: _serviceId,
            date: _date,
            selectedSlot: _selectedSlot,
            onSpecialist: (id) => setState(() {
              _specialistId = id;
              // The service pick belonged to the previous specialist's list, so
              // it cannot follow the customer into a new one â€” re-choosing is
              // the only honest option (specialist_services differ per person).
              _serviceId = null;
              _selectedSlot = null;
              // ADR-011: a specialist who does not travel invalidates the on-site
              // request, so the toggle is reset rather than left half-on.
              if (_isMobile && !salon.specialists.any((it) => it.id == id && it.offersMobileService)) {
                _isMobile = false;
              }
            }),
          onService: (id) => setState(() {
            _serviceId = id;
            _selectedSlot = null;
            // ADR-011: same reasoning as the specialist pick â€” a service that
            // stays in the salon cannot be delivered at the customer's place.
            // The lookup uses the (possibly specialist-filtered) list, not the
            // salon catalogue, so the flag tracks what the form is showing.
            if (_isMobile && !services.any((it) => it.id == id && it.isMobileAvailable)) {
              _isMobile = false;
            }
          }),
          onDate: (date) => setState(() {
            _date = date;
            _selectedSlot = null;
          }),
          onSlot: (slot) => setState(() => _selectedSlot = slot),
          isMobile: _isMobile,
          address: _address,
          onMobile: (value) => setState(() => _isMobile = value),
          onAddress: (value) => setState(() => _address = value),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
        error: (_, _) => const Center(child: Text('ط®ط·ط§ ط¯ط± ط¯ط±غŒط§ظپطھ ط§ط·ظ„ط§ط¹ط§طھ', style: BoyaTypography.body)),
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
    final (:services, loading: _) = _bookableServices(salon);
    for (final service in services) {
      if (service.id == _serviceId) return formatPrice(service.price);
    }
    return null;
  }

  Future<void> _confirm(SalonDetail salon) async {
    // No payment stage exists in Phase 1: the last step is a confirmation,
    // and the request is then left waiting for the salon's approval.
    final slotStart = _slotStart;
    if (slotStart == null) return;

    // ADR-011: the backend answers a missing on-site address with a 400, which
    // is worth stopping locally before the dialog is even shown.
    if (_isMobile && (_address?.address.trim() ?? '').isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('ط¢ط¯ط±ط³ ظ…ط´طھط±غŒ ط§ظ„ط²ط§ظ…غŒ ط§ط³طھ')),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => BookingConfirmDialog(
        salonName: salon.name,
        specialistName: _specialistName(salon),
        serviceName: _serviceName(salon),
        date: _date,
        price: _price(salon),
        time: formatJalaliTime(slotStart),
        isMobile: _isMobile,
        address: (_address?.address.trim() ?? ''),
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
        isMobile: _isMobile,
        customerAddress: _isMobile ? (_address?.address.trim() ?? '') : null,
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
    return 'ط§ظ†طھط®ط§ط¨ ظ†ط´ط¯ظ‡';
  }

  String _serviceName(SalonDetail salon) {
    final (:services, loading: _) = _bookableServices(salon);
    for (final service in services) {
      if (service.id == _serviceId) return service.name;
    }
    return 'ط§ظ†طھط®ط§ط¨ ظ†ط´ط¯ظ‡';
  }
}




