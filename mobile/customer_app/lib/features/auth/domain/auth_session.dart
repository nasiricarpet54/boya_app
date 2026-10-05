/// The signed-in customer, as returned by `POST /auth/otp/verify`.
///
/// Still a flat value object (this app flattens the nested `user`), but it now
/// carries both credentials from ADR-009. They are deliberately separate: the
/// access token is short-lived and replaced silently on a 401, while the refresh
/// token is long-lived and single-use — conflating them (the old `token`) is
/// what made a real logout impossible.
class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.refreshExpiresAt,
    required this.userId,
    required this.phoneNumber,
    required this.fullName,
    required this.role,
    required this.isNewUser,
  });

  factory AuthSession.fromApi(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>? ?? const {};
    return AuthSession(
      accessToken: json['accessToken'] as String? ?? '',
      refreshToken: json['refreshToken'] as String? ?? '',
      refreshExpiresAt:
          DateTime.tryParse(json['refreshExpiresAt'] as String? ?? '')?.toLocal() ??
              DateTime.fromMillisecondsSinceEpoch(0),
      userId: user['id'] as String? ?? '',
      phoneNumber: user['phoneNumber'] as String? ?? '',
      fullName: user['fullName'] as String?,
      role: user['role'] as String? ?? 'customer',
      isNewUser: user['isNewUser'] as bool? ?? false,
    );
  }

  /// Accepts a pre-ADR-009 cache entry so an upgrade does not silently sign the
  /// customer out; the access token carries over and is refreshed on first 401.
  factory AuthSession.fromLegacyJson(Map<String, dynamic> json) => AuthSession(
        accessToken: json['token'] as String? ?? '',
        refreshToken: '',
        refreshExpiresAt: DateTime.fromMillisecondsSinceEpoch(0),
        userId: json['userId'] as String? ?? '',
        phoneNumber: json['phoneNumber'] as String? ?? '',
        fullName: json['fullName'] as String?,
        role: json['role'] as String? ?? 'customer',
        isNewUser: json['isNewUser'] as bool? ?? false,
      );

  final String accessToken;
  final String refreshToken;

  /// Local-time expiry, used for display and an early re-login prompt. The
  /// server stays the authority; a device clock is never trusted for
  /// authorisation.
  final DateTime refreshExpiresAt;

  final String userId;
  final String phoneNumber;

  /// Null until the customer completes their profile.
  final String? fullName;

  final String role;

  /// True on the very first successful verify, used to drive onboarding.
  final bool isNewUser;

  /// Local-time check for an early re-login prompt. Never used for
  /// authorisation — the server is the authority on token validity.
  bool get isExpired => DateTime.now().isAfter(refreshExpiresAt);

  /// Mirrors [fromApi] exactly — the cached form has to be the parseable form,
  /// otherwise restoring a session is lossy. (The pre-ADR-009 app stored a flat
  /// blob, which is why its restore had to re-wrap the user by hand.)
  Map<String, dynamic> toJson() => {
    'accessToken': accessToken,
    'refreshToken': refreshToken,
    'refreshExpiresAt': refreshExpiresAt.toIso8601String(),
    'user': {
      'id': userId,
      'phoneNumber': phoneNumber,
      'fullName': fullName,
      'role': role,
      'isNewUser': isNewUser,
    },
  };

  AuthSession copyWith({
    String? accessToken,
    String? refreshToken,
    DateTime? refreshExpiresAt,
  }) =>
      AuthSession(
        accessToken: accessToken ?? this.accessToken,
        refreshToken: refreshToken ?? this.refreshToken,
        refreshExpiresAt: refreshExpiresAt ?? this.refreshExpiresAt,
        userId: userId,
        phoneNumber: phoneNumber,
        fullName: fullName,
        role: role,
        isNewUser: isNewUser,
      );
}