class SalonDayRevenue {
  const SalonDayRevenue({required this.dayIndex, required this.amount});

  /// Saturday is 0. Friday is 6.
  final int dayIndex;
  final double amount;

  factory SalonDayRevenue.fromJson(Map<String, dynamic> json) => SalonDayRevenue(
        dayIndex: (json['dayIndex'] as num?)?.toInt() ?? 0,
        amount: (json['amount'] as num?)?.toDouble() ?? 0,
      );
}

/// One row of the dashboard's top-specialists card.
class SalonTopSpecialist {
  const SalonTopSpecialist({
    required this.id,
    required this.bookings,
    required this.revenue,
    this.fullName,
  });

  factory SalonTopSpecialist.fromJson(Map<String, dynamic> json) => SalonTopSpecialist(
        id: json['id'] as String? ?? '',
        fullName: json['fullName'] as String?,
        bookings: (json['bookings'] as num?)?.toInt() ?? 0,
        revenue: (json['revenue'] as num?)?.toDouble() ?? 0,
      );

  final String id;

  /// Null until the staff member completes their profile.
  final String? fullName;

  final int bookings;
  final double revenue;
}

/// Snapshot of `GET /salon/dashboard`.
class SalonDashboardStats {
  const SalonDashboardStats({
    required this.todayBookings,
    required this.todayRevenue,
    required this.weeklyRevenue,
    this.weekBookings = 0,
    this.weekRevenue = 0,
    this.pendingBookings = 0,
    this.topSpecialists = const [],
  });

  factory SalonDashboardStats.fromJson(Map<String, dynamic> json) {
    final weekly = json['weeklyRevenue'];
    final specialists = json['topSpecialists'];
    return SalonDashboardStats(
      todayBookings: (json['todayBookings'] as num?)?.toInt() ?? 0,
      todayRevenue: (json['todayRevenue'] as num?)?.toDouble() ?? 0,
      weekBookings: (json['weekBookings'] as num?)?.toInt() ?? 0,
      weekRevenue: (json['weekRevenue'] as num?)?.toDouble() ?? 0,
      pendingBookings: (json['pendingBookings'] as num?)?.toInt() ?? 0,
      weeklyRevenue: [
        for (final day in weekly is List ? weekly : const [])
          if (day is Map<String, dynamic>) SalonDayRevenue.fromJson(day),
      ],
      topSpecialists: [
        for (final item in specialists is List ? specialists : const [])
          if (item is Map<String, dynamic>) SalonTopSpecialist.fromJson(item),
      ],
    );
  }

  final int todayBookings;
  final num todayRevenue;

  /// Saturday is 0 through Friday is 6; the API always sends all seven days.
  final List<SalonDayRevenue> weeklyRevenue;

  final int weekBookings;
  final num weekRevenue;

  /// Bookings still waiting for approval, across the whole salon.
  final int pendingBookings;

  final List<SalonTopSpecialist> topSpecialists;

  static const empty = SalonDashboardStats(todayBookings: 0, todayRevenue: 0, weeklyRevenue: []);
}
