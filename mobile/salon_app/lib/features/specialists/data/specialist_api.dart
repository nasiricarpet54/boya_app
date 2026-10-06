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
  Future<CreatedSpecialist> createSpecialist({
    required String phone,
    required String fullName,
    String? bio,
    List<String>? skills,
    double? commissionRate,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/salon/me/specialists',
      data: <String, dynamic>{
        'phone': phone,
        'fullName': fullName,
        'bio': ?bio,
        'skills': ?skills,
        'commissionRate': ?commissionRate,
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
  }) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/salon/me/specialists/$id',
      data: <String, dynamic>{
        'bio': ?bio,
        'skills': ?skills,
        'commissionRate': ?commissionRate,
        'isActive': ?isActive,
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
}

final specialistApiProvider = Provider<SpecialistApi>(
  (ref) => SpecialistApi(ref.watch(dioProvider)),
);

/// All specialists of the salon. The list screen and the portfolio dialog
/// both read this, and every write invalidates it.
final specialistListProvider = FutureProvider<List<SalonSpecialist>>(
  (ref) => ref.watch(specialistApiProvider).listSpecialists(),
);

