import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../domain/auth_session.dart';

const _kSecureSessionKey = 'salon_auth_session_v2';
const _kLegacyPrefsKey = 'salon_auth_session';

/// Where a session is persisted.
///
/// An interface rather than a concrete class so the interceptor and the auth
/// controller can be tested without platform channels — `flutter_secure_storage`
/// needs a real platform, which a unit test has no way to provide.
abstract class SessionStore {
  Future<AuthSession?> read();
  Future<void> write(AuthSession session);
  Future<void> clear();
}

/// Stores the session in the platform keystore (Keychain / EncryptedSharedPrefs).
///
/// Both tokens live here rather than in SharedPreferences: the refresh token is
/// long-lived and single-use, so it is a credential worth stealing from a
/// rooted device or a readable app-private file.
class SecureSessionStore implements SessionStore {
  SecureSessionStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<AuthSession?> read() async {
    final raw = await _storage.read(key: _kSecureSessionKey);
    if (raw != null && raw.isNotEmpty) {
      return AuthSession.fromApi(jsonDecode(raw) as Map<String, dynamic>);
    }
    // Upgrade path: a session cached before ADR-009 lived in SharedPreferences
    // under the old key and has no refresh token. Carry the access token over
    // and drop the plaintext copy — the first 401 trades it for a real pair.
    return _migrateLegacy();
  }

  Future<AuthSession?> _migrateLegacy() async {
    final prefs = await SharedPreferences.getInstance();
    final legacy = prefs.getString(_kLegacyPrefsKey);
    if (legacy == null || legacy.isEmpty) return null;

    final session = AuthSession.fromLegacyJson(
      jsonDecode(legacy) as Map<String, dynamic>,
    );
    await write(session);
    await prefs.remove(_kLegacyPrefsKey);
    return session;
  }

  @override
  Future<void> write(AuthSession session) =>
      _storage.write(key: _kSecureSessionKey, value: jsonEncode(session.toJson()));

  @override
  Future<void> clear() async {
    await _storage.delete(key: _kSecureSessionKey);
    // A logout must also sweep the old location, or an upgrade-then-logout
    // leaves a usable token behind in SharedPreferences.
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kLegacyPrefsKey);
  }
}

/// Test double: keeps the session in memory for the lifetime of the test.
class InMemorySessionStore implements SessionStore {
  AuthSession? session;

  /// Makes [read] throw, standing in for an unavailable keystore.
  bool failOnRead = false;

  @override
  Future<AuthSession?> read() async {
    if (failOnRead) throw StateError('keystore unavailable');
    return session;
  }

  @override
  Future<void> write(AuthSession session) async => this.session = session;

  @override
  Future<void> clear() async => session = null;
}

final sessionStoreProvider = Provider<SessionStore>((ref) => SecureSessionStore());