import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/salon_profile.dart';
import '../domain/salon_status.dart';

/// Thrown when a gated edit was accepted but the API answered with something
/// other than `pending_approval`, which would mean the salon believes its
/// change is live when it is not.
class SalonEditNotQueuedException implements Exception {
  const SalonEditNotQueuedException(this.status);

  final SalonApprovalStatus status;

  @override
  String toString() => 'Salon edit was not queued (status: ${status.wireValue})';
}

/// Reads the signed-in staff user's own salon. Token-protected, so the
/// interceptor attaches the bearer header.
class SalonApi {
  SalonApi(this._dio);

  final Dio _dio;

  Future<SalonProfile> me() async {
    final response = await _dio.get<Map<String, dynamic>>('/salon/me');
    return SalonProfile.fromJson(response.data ?? const {});
  }

  /// The approval state of the same salon, kept on a separate endpoint because
  /// it lives in columns `GET /salon/me` does not expose.
  Future<SalonStatusInfo> meStatus() async {
    final response = await _dio.get<Map<String, dynamic>>('/salon/me/status');
    return SalonStatusInfo.fromJson(response.data ?? const {});
  }

  /// `PATCH /salon/me` — the approval-gated profile fields.
  ///
  /// Nothing is written to the live row: the backend merges the payload into
  /// `tenants.pending_changes` and flips the tenant to `pending_approval`, so
  /// the response is a status rather than the updated profile. A field passed
  /// as `null` is simply absent from the body, which leaves whatever that field
  /// already had pending untouched (the backend concatenates jsonb).
  ///
  /// Throws [SalonEditNotQueuedException] if the server answers without
  /// queueing the edit, so the caller never claims a success that did not
  /// happen.
  Future<SalonApprovalStatus> patchSalon({
    String? name,
    String? address,
    String? phone,
    String? coverImage,
    Map<String, dynamic>? workingHours,
  }) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/salon/me',
      data: <String, dynamic>{
        'name': ?name,
        'address': ?address,
        'phone': ?phone,
        'coverImage': ?coverImage,
        'workingHours': ?workingHours,
      },
    );
    final status = SalonApprovalStatus.fromWire(response.data?['status'] as String?);
    if (status != SalonApprovalStatus.pendingApproval) {
      throw SalonEditNotQueuedException(status);
    }
    return status;
  }
}

final salonApiProvider = Provider<SalonApi>((ref) => SalonApi(ref.watch(dioProvider)));

final salonProfileProvider = FutureProvider<SalonProfile>(
  (ref) => ref.watch(salonApiProvider).me(),
);

/// Read by the approval banner on the profile and the edit form.
///
/// Kept separate from [salonProfileProvider] because it is a different pair of
/// columns: `GET /salon/me` serves the public identity card, while the approval
/// state is what gates the next edit.
final salonStatusProvider = FutureProvider<SalonStatusInfo>(
  (ref) => ref.watch(salonApiProvider).meStatus(),
);
