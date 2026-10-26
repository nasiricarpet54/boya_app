import 'salon_user.dart';

/// The signed-in salon staff user plus the two credentials (ADR-009).
///
/// The API answers `{accessToken, refreshToken, refreshExpiresAt, user,
/// activeRole, allowedRoles, redirectRoute}`. The two tokens are deliberately
/// separate fields: the access token is short-lived and gets replaced silently
/// on a 401, the refresh token is long-lived, single-use, and revoking it ends
/// the session — conflating them (the old `token` field) is what made real
/// logout impossible.
///
/// The role fields are the server's answer to "where does this session go":
/// `activeRole` is the signed claim every guard reads, `allowedRoles` the
/// roles the account may switch to, and `redirectRoute` the destination the
/// backend computed for the active role. One user row holds one role today, so
/// the picker the design describes will show a single entry until accounts can
/// hold several.
class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.refreshExpiresAt,
    required this.user,
    this.activeRole,
    this.allowedRoles = const <String>[],
    this.redirectRoute,
  });

  factory AuthSession.fromApi(Map<String, dynamic> json) => AuthSession(
        accessToken: json['accessToken'] as String? ?? '',
        refreshToken: json['refreshToken'] as String? ?? '',
        refreshExpiresAt:
            DateTime.tryParse(json['refreshExpiresAt'] as String? ?? '')?.toLocal() ??
                DateTime.fromMillisecondsSinceEpoch(0),
        user: SalonUser.fromJson(json['user'] as Map<String, dynamic>? ?? const {}),
        activeRole: json['activeRole'] as String?,
        allowedRoles: (json['allowedRoles'] as List?)?.cast<String>() ?? const <String>[],
        redirectRoute: json['redirectRoute'] as String?,
      );

  final String accessToken;
  final String refreshToken;

  /// Local-time expiry, kept for display and for an early "please sign in
  /// again" prompt. The server stays the authority — a device clock is not
  /// trusted for authorisation.
  final DateTime refreshExpiresAt;
  final SalonUser user;

  /// The role this session acts under; null on a legacy server reply, in which
  /// case [user.role] is the same value.
  final String? activeRole;

  /// Roles the account may switch to via `POST /auth/switch-role`.
  final List<String> allowedRoles;

  /// Where the panel should land after login — the server's call, so a changed
  /// role cannot route a specialist token to an owner screen.
  final String? redirectRoute;

  /// The route the server sent, or the panel dashboard when the reply is
  /// legacy/missing it. Staff roles all land in this one panel (ADR-003): the
  /// panel separates roles inside itself.
  String get effectiveRedirectRoute =>
      (redirectRoute != null && redirectRoute!.isNotEmpty) ? redirectRoute! : '/dashboard';

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
        if (activeRole != null) 'activeRole': activeRole,
        'allowedRoles': allowedRoles,
        if (redirectRoute != null) 'redirectRoute': redirectRoute,
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