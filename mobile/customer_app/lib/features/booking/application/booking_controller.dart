import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../profile/domain/booking_record.dart';
import '../domain/booking_draft.dart';

/// The draft the form is building plus the row the backend saved for it.
class BookingState {
  const BookingState({this.draft, this.record, this.isSubmitting = false});

  final BookingDraft? draft;

  /// What `POST /bookings` returned; null before a successful submit.
  final BookingRecord? record;

  /// True while a submit request is in flight.
  final bool isSubmitting;
}

class BookingController extends Notifier<BookingState> {
  @override
  BookingState build() => const BookingState();

  void save(BookingDraft draft) => state = BookingState(draft: draft, record: state.record);

  /// Sends the saved draft to `POST /bookings` and keeps the created row in
  /// [BookingState.record]. Rethrows on failure so the screen can surface the
  /// backend's message.
  Future<BookingRecord> submit() async {
    final draft = state.draft;
    if (draft == null) throw StateError('رزروی برای ثبت وجود ندارد');
    state = BookingState(draft: draft, record: state.record, isSubmitting: true);
    try {
      final Dio dio = ref.read(dioProvider);
      final response = await dio.post<Map<String, dynamic>>(
        '/bookings',
        data: {
          'specialistId': draft.specialistId,
          'serviceId': draft.serviceId,
          'startsAt': (draft.slotStart ?? draft.date).toUtc().toIso8601String(),
          if (draft.notes != null && draft.notes!.isNotEmpty) 'notes': draft.notes,
          // ADR-011: on-site flags. The backend drops an address that arrives
          // without isMobile, so the fields travel together.
          if (draft.isMobile) ...{
            'isMobile': true,
            'customerAddress': draft.customerAddress,
            if (draft.customerLatitude != null) 'customerLatitude': draft.customerLatitude,
            if (draft.customerLongitude != null) 'customerLongitude': draft.customerLongitude,
          },
        },
      );
      final record = BookingRecord.fromJson(response.data ?? const <String, dynamic>{});
      state = BookingState(draft: draft, record: record);
      return record;
    } catch (_) {
      state = BookingState(draft: draft, record: state.record);
      rethrow;
    }
  }
}

final bookingProvider = NotifierProvider<BookingController, BookingState>(BookingController.new);
