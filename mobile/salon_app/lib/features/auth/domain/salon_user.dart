/// A staff user, as returned inside the session of `POST /auth/otp/verify`.
class SalonUser {
  const SalonUser({
    required this.id,
    required this.phoneNumber,
    required this.role,
    this.fullName,
    this.tenantId,
  });

  factory SalonUser.fromJson(Map<String, dynamic> json) => SalonUser(
        id: json['id'] as String? ?? '',
        phoneNumber: json['phoneNumber'] as String? ?? '',
        role: json['role'] as String? ?? '',
        fullName: json['fullName'] as String?,
        tenantId: json['tenantId'] as String?,
      );

  final String id;
  final String phoneNumber;

  /// Null until the user completes their profile.
  final String? fullName;

  final String role;

  /// Salon the user belongs to; null for users without a tenant yet.
  final String? tenantId;

  /// Roles allowed to operate the salon panel.
  bool get isSalonStaff =>
      role == 'salon_owner' || role == 'line_manager' || role == 'specialist';

  Map<String, dynamic> toJson() => {
        'id': id,
        'phoneNumber': phoneNumber,
        'role': role,
        'fullName': fullName,
        'tenantId': tenantId,
      };
}