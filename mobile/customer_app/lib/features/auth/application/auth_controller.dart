import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/auth_api.dart';
import '../domain/auth_session.dart';

const _kSessionKey = 'boya_auth_session';

/// Session plus the two flags the UI and the router both need.
class AuthState {
  const AuthState({this.session, this.isRestoring = false, this.isLoading = false});

  final AuthSession? session;

  /// True while the cached session is being read back from disk.
  final bool isRestoring;

  /// True while an OTP request is in flight. The login and OTP screens watch
  /// this to disable their buttons.
  final bool isLoading;

  bool get isAuthenticated => session != null;
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
      // toJson() is flat, so it is re-read through the nested {token, user}
      // shape that fromApi expects.
      state = AuthState(session: AuthSession.fromApi({'token': json['token'], 'user': json}));
    } catch (_) {
      state = const AuthState();
    }
  }

  Future<void> sendOtp(String phoneNumber) async {
    state = AuthState(session: state.session, isLoading: true);
    try {
      await ref.read(authApiProvider).sendOtp(phoneNumber);
      state = AuthState(session: state.session);
    } catch (_) {
      state = AuthState(session: state.session);
      rethrow;
    }
  }

  Future<AuthSession> verifyOtp({required String phoneNumber, required String code}) async {
    state = AuthState(session: state.session, isLoading: true);
    try {
      final session = await ref.read(authApiProvider).verifyOtp(
        phoneNumber: phoneNumber,
        code: code,
      );
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kSessionKey, jsonEncode(session.toJson()));
      state = AuthState(session: session);
      return session;
    } catch (_) {
      state = AuthState(session: state.session);
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
