/// The six statuses `bookings.status` can hold.
///
/// Kept as its own type rather than a bare `String` so the switch statements
/// that decide which action buttons a screen offers are exhaustive: adding a
/// status to the backend without handling it here is a compile error, not a
/// card that quietly shows no buttons.
enum BookingStatus {
  pending('pending', 'در انتظار تایید'),
  confirmed('confirmed', 'تایید‌شده'),
  completed('completed', 'انجام‌شده'),
  reviewed('reviewed', 'نظر ثبت‌شده'),
  cancelled('cancelled', 'لغو‌شده'),
  noShow('no_show', 'عدم مراجعه');

  const BookingStatus(this.wire, this.label);

  /// The value `bookings.status` holds.
  final String wire;

  /// Persian label for the filter tabs and the badge.
  final String label;

  /// Parses the wire value, falling back to [BookingStatus.pending].
  ///
  /// The fallback is deliberate: an unknown status is not an error the salon
  /// staff can act on, and showing the booking as still-pending keeps the row
  /// visible (and its approve button honest about needing a refresh) instead
  /// of dropping a customer's appointment off the screen.
  static BookingStatus fromWire(Object? value) {
    for (final status in BookingStatus.values) {
      if (status.wire == value) return status;
    }
    return BookingStatus.pending;
  }
}

/// One booking row of the salon panel's list, as returned by
/// `GET /salon/me/bookings`.
///
/// [startsAt] and [endsAt] are ISO instants, not a date string: the backend
/// resolves the stored `tstzrange` to `lower()`/`upper()` so the app formats
/// them in the salon timezone instead of the device's.
class BookingSummary {
  const BookingSummary({
    required this.id,
    required this.status,
    required this.startsAt,
    required this.endsAt,
    required this.totalPrice,
    required this.depositPaid,
    required this.createdAt,
    required this.customerId,
    this.customerName,
    this.customerPhone,
    this.specialistId,
    this.specialistName,
    this.serviceId,
    this.serviceName,
    this.lineId,
    this.notes,
  });

  factory BookingSummary.fromJson(Map<String, dynamic> json) => BookingSummary(
        id: '${json['id'] ?? ''}',
        status: BookingStatus.fromWire(json['status']),
        startsAt: DateTime.parse('${json['startsAt']}').toLocal(),
        endsAt: DateTime.parse('${json['endsAt']}').toLocal(),
        totalPrice: (json['totalPrice'] as num?)?.toInt() ?? 0,
        depositPaid: (json['depositPaid'] as num?)?.toInt() ?? 0,
        createdAt: DateTime.parse('${json['createdAt']}').toLocal(),
        customerId: '${json['customerId'] ?? ''}',
        customerName: json['customerName'] as String?,
        customerPhone: json['customerPhone'] as String?,
        specialistId: json['specialistId'] as String?,
        specialistName: json['specialistName'] as String?,
        serviceId: json['serviceId'] as String?,
        serviceName: json['serviceName'] as String?,
        lineId: json['lineId'] as String?,
        notes: json['notes'] as String?,
      );

  final String id;
  final BookingStatus status;
  final DateTime startsAt;
  final DateTime endsAt;

  /// Toman, as stored on the booking.
  final int totalPrice;

  /// What the customer actually paid up front — 0 for a walk-in or a booking
  /// made without a deposit, which is why the detail screen shows it apart
  /// from [totalPrice] rather than assuming they match.
  final int depositPaid;

  final DateTime createdAt;
  final String customerId;
  final String? customerName;
  final String? customerPhone;
  final String? specialistId;
  final String? specialistName;
  final String? serviceId;
  final String? serviceName;
  final String? lineId;
  final String? notes;

  /// Whether the panel may still approve or reject this booking.
  bool get isPending => status == BookingStatus.pending;

  /// Whether the visit can be marked done or written off as a no-show.
  ///
  /// The backend additionally refuses a no-show before the slot has started,
  /// so the screen hides the button early rather than letting the staff member
  /// press it and read a conflict.
  bool get isActionable =>
      status == BookingStatus.confirmed && !startsAt.isAfter(DateTime.now());

  /// What to call the customer in the list. Falls back to the phone number,
  /// then to a neutral placeholder, so a row is never nameless.
  String get customerLabel {
    final name = customerName;
    if (name != null && name.isNotEmpty) return name;
    final phone = customerPhone;
    if (phone != null && phone.isNotEmpty) return phone;
    return 'مشتری';
  }
}

/// One page of `GET /salon/me/bookings`.
///
/// [counts] covers the whole filtered window rather than the current page, so
/// the filter tabs can show «۱۲» next to «در انتظار تایید» without a second
/// request per tab. A status with no rows is present with a zero, not missing:
/// the tabs iterate the values, not the keys.
class BookingPage {
  const BookingPage({
    required this.data,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
    required this.counts,
  });

  factory BookingPage.fromJson(Map<String, dynamic> json) {
    final rawCounts = json['counts'];
    final map = rawCounts is Map<String, dynamic> ? rawCounts : const <String, dynamic>{};
    int count(String key) => (map[key] as num?)?.toInt() ?? 0;

    return BookingPage(
      data: [
        for (final item in json['data'] as List<dynamic>? ?? const [])
          if (item is Map<String, dynamic>) BookingSummary.fromJson(item),
      ],
      total: (json['total'] as num?)?.toInt() ?? 0,
      page: (json['page'] as num?)?.toInt() ?? 1,
      limit: (json['limit'] as num?)?.toInt() ?? 50,
      totalPages: (json['totalPages'] as num?)?.toInt() ?? 1,
      counts: BookingCounts(
        pending: count('pending'),
        confirmed: count('confirmed'),
        completed: count('completed'),
        reviewed: count('reviewed'),
        cancelled: count('cancelled'),
        noShow: count('noShow'),
      ),
    );
  }

  final List<BookingSummary> data;
  final int total;
  final int page;
  final int limit;
  final int totalPages;
  final BookingCounts counts;
}

/// The per-status totals of one booking window.
class BookingCounts {
  const BookingCounts({
    this.pending = 0,
    this.confirmed = 0,
    this.completed = 0,
    this.reviewed = 0,
    this.cancelled = 0,
    this.noShow = 0,
  });

  final int pending;
  final int confirmed;
  final int completed;
  final int reviewed;
  final int cancelled;
  final int noShow;

  /// The tab count for [status]. The `noShow` spelling matches the JSON key
  /// the backend sends, so there is one name for the value end to end.
  int of(BookingStatus status) => switch (status) {
        BookingStatus.pending => pending,
        BookingStatus.confirmed => confirmed,
        BookingStatus.completed => completed,
        BookingStatus.reviewed => reviewed,
        BookingStatus.cancelled => cancelled,
        BookingStatus.noShow => noShow,
      };
}

///
/// A [BookingSummary] plus the salon's working hours and settings, which the
/// detail screen needs to say whether a proposed slot is inside opening time.
/// The backend fetches both from `tenants` in the same request, so the app does
/// not have to join a second call that could observe a half-saved change.
class BookingDetail {
  const BookingDetail({required this.summary, required this.workingHours, required this.settings});

  factory BookingDetail.fromJson(Map<String, dynamic> json) => BookingDetail(
        summary: BookingSummary.fromJson(json),
        workingHours: json['workingHours'] is Map<String, dynamic>
            ? json['workingHours'] as Map<String, dynamic>
            : const <String, dynamic>{},
        settings: json['settings'] is Map<String, dynamic>
            ? json['settings'] as Map<String, dynamic>
            : const <String, dynamic>{},
      );

  final BookingSummary summary;

  /// The `working_hours` JSONB, keyed by day.
  final Map<String, dynamic> workingHours;

  /// The salon's `settings` JSONB (deposit rules, cancellation policy, …).
  final Map<String, dynamic> settings;
}

/// One booking of the panel, as returned by `GET /salon/me/bookings/:id`.