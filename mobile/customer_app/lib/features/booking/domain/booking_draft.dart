class BookingDraft {
  const BookingDraft({
    required this.salonId,
    required this.specialistId,
    required this.serviceId,
    required this.date,
    this.slotStart,
    this.notes,
    this.isMobile = false,
    this.customerAddress,
    this.customerLatitude,
    this.customerLongitude,
  });

  final String salonId;
  final String specialistId;
  final String serviceId;
  final DateTime date;

  /// Start of the picked slot on [date], sent as `startsAt` to POST /bookings.
  final DateTime? slotStart;

  /// Optional customer note, sent as `notes` to POST /bookings.
  final String? notes;

  /// ADR-011: the customer asked the specialist to come to them rather than
  /// visiting the salon.
  final bool isMobile;

  /// Where the specialist travels to when [isMobile]. Required by the backend
  /// the moment [isMobile] is true.
  final String? customerAddress;

  /// Coordinates of [customerAddress], when the customer dropped a pin. Sent as
  /// numbers; the column stores them as decimal text.
  final double? customerLatitude;
  final double? customerLongitude;
}
