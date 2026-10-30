import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/data/session_store.dart';
import '../../features/auth/domain/auth_session.dart';

const boyaApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://boya.bcshopir.ir/api/v1',
);

/// Routes the API exposes without a token. Everything else gets the bearer
/// header when a session is cached. Matching is a prefix test, so `/salons`
/// covers both the list and `/salons/{id}`.
const _publicPaths = [
  '/auth/otp/send',
  '/auth/otp/verify',
  '/salons',
  '/categories',
  // Province/city reference data: picking a city is the first thing a customer
  // does, before there is a session to attach a token to.
  '/locations',
];

/// Auth endpoints the interceptor must never drive itself into a loop: a 401
/// from these is the *answer*, not a signal to refresh.
const _authPaths = ['/auth/refresh', '/auth/logout', '/auth/logout-all'];

/// Adds `Authorization: Bearer <accessToken>` and, on a 401, transparently
/// rotates the session (ADR-009).
///
/// The refresh is **single-flight**. Several requests failing at once would each
/// start their own rotation, and that is not merely wasteful: refresh tokens are
/// single-use, so two parallel rotations make the second look like a reuse of
/// the first and the server revokes the whole family — signing the customer out
/// for no reason. The in-flight completer lets every waiter share one rotation.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({required SessionStore store, Dio? client})
      : _store = store,
        _client = client ?? Dio(BaseOptions(baseUrl: boyaApiBaseUrl));

  final SessionStore _store;

  /// A client without this interceptor, so the refresh cannot recurse into the
  /// very 401 handler that triggered it.
  final Dio _client;

  /// Non-null while a rotation runs; later requests await it instead of
  /// starting their own.
  Future<bool>? _inFlight;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (_isPublic(options.path)) {
      handler.next(options);
      return;
    }
    try {
      final session = await _store.read();
      if (session != null && session.accessToken.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer ${session.accessToken}';
      }
    } catch (_) {
      // An unreachable keystore must not block the request: the endpoint
      // answers 401 and the caller handles it.
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final status = err.response?.statusCode;
    final path = err.requestOptions.path;

    // OTP endpoints answer 401 for a wrong code, which says nothing about the
    // session, and a 401 *from* the refresh endpoint is the answer itself.
    if (status != 401 || _isPublic(path) || _authPaths.any(path.startsWith)) {
      handler.next(err);
      return;
    }

    final rotated = await _refreshOnce();
    if (!rotated) {
      await _signOut();
      handler.next(err);
      return;
    }

    try {
      final options = err.requestOptions;
      final session = await _store.read();
      // A new map rather than an in-place write: Dio may already have captured
      // a view of the headers, so mutating can be silently dropped.
      options.headers = <String, dynamic>{
        ...options.headers,
        'Authorization': 'Bearer ${session!.accessToken}',
      };
      handler.resolve(await _client.fetch<dynamic>(options));
    } catch (_) {
      // The retry failed for a reason unrelated to credentials; surface the
      // original 401 so the caller's error handling still sees it.
      handler.next(err);
    }
  }

  /// One rotation at a time; everyone else waits for it and reuses the result.
  Future<bool> _refreshOnce() {
    final running = _inFlight;
    if (running != null) return running;

    final future = _performRefresh();
    _inFlight = future;
    // Release the slot once it settles, so a later 401 can rotate again.
    return future.whenComplete(() => _inFlight = null);
  }

  Future<bool> _performRefresh() async {
    AuthSession? session;
    try {
      session = await _store.read();
    } catch (_) {
      return false;
    }
    // No refresh token (or a legacy pre-ADR-009 session): there is nothing to
    // trade, so the only honest outcome is to sign out.
    if (session == null || session.refreshToken.isEmpty) return false;

    try {
      final response = await _client.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': session.refreshToken},
      );
      final data = response.data;
      if (data == null) return false;

      await _store.write(session.copyWith(
        accessToken: data['accessToken'] as String? ?? '',
        refreshToken: data['refreshToken'] as String? ?? '',
        refreshExpiresAt:
            DateTime.tryParse(data['refreshExpiresAt'] as String? ?? '')?.toLocal(),
      ));
      return true;
    } catch (_) {
      // Includes a 401 from reuse detection, which revokes the family
      // server-side; the local copy has to go too.
      return false;
    }
  }

  Future<void> _signOut() async {
    try {
      await _store.clear();
    } catch (_) {
      // Best effort — the caller is already being bounced to the login screen.
    }
  }

  bool _isPublic(String path) => _publicPaths.any(path.startsWith);
}

final dioProvider = Provider<Dio>((ref) {
  // B-INV-13-decoder
  final dio = Dio(
    BaseOptions(
      baseUrl: boyaApiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {'Accept': 'application/json'},
      contentType: Headers.jsonContentType,
    ),
  );
  dio.interceptors.add(AuthInterceptor(store: ref.watch(sessionStoreProvider)));

  

  
  dio.interceptors.add(InterceptorsWrapper(
    onResponse: (response, handler) {
      if (response.data is String) {
        try {
          final bytes = latin1.encode(response.data as String);
          final decoded = utf8.decode(bytes, allowMalformed: true);
          if (decoded != response.data) {
            response.data = jsonDecode(decoded);
          }
        } catch (_) {}
      }
      handler.next(response);
    },
  ));

  return dio;
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
