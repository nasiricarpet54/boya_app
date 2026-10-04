/// The signed-in customer, as returned by `POST /auth/otp/verify`.
///
/// The API answers with `{token, user}`; this flattens the nested user into a
/// single value object so the token can be cached as one JSON blob.
class AuthSession {
  const AuthSession({
    required this.token,
    required this.userId,
    required this.phoneNumber,
    required this.fullName,
    required this.role,
    required this.isNewUser,
  });

  factory AuthSession.fromApi(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>? ?? const {};
    return AuthSession(
      token: json['token'] as String? ?? '',
      userId: user['id'] as String? ?? '',
      phoneNumber: user['phoneNumber'] as String? ?? '',
      fullName: user['fullName'] as String?,
      role: user['role'] as String? ?? 'customer',
      isNewUser: user['isNewUser'] as bool? ?? false,
    );
  }

  final String token;
  final String userId;
  final String phoneNumber;

  /// Null until the customer completes their profile.
  final String? fullName;

  final String role;

  /// True on the very first successful verify, used to drive onboarding.
  final bool isNewUser;

  Map<String, dynamic> toJson() => {
    'token': token,
    'userId': userId,
    'phoneNumber': phoneNumber,
    'fullName': fullName,
    'role': role,
    'isNewUser': isNewUser,
  };
}