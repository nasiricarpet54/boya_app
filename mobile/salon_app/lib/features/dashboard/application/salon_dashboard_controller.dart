import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/salon_dashboard_stats.dart';

/// Fetches the signed-in staff user's dashboard from `GET /salon/dashboard`.
///
/// The endpoint is token-protected, so the interceptor attaches the bearer
/// header automatically. A 401 clears the cached session and the router's
/// redirect guard bounces the user back to login.
final salonDashboardStatsProvider = FutureProvider<SalonDashboardStats>((ref) async {
  final dio = ref.watch(dioProvider);
  final response = await dio.get<Map<String, dynamic>>('/salon/dashboard');
  return SalonDashboardStats.fromJson(response.data ?? const {});
});
