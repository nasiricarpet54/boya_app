import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const boyaApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:3000/api/v1',
);

const _kSessionKey = 'boya_auth_session';

/// Routes the API exposes without a token. Everything else gets the bearer
/// header when a session is cached. Matching is a prefix test, so `/salons`
/// covers both the list and `/salons/{id}`.
const _publicPaths = ['/auth/otp/send', '/auth/otp/verify', '/salons', '/categories'];

/// Adds `Authorization: Bearer <token>` to every non-public request.
///
/// The token is read from the same cache the auth controller writes, so there
/// is a single source of truth on disk.
InterceptorsWrapper _authInterceptor() {
  return InterceptorsWrapper(
    onRequest: (options, handler) async {
      if (!_publicPaths.any(options.path.startsWith)) {
        try {
          final prefs = await SharedPreferences.getInstance();
          final raw = prefs.getString(_kSessionKey);
          if (raw != null) {
            final json = jsonDecode(raw) as Map<String, dynamic>;
            final token = json['token'] as String?;
            if (token != null && token.isNotEmpty) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          }
        } catch (_) {
          // A malformed cache entry must not block the request; the endpoint
          // answers 401 and the UI handles it.
        }
      }
      handler.next(options);
    },
  );
}

final dioProvider = Provider<Dio>((ref) {
  return Dio(
    BaseOptions(
      baseUrl: boyaApiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {'Accept': 'application/json'},
    ),
  )..interceptors.add(_authInterceptor());
});

String messageFromDio(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map && data['message'] is String) {
      return data['message'] as String;
    }
    if (data is Map &&
        data['message'] is List &&
        (data['message'] as List).isNotEmpty) {
      return '${(data['message'] as List).first}';
    }
    return 'اتصال برقرار نشد. اینترنت را بررسی کنید.';
  }
  return 'مشکلی پیش آمد. دوباره تلاش کنید.';
}
