import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../salon/domain/salon_status.dart';
import '../domain/service_line.dart';

/// The settled state of a line/service write, as returned by the panel
/// endpoints. A line create or a `name` edit comes back `pending_approval`;
/// everything else is `approved`.
class PanelWriteResult {
  const PanelWriteResult({required this.status, required this.message});

  factory PanelWriteResult.fromJson(Map<String, dynamic> json) => PanelWriteResult(
        status: SalonApprovalStatus.fromWire(json['status'] as String?),
        message: json['message'] as String? ?? '',
      );

  final SalonApprovalStatus status;
  final String message;
}

/// CRUD for the salon panel's service lines and services. Token-protected, so
/// the interceptor attaches the bearer header.
class ServicesApi {
  ServicesApi(this._dio);

  final Dio _dio;

  Future<List<ServiceLine>> lines() async {
    final response = await _dio.get<List<dynamic>>('/salon/me/lines');
    return [
      for (final item in response.data ?? const [])
        if (item is Map<String, dynamic>) ServiceLine.fromJson(item),
    ];
  }

  Future<List<SalonService>> services(String lineId) async {
    final response = await _dio.get<List<dynamic>>('/salon/me/lines/$lineId/services');
    return [
      for (final item in response.data ?? const [])
        if (item is Map<String, dynamic>) SalonService.fromJson(item),
    ];
  }

  Future<PanelWriteResult> createLine({required String name, String? description}) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/salon/me/lines',
      data: <String, dynamic>{'name': name, if (description != null) 'description': description},
    );
    return PanelWriteResult.fromJson(response.data ?? const {});
  }

  Future<PanelWriteResult> updateLine(
    String id, {
    String? name,
    String? description,
    bool? isActive,
  }) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/salon/me/lines/$id',
      data: <String, dynamic>{
        if (name != null) 'name': name,
        if (description != null) 'description': description,
        if (isActive != null) 'isActive': isActive,
      },
    );
    return PanelWriteResult.fromJson(response.data ?? const {});
  }

  Future<PanelWriteResult> deleteLine(String id) async {
    final response = await _dio.delete<Map<String, dynamic>>('/salon/me/lines/$id');
    return PanelWriteResult.fromJson(response.data ?? const {});
  }

  Future<PanelWriteResult> createService(
    String lineId, {
    required String name,
    required double price,
    String? description,
    int? durationMinutes,
    bool? depositRequired,
    double? depositAmount,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/salon/me/lines/$lineId/services',
      data: <String, dynamic>{
        'name': name,
        'price': price,
        if (description != null) 'description': description,
        if (durationMinutes != null) 'durationMinutes': durationMinutes,
        if (depositRequired != null) 'depositRequired': depositRequired,
        if (depositAmount != null) 'depositAmount': depositAmount,
      },
    );
    return PanelWriteResult.fromJson(response.data ?? const {});
  }

  Future<PanelWriteResult> updateService(
    String id, {
    String? name,
    String? description,
    double? price,
    int? durationMinutes,
    bool? depositRequired,
    double? depositAmount,
    bool? isActive,
    bool? isMobileAvailable,
  }) async {
    final response = await _dio.patch<Map<String, dynamic>>(
      '/salon/me/services/$id',
      data: <String, dynamic>{
        if (name != null) 'name': name,
        if (description != null) 'description': description,
        if (price != null) 'price': price,
        if (durationMinutes != null) 'durationMinutes': durationMinutes,
        if (depositRequired != null) 'depositRequired': depositRequired,
        if (depositAmount != null) 'depositAmount': depositAmount,
        if (isActive != null) 'isActive': isActive,
        if (isMobileAvailable != null) 'isMobileAvailable': isMobileAvailable,
      },
    );
    return PanelWriteResult.fromJson(response.data ?? const {});
  }

  Future<PanelWriteResult> deleteService(String id) async {
    final response = await _dio.delete<Map<String, dynamic>>('/salon/me/services/$id');
    return PanelWriteResult.fromJson(response.data ?? const {});
  }
}

final servicesApiProvider = Provider<ServicesApi>((ref) => ServicesApi(ref.watch(dioProvider)));

/// All service lines of the salon, newest matching the backend's oldest-first
/// order. The list screen and the line form both read this.
final serviceLinesProvider = FutureProvider<List<ServiceLine>>(
  (ref) => ref.watch(servicesApiProvider).lines(),
);

/// Services of one line. `family` keyed on the line id so each screen keeps its
/// own list and refreshes independently.
final lineServicesProvider = FutureProvider.family<List<SalonService>, String>(
  (ref, lineId) => ref.watch(servicesApiProvider).services(lineId),
);
