/// One specialist of the signed-in salon, as returned by
/// `GET /salon/me/specialists`.
///
/// The backend joins the `users` row for identity: [userId] belongs to
/// `users`, [id] to the `specialists` row itself, and the name, phone and
/// avatar come from the user while bio, skills, commission and activity live
/// on the specialist. Everything except the two ids is optional so a
/// partially-filled row (a specialist created before the panel collected a
/// bio, for instance) still parses.
class SalonSpecialist {
  const SalonSpecialist({
    required this.id,
    required this.userId,
    this.fullName,
    this.phone,
    this.avatarUrl,
    this.bio,
    this.skills = const [],
    this.commissionRate = 50,
    this.isActive = true,
    this.bookingsCount = 0,
  });

  factory SalonSpecialist.fromJson(Map<String, dynamic> json) {
    return SalonSpecialist(
      id: '${json['id'] ?? ''}',
      userId: '${json['userId'] ?? json['user_id'] ?? ''}',
      fullName: json['fullName'] as String?,
      phone: json['phone'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      bio: json['bio'] as String?,
      skills: [
        for (final skill in json['skills'] as List<dynamic>? ?? const [])
          if (skill is String) skill,
      ],
      commissionRate: (json['commissionRate'] as num?)?.toDouble() ?? 50,
      isActive: json['isActive'] as bool? ?? true,
      bookingsCount: (json['bookingsCount'] as num?)?.toInt() ?? 0,
    );
  }

  final String id;
  final String userId;
  final String? fullName;
  final String? phone;
  final String? avatarUrl;
  final String? bio;
  final List<String> skills;
  final double commissionRate;
  final bool isActive;
  final int bookingsCount;

  /// First letter of the display name, for the avatar tile when there is no
  /// photo. Names are Persian or Latin, so one UTF-16 unit is enough here
  /// and avoids pulling `package:characters` into the domain layer.
  String get initial {
    final name = fullName ?? '';
    return name.isEmpty ? 'م' : name.substring(0, 1);
  }
}

