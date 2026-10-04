import 'salon_user.dart';

/// The signed-in salon staff user, as returned by `POST /auth/otp/verify`.
///
/// The API answers with `{token, user}`; this keeps that shape so the session
/// can be cached as one JSON blob.
class AuthSession {
  const AuthSession({required this.token, required this.user});

  factory AuthSession.fromApi(Map<String, dynamic> json) => AuthSession(
        token: json['token'] as String? ?? '',
        user: SalonUser.fromJson(json['user'] as Map<String, dynamic>? ?? const {}),
      );

  final String token;
  final SalonUser user;

  Map<String, dynamic> toJson() => {'token': token, 'user': user.toJson()};
}