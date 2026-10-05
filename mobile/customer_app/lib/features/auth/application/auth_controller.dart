import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_api.dart';
import '../data/session_store.dart';
import '../domain/auth_session.dart';

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
      // The store migrates a pre-ADR-009 SharedPreferences session on first read.
      state = AuthState(session: await ref.read(sessionStoreProvider).read());
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
      await ref.read(sessionStoreProvider).write(session);
      state = AuthState(session: session);
      return session;
    } catch (_) {
      state = AuthState(session: state.session);
      rethrow;
    }
  }

  /// Refreshes proactively, e.g. when returning from the background. The
  /// interceptor handles the automatic case; this is for an explicit retry.
  Future<AuthSession> refresh() async {
    final current = state.session;
    if (current == null || current.refreshToken.isEmpty) {
      throw StateError('no refresh token available');
    }
    final session = await ref.read(authApiProvider).refresh(current.refreshToken);
    await ref.read(sessionStoreProvider).write(session);
    state = AuthState(session: session);
    return session;
  }

  /// Signs out for real: the refresh token is revoked server-side first, so a
  /// copy lifted from the device stops working instead of living out its TTL. A
  /// failure to reach the API must not trap the customer, so the local session
  /// is cleared either way.
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
