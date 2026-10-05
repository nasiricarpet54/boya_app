/// Roles the salon panel admits.
///
/// Mirrors `STAFF_ROLES` in `backend/src/modules/salon/salon.service.ts`
/// (`salon_owner`, `line_manager`, `specialist`, `admin`) — the same set the
/// API uses to decide whether a caller may read the panel. `customer` is the
/// only role the backend ever hands out that is absent here.
///
/// This is an allow-list on purpose. The panel exposes finance, staff and
/// service-line management, so a role this app has never heard of must be
/// refused rather than waved through: unknown and blank roles fail closed.
const Set<String> salonPanelRoles = {
  'salon_owner',
  'line_manager',
  'specialist',
  'admin',
};

/// Whether [role] may enter the salon panel.
///
/// Null, empty and unrecognised roles are all denied. The router calls this on
/// every navigation, so a cached session whose role no longer qualifies is
/// bounced to the forbidden screen instead of the dashboard.
bool hasSalonAccess(String? role) =>
    role != null && salonPanelRoles.contains(role);

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

  /// Whether this user may enter the salon panel.
  ///
  /// Reads [salonPanelRoles] directly rather than calling the top-level
  /// [hasSalonAccess], which this getter would otherwise shadow.
  bool get hasSalonAccess => salonPanelRoles.contains(role);

  Map<String, dynamic> toJson() => {
        'id': id,
        'phoneNumber': phoneNumber,
        'role': role,
        'fullName': fullName,
        'tenantId': tenantId,
      };
}