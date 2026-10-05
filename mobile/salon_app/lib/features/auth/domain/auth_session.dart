import 'salon_user.dart';

/// The signed-in salon staff user plus the two credentials (ADR-009).
///
/// The API answers `{accessToken, refreshToken, refreshExpiresAt, user}`.
/// The two tokens are deliberately separate fields: the access token is
/// short-lived and gets replaced silently on a 401, the refresh token is
/// long-lived, single-use, and revoking it ends the session — conflating them
/// (the old `token` field) is what made real logout impossible.
class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.refreshExpiresAt,
    required this.user,
  });

  factory AuthSession.fromApi(Map<String, dynamic> json) => AuthSession(
        accessToken: json['accessToken'] as String? ?? '',
        refreshToken: json['refreshToken'] as String? ?? '',
        refreshExpiresAt:
            DateTime.tryParse(json['refreshExpiresAt'] as String? ?? '')?.toLocal() ??
                DateTime.fromMillisecondsSinceEpoch(0),
        user: SalonUser.fromJson(json['user'] as Map<String, dynamic>? ?? const {}),
      );

  final String accessToken;
  final String refreshToken;

  /// Local-time expiry, kept for display and for an early "please sign in
  /// again" prompt. The server stays the authority — a device clock is not
  /// trusted for authorisation.
  final DateTime refreshExpiresAt;
  final SalonUser user;

  bool get isExpired => DateTime.now().isAfter(refreshExpiresAt);

  AuthSession copyWith({String? accessToken, String? refreshToken, DateTime? refreshExpiresAt}) =>
      AuthSession(
        accessToken: accessToken ?? this.accessToken,
        refreshToken: refreshToken ?? this.refreshToken,
        refreshExpiresAt: refreshExpiresAt ?? this.refreshExpiresAt,
        user: user,
      );

  Map<String, dynamic> toJson() => {
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'refreshExpiresAt': refreshExpiresAt.toIso8601String(),
        'user': user.toJson(),
      };

  /// Accepts a pre-ADR-009 cache entry (`{token, user}`) so an upgrade does not
  /// silently sign the user out; `accessToken` is carried over and the session
  /// is refreshed on its first 401.
  factory AuthSession.fromLegacyJson(Map<String, dynamic> json) => AuthSession(
        accessToken: json['token'] as String? ?? '',
        refreshToken: '',
        refreshExpiresAt: DateTime.fromMillisecondsSinceEpoch(0),
        user: SalonUser.fromJson(json['user'] as Map<String, dynamic>? ?? const {}),
      );
}