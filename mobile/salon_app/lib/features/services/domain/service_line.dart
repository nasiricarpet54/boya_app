import '../../salon/domain/salon_status.dart';

/// A service line of the signed-in salon, as returned by
/// `GET /salon/me/lines`. Mirrors the `service_lines` table, including its
/// `approval_status` column — a line that is not yet approved does not appear
/// in the public catalogue until an admin merges it.
class ServiceLine {
  const ServiceLine({
    required this.id,
    required this.name,
    required this.isActive,
    required this.status,
    required this.servicesCount,
    this.description,
  });

  factory ServiceLine.fromJson(Map<String, dynamic> json) => ServiceLine(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        description: json['description'] as String?,
        isActive: json['isActive'] as bool? ?? true,
        status: SalonApprovalStatus.fromWire(json['status'] as String?),
        servicesCount: (json['servicesCount'] as num?)?.toInt() ?? 0,
      );

  final String id;
  final String name;
  final String? description;
  final bool isActive;
  final SalonApprovalStatus status;
  final int servicesCount;
}

/// One service under a service line, as returned by
/// `GET /salon/me/lines/:lineId/services`. Services have no approval workflow,
/// so edits apply immediately and there is no status field to carry.
class SalonService {
  const SalonService({
    required this.id,
    required this.lineId,
    required this.name,
    required this.price,
    required this.durationMinutes,
    required this.depositRequired,
    required this.isActive,
    this.description,
    this.depositAmount,
  });

  factory SalonService.fromJson(Map<String, dynamic> json) => SalonService(
        id: json['id'] as String? ?? '',
        lineId: json['lineId'] as String? ?? '',
        name: json['name'] as String? ?? '',
        description: json['description'] as String?,
        price: (json['price'] as num?)?.toDouble() ?? 0,
        durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 0,
        depositRequired: json['depositRequired'] as bool? ?? false,
        depositAmount: (json['depositAmount'] as num?)?.toDouble(),
        isActive: json['isActive'] as bool? ?? true,
      );

  final String id;
  final String lineId;
  final String name;
  final String? description;
  final double price;
  final int durationMinutes;
  final bool depositRequired;
  final double? depositAmount;
  final bool isActive;
}
