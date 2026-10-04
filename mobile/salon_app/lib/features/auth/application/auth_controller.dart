import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/auth_api.dart';
import '../domain/auth_session.dart';
import '../domain/salon_user.dart';

const _kSessionKey = 'salon_auth_session';

/// Thrown when a customer account tries to enter the salon panel.
class SalonAccessDeniedException implements Exception {
  const SalonAccessDeniedException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Session plus the two flags the UI and the router both need.
class AuthState {
  const AuthState({
    this.user,
    this.token,
    this.isLoading = false,
    this.isRestoring = false,
  });

  final SalonUser? user;
  final String? token;

  /// True while an OTP request is in flight. The login and OTP screens watch
  /// this to disable their buttons.
  final bool isLoading;

  /// True while the cached session is being read back from disk.
  final bool isRestoring;

  bool get isAuthenticated => user != null && token != null;
}

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    _restore();
    return const AuthState(isRestoring: true);
  }

  Future<void> _restore() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_kSessionKey);
      if (raw == null) {
        state = const AuthState();
        return;
      }
      final json = jsonDecode(raw) as Map<String, dynamic>;
      final session = AuthSession.fromApi(json);
      state = AuthState(user: session.user, token: session.token);
    } catch (_) {
      state = const AuthState();
    }
  }

  Future<void> sendOtp(String phoneNumber) async {
    state = AuthState(user: state.user, token: state.token, isLoading: true);
    try {
      await ref.read(authApiProvider).sendOtp(phoneNumber);
      state = AuthState(user: state.user, token: state.token);
    } catch (_) {
      state = AuthState(user: state.user, token: state.token);
      rethrow;
    }
  }

  Future<AuthSession> verifyOtp({required String phoneNumber, required String code}) async {
    state = AuthState(user: state.user, token: state.token, isLoading: true);
    try {
      final session = await ref.read(authApiProvider).verifyOtp(
        phoneNumber: phoneNumber,
        code: code,
      );
      // Only salon roles may enter the salon panel.
      if (session.user.role == 'customer') {
        throw const SalonAccessDeniedException('این حساب به پنل سالن دسترسی ندارد');
      }
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kSessionKey, jsonEncode(session.toJson()));
      state = AuthState(user: session.user, token: session.token);
      return session;
    } catch (_) {
      state = AuthState(user: state.user, token: state.token);
      rethrow;
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kSessionKey);
    state = const AuthState();
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);