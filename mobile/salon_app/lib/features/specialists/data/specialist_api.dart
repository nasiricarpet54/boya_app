import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../services/data/services_api.dart';
import '../domain/salon_specialist.dart';

/// Reply of `POST /salon/me/specialists`. The status is always `approved` —
/// specialist writes are immediate — so the screen only reads [id] to open
/// the edit form afterwards.
class CreatedSpecialist {
  const CreatedSpecialist({required this.id, required this.fullName, required this.phone, required this.status});

  factory CreatedSpecialist.fromJson(Map<String, dynamic> json) => CreatedSpecialist(
        id: json['id'] as String? ?? '',
        fullName: json['fullName'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        status: json['status'] as String? ?? 'approved',
      );

  final String id;
  final String fullName;
  final String phone;
  final String status;
}

/// One service the salon assigned to a specialist, as returned by
/// `GET /salon/me/specialists/:id/services`.
///
/// `id` is the `specialist_services` row id, `serviceId` the catalogue service.
/// The active flag is the owner's per-specialist on/off switch: an inactive
/// assignment is kept (so it can be switched back on) but hidden from the
/// customer's booking form.
class SpecialistServiceItem {
  const SpecialistServiceItem({
    required this.id,
    required this.serviceId,
    required this.name,
    required this.price,
    this.description,
    this.durationMinutes = 0,
    this.isActive = true,
    this.isMobileAvailable = false,
  });

  factory SpecialistServiceItem.fromJson(Map<String, dynamic> json) {
    return SpecialistServiceItem(
      id: json['id'] as String? ?? '',
      serviceId: json['serviceId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      price: (json['price'] as num?)?.toDouble() ?? 0,
      durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 0,
      isActive: json['isActive'] as bool? ?? true,
      isMobileAvailable: json['isMobileAvailable'] as bool? ?? false,
    );
  }

  final String id;
  final String serviceId;
  final String name;
  final String? description;
  final double price;
  final int durationMinutes;
  final bool isActive;
  final bool isMobileAvailable;
}

/// Assignment the owner sends to `PUT /salon/me/specialists/:id/services`.
class SpecialistServiceAssignment {
  const SpecialistServiceAssignment({required this.serviceId, this.isActive = true});

  final String serviceId;
  final bool isActive;

  Map<String, dynamic> toJson() => {'serviceId': serviceId, 'isActive': isActive};
}

/// CRUD for the salon panel's specialists. Token-protected, so the
/// interceptor attaches the bearer header; the tenant always comes from the
/// JWT on the backend, never from these payloads.
class SpecialistApi {
  SpecialistApi(this._dio);

  final Dio _dio;

  /// Every specialist of the salon, inactive ones included.
  Future<List<SalonSpecialist>> listSpecialists() async {
    final response = await _dio.get<List<dynamic>>('/salon/me/specialists');
    return [
      for (final item in response.data ?? const [])
        if (item is Map<String, dynamic>) SalonSpecialist.fromJson(item),
    ];
  }

  /// Registers a specialist; lands as `approved` immediately. A null [bio]
  /// or [commissionRate] is omitted, so the backend's defaults apply.
  /// [avatarUrl] is a `POST /upload/image` path (or `''` for no photo).
  Future<CreatedSpecialist> createSpecialist({
    required String phone,
    required String fullName,
    String? bio,
    List<String>? skills,
    double? commissionRate,
    String? avatarUrl,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/salon/me/specialists',
      data: <String, dynamic>{
        'phone': phone,
        'fullName': fullName,
        if (bio != null) 'bio': bio,
        if (skills != null) 'skills': skills,
        if (commissionRate != null) 'commissionRate': commissionRate,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
      },
    );
    return CreatedSpecialist.fromJson(response.data ?? const {});
  }

  /// Bio, skills, commission — or the visibility toggle. Fields left null
  /// are omitted, so the backend's whitelist keeps the row's value.
  Future<PanelWriteResult> updateSpecialist(
    String id, {
    String? bio,
    List<String>? skills,
    double? commissionRate,
    bool? isActive,
    bool? offersMobileService,
    String? avatarUrl,
  }) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/salon/me/specialists/$id',
      data: <String, dynamic>{
        if (bio != null) 'bio': bio,
        if (skills != null) 'skills': skills,
        if (commissionRate != null) 'commissionRate': commissionRate,
        if (isActive != null) 'isActive': isActive,
        if (offersMobileService != null) 'offersMobileService': offersMobileService,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
      },
    );
    return PanelWriteResult.fromJson(response.data ?? const {});
  }

  /// The signed-in user's own specialist row, resolved from the salon's list on
  /// `userId`.
  ///
  /// `GET /auth/me` reports the onboarding flag but not the row id, and the
  /// specialist's setup form needs the id to `PATCH /salon/me/specialists/:id`.
  /// The list is the same endpoint the owner's specialist tab reads, so it is
  /// already tenant-scoped by the token; the `userId` match is what picks the
  /// caller's own row out of it.
  Future<SalonSpecialist?> mySpecialist(String userId) async {
    if (userId.isEmpty) return null;
    final all = await listSpecialists();
    for (final specialist in all) {
      if (specialist.userId == userId) return specialist;
    }
    return null;
  }

  /// Soft-deletes the specialist. The backend answers 400 while active
  /// bookings exist; `messageFromDio` renders its Persian message.
  Future<PanelWriteResult> deleteSpecialist(String id) async {
    final response = await _dio.delete<Map<String, dynamic>>('/salon/me/specialists/$id');
    return PanelWriteResult.fromJson(response.data ?? const {});
  }

  /// The services the salon assigned to one specialist, inactive assignments
  /// included (the owner can switch those back on). A specialist token may
  /// only ask for its own row; the backend answers 403 for anyone else's.
  Future<List<SpecialistServiceItem>> listSpecialistServices(String id) async {
    final response = await _dio.get<List<dynamic>>('/salon/me/specialists/$id/services');
    return [
      for (final item in response.data ?? const [])
        if (item is Map<String, dynamic>) SpecialistServiceItem.fromJson(item),
    ];
  }

  /// The services assigned to the signed-in specialist (scoped by token).
  Future<List<SpecialistServiceItem>> listMySpecialistServices() async {
    final response = await _dio.get('/salon/me/specialist-services');
    return (response.data as List).map((e) => SpecialistServiceItem.fromJson(e)).toList();
  }

  /// Replaces the specialist's whole assignment list. Anything missing from
  /// [assignments] is un-assigned by the backend; a service id from another
  /// salon answers 400.
  Future<List<SpecialistServiceItem>> setSpecialistServices(
    String id,
    List<SpecialistServiceAssignment> assignments,
  ) async {
    final response = await _dio.put<List<dynamic>>(
      '/salon/me/specialists/$id/services',
      data: <String, dynamic>{
        'services': [for (final item in assignments) item.toJson()],
      },
    );
    return [
      for (final item in response.data ?? const [])
        if (item is Map<String, dynamic>) SpecialistServiceItem.fromJson(item),
    ];
  }
}

final specialistApiProvider = Provider<SpecialistApi>(
  (ref) => SpecialistApi(ref.watch(dioProvider)),
);

/// All specialists of the salon. The list screen and the portfolio dialog
/// both read this, and every write invalidates it.
final specialistListProvider = FutureProvider<List<SalonSpecialist>>(
  (ref) => ref.watch(specialistApiProvider).listSpecialists(),
);

/// The services assigned to one specialist. `family` keyed on the specialist
/// id: the list screen opens one screen per specialist and its own writes
/// invalidate only that entry.
final specialistServicesProvider =
    FutureProvider.family<List<SpecialistServiceItem>, String>(
  (ref, specialistId) => ref.watch(specialistApiProvider).listSpecialistServices(specialistId),
);

