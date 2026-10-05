import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_api.dart';
import '../data/session_store.dart';
import '../domain/auth_session.dart';
import '../domain/salon_user.dart';

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
      final session = await ref.read(sessionStoreProvider).read();
      if (session == null) {
        state = const AuthState();
        return;
      }
      state = AuthState(user: session.user, token: session.accessToken);
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

  Future<AuthSession> refresh({String? refreshToken, String? deviceInfo}) async {
    state = AuthState(user: state.user, token: state.token, isLoading: true);
    try {
      final session = await ref.read(authApiProvider).refresh(
        refreshToken: refreshToken,
        deviceInfo: deviceInfo,
      );
      await ref.read(sessionStoreProvider).write(session);
      state = AuthState(user: session.user, token: session.accessToken);
      return session;
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
      // Only salon roles may enter the salon panel (ADR-008). Checked before
      // persisting so a rejected account never leaves a session on the device.
      if (!session.user.hasSalonAccess) {
        throw const SalonAccessDeniedException('این حساب به پنل سالن دسترسی ندارد');
      }
      await ref.read(sessionStoreProvider).write(session);
      state = AuthState(user: session.user, token: session.accessToken);
      return session;
    } catch (_) {
      state = AuthState(user: state.user, token: state.token);
      rethrow;
    }
  }

  /// Signs out for real: the refresh token is revoked server-side first, so a
  /// copy lifted from the device stops working instead of living for the rest
  /// of its TTL. A failure to reach the API must not trap the user in the
  /// panel, so the local session is cleared either way.
  Future<void> logout() async {
    final store = ref.read(sessionStoreProvider);
    try {
      final session = await store.read();
      if (session != null && session.refreshToken.isNotEmpty) {
        await ref.read(authApiProvider).logout(session.refreshToken);
      }
    } catch (_) {
      // Offline or already expired: fall through and drop the local copy.
    }
    await store.clear();
    state = const AuthState();
  }

  /// Revokes every session of this account on every device.
  Future<int> logoutAll() async {
    final store = ref.read(sessionStoreProvider);
    var revoked = 0;
    try {
      revoked = await ref.read(authApiProvider).logoutAll();
    } catch (_) {
      // Same reasoning as `logout`.
    }
    await store.clear();
    state = const AuthState();
    return revoked;
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);