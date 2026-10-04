/// One time range of `GET /salons/:id/available-slots`.
///
/// [start] and [end] are `HH:MM` Tehran wall-clock labels, not absolute
/// instants: the caller combines them with the civil day it asked about.
class AvailableSlot {
  const AvailableSlot({required this.start, required this.end, required this.available});

  factory AvailableSlot.fromJson(Map<String, dynamic> json) {
    return AvailableSlot(
      start: '${json['start'] ?? ''}',
      end: '${json['end'] ?? ''}',
      available: json['available'] as bool? ?? false,
    );
  }

  final String start;
  final String end;

  /// False when a live booking already covers the range.
  final bool available;
}