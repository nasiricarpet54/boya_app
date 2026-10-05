import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../domain/auth_session.dart';

/// The key the pre-ADR-009 app used in SharedPreferences. Kept only so an
/// upgrade can migrate the old session and then erase it.
const _kLegacyPrefsKey = 'boya_auth_session';
const _kSecureSessionKey = 'boya_auth_session_v2';

/// Where a session is persisted.
///
/// An interface so the interceptor and the controller can be tested without
/// platform channels: `flutter_secure_storage` needs a real device, which a
/// unit test cannot provide.
abstract class SessionStore {
  Future<AuthSession?> read();
  Future<void> write(AuthSession session);
  Future<void> clear();
}

/// Keeps the session in the platform keystore (Keychain / EncryptedSharedPrefs).
///
/// The refresh token is long-lived and single-use, so it is a credential worth
/// stealing from a device backup or a readable app-private file.
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
    return _migrateLegacy();
  }

  /// Upgrade path. A session cached before ADR-009 lives in SharedPreferences
  /// and has no refresh token; carry the access token over and delete the
  /// plaintext copy. The first 401 then trades it for a real pair.
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
  Future<void> write(AuthSession session) => _storage.write(
        key: _kSecureSessionKey,
        value: jsonEncode(session.toJson()),
      );

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

  @override
  Future<AuthSession?> read() async => session;

  @override
  Future<void> write(AuthSession session) async => this.session = session;

  @override
  Future<void> clear() async => session = null;
}

final sessionStoreProvider = Provider<SessionStore>((ref) => SecureSessionStore());