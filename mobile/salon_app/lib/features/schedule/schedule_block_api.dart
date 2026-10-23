import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

class ScheduleBlockApi {
  ScheduleBlockApi(this._dio);

  final Dio _dio;

  Future<void> createScheduleBlock({
    required String? specialistId,
    required DateTime startTime,
    required DateTime endTime,
    required String reason,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/salon/me/schedule/block',
      data: {
        'specialistId': specialistId,
        'startTime': startTime.toIso8601String(),
        'endTime': endTime.toIso8601String(),
        'reason': reason,
      },
    );
    // The backend returns { id: string } but we don't need it.
  }

  Future<void> deleteScheduleBlock(String id) async {
    final response = await _dio.delete<void>(
      '/salon/me/schedule/block/$id',
    );
    return response.data;
  }

  Future<List<ScheduleBlockItem>> fetchScheduleBlocks() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/salon/me/schedule/blocks',
    );
    final data = response.data!;
    final List<dynamic> items = data['data'] as List<dynamic>;
    return items.map((e) => ScheduleBlockItem.fromJson(e)).toList();
  }
}

class ScheduleBlockItem {
  final String id;
  final String? specialistId;
  final DateTime startTime;
  final DateTime endTime;
  final String? reason;

  ScheduleBlockItem({
    required this.id,
    required this.specialistId,
    required this.startTime,
    required this.endTime,
    this.reason,
  });

  factory ScheduleBlockItem.fromJson(Map<String, dynamic> json) {
    return ScheduleBlockItem(
      id: json['id'] as String,
      specialistId: json['specialistId'] as String?,
      startTime: DateTime.parse(json['startTime'] as String),
      endTime: DateTime.parse(json['endTime'] as String),
      reason: json['reason'] as String?,
    );
  }
}

final scheduleBlockApiProvider = Provider<ScheduleBlockApi>((ref) => ScheduleBlockApi(ref.watch(dioProvider)));