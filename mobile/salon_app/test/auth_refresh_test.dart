import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_app/core/network/api_client.dart';
import 'package:salon_app/features/auth/data/auth_api.dart';
import 'package:salon_app/features/auth/data/session_store.dart';
import 'package:salon_app/features/auth/domain/auth_session.dart';
import 'package:salon_app/features/auth/domain/salon_user.dart';

/// A scripted HTTP endpoint. Every request is recorded, so ordering and retry
/// counts can be asserted.
class _Script {
  _Script(this.client, this.requests);

  final Dio client;
  final List<RequestOptions> requests;
  final List<String> bodies = [];
}

typedef _Responder = ResponseBody Function(RequestOptions options);

_Script _scripted(Map<String, _Responder> routes) {
  final dio = Dio(BaseOptions(baseUrl: 'http://test.local/api/v1'));
  final requests = <RequestOptions>[];
  final script = _Script(dio, requests);
  dio.httpClientAdapter = _StubAdapter(routes, script);
  return script;
}

/// A Dio sharing [script]'s transport and carrying the interceptor, so the retry
/// the interceptor performs is observable on the same adapter.
Dio _clientWith(_Script script, SessionStore store) => Dio(script.client.options)
  ..httpClientAdapter = script.client.httpClientAdapter
  ..interceptors.add(AuthInterceptor(store: store, client: script.client));

ResponseBody _json(Object body, [int status = 200]) => ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {Headers.contentTypeHeader: [Headers.jsonContentType]},
    );

class _StubAdapter implements HttpClientAdapter {
  _StubAdapter(this._routes, this._script);

  final Map<String, _Responder> _routes;
  final _Script _script;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    _script.requests.add(options);
    _script.bodies.add(jsonEncode(options.data));
    final responder = _routes[options.path];
    if (responder == null) {
      return _json({'message': 'no route'}, 404);
    }
    return responder(options);
  }
}

AuthSession _session({String access = 'access-1', String refresh = 'refresh-1'}) =>
    AuthSession(
      accessToken: access,
      refreshToken: refresh,
      refreshExpiresAt: DateTime.now().add(const Duration(days: 30)),
      user: SalonUser(
        id: 'u1',
        phoneNumber: '09120000000',
        role: 'salon_owner',
      ),
    );

/// A refresh response the interceptor should accept.
Map<String, dynamic> _rotated({String access = 'access-2', String refresh = 'refresh-2'}) => {
      'accessToken': access,
      'refreshToken': refresh,
      'refreshExpiresAt':
          DateTime.now().add(const Duration(days: 30)).toIso8601String(),
    };

void main() {
  group('AuthSession', () {
    test('reads the ADR-009 payload', () {
      final session = AuthSession.fromApi({
        'accessToken': 'a',
        'refreshToken': 'r',
        'refreshExpiresAt': '2026-12-01T00:00:00.000Z',
        'user': {'id': 'u1', 'phoneNumber': '0912', 'role': 'salon_owner'},
      });

      expect(session.accessToken, 'a');
      expect(session.refreshToken, 'r');
      expect(session.refreshExpiresAt.isAfter(DateTime(2026, 11, 30)), isTrue);
      expect(session.user.role, 'salon_owner');
    });

    test('survives a JSON round-trip, which is how it is cached', () {
      final original = _session();
      final restored = AuthSession.fromApi(
        jsonDecode(jsonEncode(original.toJson())) as Map<String, dynamic>,
      );

      expect(restored.accessToken, original.accessToken);
      expect(restored.refreshToken, original.refreshToken);
      expect(restored.user.id, original.user.id);
    });

    test('a pre-ADR-009 cache entry keeps its access token but no refresh token',
        () {
      final legacy = AuthSession.fromLegacyJson({
        'token': 'old-access',
        'user': {'id': 'u1', 'phoneNumber': '0912', 'role': 'salon_owner'},
      });

      expect(legacy.accessToken, 'old-access');
      expect(legacy.refreshToken, isEmpty);
      expect(legacy.isExpired, isTrue);
    });

    test('InMemorySessionStore round-trips and clears', () async {
      final store = InMemorySessionStore();
      expect(await store.read(), isNull);

      await store.write(_session());
      expect((await store.read())!.refreshToken, 'refresh-1');

      await store.clear();
      expect(await store.read(), isNull);
    });
  });

  group('AuthInterceptor', () {
    test('attaches the bearer header from the store', () async {
      final store = InMemorySessionStore()..session = _session(access: 'access-xyz');
      final script = _scripted({
        '/salon/me': (_) => _json({'ok': true}),
      });

      await _clientWith(script, store).get<dynamic>('/salon/me');

      expect(script.requests.single.headers['Authorization'], 'Bearer access-xyz');
    });

    test('sends no header on a public route', () async {
      final store = InMemorySessionStore()..session = _session();
      final script = _scripted({
        '/salons': (_) => _json({'ok': true}),
      });

      await _clientWith(script, store).get<dynamic>('/salons');

      expect(script.requests.single.headers.containsKey('Authorization'), isFalse);
    });

    test('refreshes once on a 401 and replays with the new token', () async {
      final store = InMemorySessionStore()..session = _session();
      var salonCalls = 0;

      final script = _scripted({
        '/salon/me': (_) {
          salonCalls++;
          // The first attempt 401s; the replay answers with the fresh token.
          if (salonCalls == 1) return _json({'message': 'expired'}, 401);
          return _json({'ok': true});
        },
        '/auth/refresh': (_) => _json(_rotated()),
      });

      final response =
          await _clientWith(script, store).get<dynamic>('/salon/me');

      expect(response.data, {'ok': true});
      expect(salonCalls, 2);
      // The replay carries the rotated token, not the stale one. It is the last
      // request: [0] the failed call, [1] the refresh, [2] the replay.
      expect(script.requests.last.headers['Authorization'], 'Bearer access-2');
      expect(store.session!.refreshToken, 'refresh-2');
    });

    test('two concurrent 401s trigger exactly one refresh', () async {
      final store = InMemorySessionStore()..session = _session();
      var refreshCalls = 0;

      final script = _scripted({
        '/a': (_) => _json({'message': 'expired'}, 401),
        '/b': (_) => _json({'message': 'expired'}, 401),
        '/auth/refresh': (_) {
          refreshCalls++;
          return _json(_rotated());
        },
      });
      final dio = _clientWith(script, store);

      // Both 401s are released in the same turn so they enter onError together.
      // The stub keeps answering 401 to the replays, so the individual failures
      // are expected — the call count is the assertion under test.
      Future<void> settle(Future<Object?> call) async {
        try {
          await call;
        } catch (_) {
          // Swallowed on purpose: this test asserts the refresh count only.
        }
      }

      await Future.wait([
        settle(dio.get<dynamic>('/a')),
        settle(dio.get<dynamic>('/b')),
      ]);

      // A second rotation would make the server read it as reuse and revoke the
      // family, so the call count is the assertion that matters here.
      expect(refreshCalls, 1);
    });

    test('a 401 from the refresh endpoint signs out instead of looping',
        () async {
      final store = InMemorySessionStore()..session = _session();
      var refreshCalls = 0;

      final script = _scripted({
        '/salon/me': (_) => _json({'message': 'expired'}, 401),
        '/auth/refresh': (_) {
          refreshCalls++;
          return _json({'message': 'reuse detected'}, 401);
        },
      });

      await expectLater(
        _clientWith(script, store).get<dynamic>('/salon/me'),
        throwsA(isA<DioException>()),
      );

      expect(refreshCalls, 1);
      expect(await store.read(), isNull, reason: 'credentials must be dropped');
    });

    test('no refresh token means sign out, not an endless 401', () async {
      final store = InMemorySessionStore()
        ..session = AuthSession.fromLegacyJson({
          'token': 'old',
          'user': {'id': 'u1', 'phoneNumber': '0912', 'role': 'salon_owner'},
        });
      var refreshCalls = 0;

      final script = _scripted({
        '/salon/me': (_) => _json({'message': 'expired'}, 401),
        '/auth/refresh': (_) {
          refreshCalls++;
          return _json(_rotated());
        },
      });

      await expectLater(
        _clientWith(script, store).get<dynamic>('/salon/me'),
        throwsA(isA<DioException>()),
      );

      expect(refreshCalls, 0);
      expect(await store.read(), isNull);
    });

    test('a 401 on the OTP path never triggers a refresh', () async {
      final store = InMemorySessionStore()..session = _session();
      var refreshCalls = 0;

      final script = _scripted({
        '/auth/otp/verify': (_) => _json({'message': 'bad code'}, 401),
        '/auth/refresh': (_) {
          refreshCalls++;
          return _json(_rotated());
        },
      });

      await expectLater(
        _clientWith(script, store).post<dynamic>(
          '/auth/otp/verify',
          data: const {},
        ),
        throwsA(isA<DioException>()),
      );

      expect(refreshCalls, 0);
      expect(await store.read(), isNotNull, reason: 'the session must survive');
    });
  });

  group('AuthApi', () {
    test('logout posts the refresh token', () async {
      final script = _scripted({
        '/auth/logout': (_) => ResponseBody.fromString('', 204),
      });

      await AuthApi(script.client).logout('refresh-1');

      expect(script.requests.single.path, '/auth/logout');
      expect(jsonDecode(script.bodies.single), {'refreshToken': 'refresh-1'});
    });

    test('logoutAll returns the revoked count', () async {
      final script = _scripted({
        '/auth/logout-all': (_) => _json({'revoked': 3}),
      });

      expect(await AuthApi(script.client).logoutAll(), 3);
    });

    test('refuses a pre-ADR-009 verify response instead of caching an empty session',
        () async {
      final script = _scripted({
        '/auth/otp/verify': (_) => _json({
          'token': 'legacy',
          'user': {'id': 'u1', 'phoneNumber': '0912', 'role': 'salon_owner'},
        }),
      });

      await expectLater(
        AuthApi(script.client).verifyOtp(
          phoneNumber: '09120000000',
          code: '123456',
        ),
        throwsA(isA<FormatException>()),
      );
    });
  });
}
