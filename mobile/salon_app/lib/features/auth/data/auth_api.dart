import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/auth_session.dart';

class AuthApi {
  AuthApi(this._dio);

  final Dio _dio;

  Future<void> sendOtp(String phoneNumber) async {
    await _dio.post<Map<String, dynamic>>(
      '/auth/otp/send',
      data: {'phoneNumber': phoneNumber},
    );
  }

  Future<AuthSession> _sessionFrom(Map<String, dynamic> data) async {
    if (data['accessToken'] == null && data['token'] != null) {
      throw const FormatException(
        'پاسخ سرور قدیمی است (token). سرور باید accessToken بفرستد.',
      );
    }
    return AuthSession.fromApi(data);
  }

  /// Trades a refresh token for a new pair. The interceptor normally calls this
  /// on a 401; exposed here so the app can refresh proactively or re-authenticate
  /// after being backgrounded.
  Future<AuthSession> refresh({String? refreshToken, String? deviceInfo}) async {
    final token = refreshToken ?? (_lastRefreshToken ?? '');
    if (token.isEmpty) {
      throw const FormatException('توکن تازه‌سازی در دسترس نیست');
    }
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/refresh',
      data: {'refreshToken': token},
    );
    final data = response.data;
    if (data == null) throw Exception('Empty response');
    return AuthSession.fromApi(data);
  }

  String? _lastRefreshToken;

  /// Revokes this device's refresh token. Best effort: the caller clears the
  /// local session regardless of what the server answers.
  Future<void> logout(String refreshToken) async {
    await _dio.post<void>(
      '/auth/logout',
      data: {'refreshToken': refreshToken},
    );
  }

  /// Revokes every session of the caller. Needs a valid access token.
  Future<int> logoutAll() async {
    final response = await _dio.post<Map<String, dynamic>>('/auth/logout-all');
    final data = response.data;
    return (data?['revoked'] as num?)?.toInt() ?? 0;
  }

  /// Confirms the phone and returns the session the API issues with it.
  Future<AuthSession> verifyOtp({required String phoneNumber, required String code}) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/otp/verify',
      data: {'phoneNumber': phoneNumber, 'code': code},
    );
    final data = response.data;
    if (data == null) throw Exception('Empty response');
    return _sessionFrom(data);
  }
}

final authApiProvider = Provider<AuthApi>((ref) {
  return AuthApi(ref.watch(dioProvider));
});