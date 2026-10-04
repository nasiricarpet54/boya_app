class BookingRecord {
  const BookingRecord({
    required this.id,
    required this.status,
    required this.start,
    required this.totalPrice,
    this.tenantId = '',
    this.serviceName = '',
    this.salonName = '',
  });

  final String id;
  final String status;
  final DateTime start;
  final num totalPrice;

  /// Needed to file feedback: `POST /reviews` is tenant-scoped.
  final String tenantId;

  final String serviceName;
  final String salonName;

  bool get isActive => status == 'pending' || status == 'confirmed';

  /// `completed` means the visit happened but no feedback was filed yet;
  /// feedback moves the booking on to `reviewed`.
  bool get needsReview => status == 'completed';

  factory BookingRecord.fromJson(Map<String, dynamic> json) {
    // GET /bookings sends `startsAt`; the tstzrange column is still accepted so
    // older payloads keep parsing.
    final slot = '${json['startsAt'] ?? json['time_slot'] ?? json['timeSlot'] ?? ''}';
    return BookingRecord(
      id: '${json['id']}',
      status: '${json['status'] ?? ''}',
      start: _slotStart(slot),
      totalPrice: json['total_price'] is num
          ? json['total_price'] as num
          : num.tryParse('${json['total_price'] ?? json['totalPrice'] ?? 0}') ?? 0,
      tenantId: '${json['tenant_id'] ?? json['tenantId'] ?? ''}',
      serviceName: '${json['service_name'] ?? json['serviceName'] ?? ''}',
      salonName: '${json['salon_name'] ?? json['salonName'] ?? ''}',
    );
  }
}

DateTime _slotStart(String slot) {
  final match = RegExp(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?').firstMatch(slot);
  return DateTime.tryParse(match?.group(0) ?? '')?.toLocal() ?? DateTime.fromMillisecondsSinceEpoch(0);
}
