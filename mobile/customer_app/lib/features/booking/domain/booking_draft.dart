class BookingDraft {
  const BookingDraft({
    required this.salonId,
    required this.specialistId,
    required this.serviceId,
    required this.date,
    this.slotStart,
    this.notes,
  });

  final String salonId;
  final String specialistId;
  final String serviceId;
  final DateTime date;

  /// Start of the picked slot on [date], sent as `startsAt` to POST /bookings.
  final DateTime? slotStart;

  /// Optional customer note, sent as `notes` to POST /bookings.
  final String? notes;
}
