import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

/// Writes post-visit feedback. The backend moves the booking
/// `completed → reviewed` as part of the same call.
class ReviewApi {
  ReviewApi(this._dio);

  final Dio _dio;

  Future<void> submit({
    required String tenantId,
    required String bookingId,
    required int rating,
    String? comment,
  }) async {
    await _dio.post<void>(
      '/reviews',
      data: {
        'tenantId': tenantId,
        'bookingId': bookingId,
        'rating': rating,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      },
    );
  }
}

final reviewApiProvider = Provider<ReviewApi>((ref) => ReviewApi(ref.watch(dioProvider)));
