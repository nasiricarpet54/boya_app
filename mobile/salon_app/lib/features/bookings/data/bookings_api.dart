import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/booking_summary.dart';

/// Reads and acts on the salon panel's bookings.
///
/// Token-protected, so the interceptor attaches the bearer header; the tenant
/// always comes from the JWT on the backend, never from these arguments.
class BookingsApi {
  BookingsApi(this._dio);

  final Dio _dio;

  /// One page of the panel's bookings.
  ///
  /// Every filter is nullable and omitted when unset, so "no filter" and
  /// "filter by everything" are the same request. `status`/`date`/`from`/`to`
  /// go out as the backend's own names, with `specialistId` narrowed to the
  /// current role's scope server-side.
  Future<BookingPage> listBookings({
    BookingStatus? status,
    String? date,
    String? from,
    String? to,
    String? specialistId,
    int page = 1,
    int limit = 50,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/salon/me/bookings',
      queryParameters: <String, dynamic>{
        if (status?.wire != null) 'status': status?.wire,
        if (date != null) 'date': date,
        if (from != null) 'from': from,
        if (to != null) 'to': to,
        if (specialistId != null) 'specialistId': specialistId,
        'page': page,
        'limit': limit,
      },
    );
    return BookingPage.fromJson(response.data ?? const {});
  }

  /// One booking, with the salon's working hours and settings.
  Future<BookingDetail> getBooking(String id) async {
    final response = await _dio.get<Map<String, dynamic>>('/salon/me/bookings/$id');
    return BookingDetail.fromJson(response.data ?? const {});
  }

  /// Confirms a pending booking.
  Future<BookingDetail> approve(String id) => _action(id, 'approve');

  /// Declines a pending booking. [reason] is mandatory and is the text the
  /// customer is shown, so the screen collects it before calling.
  Future<BookingDetail> reject(String id, String reason) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/salon/me/bookings/$id/reject',
      data: <String, dynamic>{'reason': reason},
    );
    return BookingDetail.fromJson(response.data ?? const {});
  }

  /// Marks a confirmed booking as done.
  Future<BookingDetail> markVisited(String id) => _action(id, 'mark-visited');

  /// Writes off a confirmed booking as a no-show. The backend refuses this
  /// before the slot has started, so the button is hidden until then.
  Future<BookingDetail> noShow(String id) => _action(id, 'no-show');

  /// All four actions answer with the refreshed booking, so the screen updates
  /// from the response rather than guessing the new status locally — the one
  /// the database actually holds is the only one worth showing.
  Future<BookingDetail> _action(String id, String action) async {
    final response = await _dio.post<Map<String, dynamic>>('/salon/me/bookings/$id/$action');
    return BookingDetail.fromJson(response.data ?? const {});
  }
}

final bookingsApiProvider = Provider<BookingsApi>(
  (ref) => BookingsApi(ref.watch(dioProvider)),
);

  /// The filter tabs and the page number of the bookings list.
///
/// Keyed on the whole [BookingsQuery] so changing any field re-fetches: the
/// backend applies status, window and specialist together, and a partial
/// invalidation would show counts from one window above rows from another.
final bookingsProvider = FutureProvider.autoDispose.family<BookingPage, BookingsQuery>(
  (ref, query) => ref.watch(bookingsApiProvider).listBookings(
        status: query.status,
        date: query.date,
        from: query.from,
        to: query.to,
        specialistId: query.specialistId,
        page: query.page,
      ),
);

/// One booking, by id.
///
/// `autoDispose` so leaving the detail screen drops the row; the writes below
/// refresh it instead, which keeps the actions and the display in step.
final bookingDetailProvider = FutureProvider.autoDispose
    .family<BookingDetail, String>((ref, id) => ref.watch(bookingsApiProvider).getBooking(id));

/// What the bookings list is filtered by. Immutable so it can key the
/// provider family above.
class BookingsQuery {
  const BookingsQuery({
    this.status,
    this.date,
    this.from,
    this.to,
    this.specialistId,
    this.page = 1,
  });

  /// No filter at all: every booking the caller's role can see.
  const BookingsQuery.all()
      : status = null,
        date = null,
        from = null,
        to = null,
        specialistId = null,
        page = 1;

  /// [status] alone, which is what tapping a filter tab asks for.
  BookingsQuery.withStatus(this.status)
      : date = null,
        from = null,
        to = null,
        specialistId = null,
        page = 1;

  final BookingStatus? status;

  /// One calendar day, `YYYY-MM-DD`. Wins over [from]/[to].
  final String? date;
  final String? from;
  final String? to;
  final String? specialistId;
  final int page;

  /// Switching any filter returns to page 1: page 3 of a wider window is not a
  /// sensible place to land when the filter changed.
  ///
  /// Only [page] carries forward from the receiver — a filter argument, unlike
  /// a page number, is written deliberately here — and clearing any field
  /// likewise falls back to page 1 for the same reason.
  BookingsQuery copyWith({
    BookingStatus? status,
    String? date,
    String? from,
    String? to,
    String? specialistId,
    int? page,
    bool clearStatus = false,
    bool clearDate = false,
    bool clearRange = false,
    bool clearSpecialist = false,
  }) =>
      BookingsQuery(
        status: clearStatus ? null : (status ?? this.status),
        date: clearDate ? null : (date ?? this.date),
        from: clearRange ? null : (from ?? this.from),
        to: clearRange ? null : (to ?? this.to),
        specialistId: clearSpecialist ? null : (specialistId ?? this.specialistId),
        page: page ?? 1,
      );
}