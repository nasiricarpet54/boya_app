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

  /// Confirms the phone and returns the session the API issues with it.
  Future<AuthSession> verifyOtp({required String phoneNumber, required String code}) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/otp/verify',
      data: {'phoneNumber': phoneNumber, 'code': code},
    );
    final data = response.data;
    if (data == null) throw Exception('Empty response');
    return AuthSession.fromApi(data);
  }
}

final authApiProvider = Provider<AuthApi>((ref) {
  return AuthApi(ref.watch(dioProvider));
});