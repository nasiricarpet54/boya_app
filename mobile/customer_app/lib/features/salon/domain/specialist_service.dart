/// One service a salon owner assigned to a specialist, as returned in `data`
/// by `GET /salons/{id}/specialists/{specialistId}/services`.
///
/// This is *not* the salon's catalogue: only the rows the owner created for
/// this specialist (`specialist_services` on the backend), which is the only
/// list the booking form may offer once a specialist is picked.
class SpecialistService {
  const SpecialistService({
    required this.serviceId,
    required this.name,
    required this.price,
    this.description,
    this.durationMinutes = 0,
    this.isActive = true,
    this.isMobileAvailable = false,
  });

  factory SpecialistService.fromJson(Map<String, dynamic> json) {
    return SpecialistService(
      serviceId: (json['serviceId'] as String?) ?? '',
      name: (json['name'] as String?) ?? '',
      description: json['description'] as String?,
      price: _toInt(json['price']),
      durationMinutes: _toInt(json['durationMinutes']),
      isActive: json['isActive'] as bool? ?? true,
      isMobileAvailable: json['isMobileAvailable'] as bool? ?? false,
    );
  }

  final String serviceId;
  final String name;
  final String? description;
  final int price;
  final int durationMinutes;
  final bool isActive;
  final bool isMobileAvailable;
}

int _toInt(Object? value) {
  if (value is num) return value.toInt();
  return num.tryParse('$value')?.toInt() ?? 0;
}
