/// The salon of the signed-in staff user, as returned by `GET /salon/me`.
class SalonProfile {
  const SalonProfile({
    required this.id,
    required this.name,
    required this.status,
    required this.rating,
    required this.reviewCount,
    required this.workingHours,
    required this.specialistsCount,
    required this.servicesCount,
    this.slug,
    this.address,
    this.phone,
    this.coverImage,
  });

  factory SalonProfile.fromJson(Map<String, dynamic> json) => SalonProfile(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        slug: json['slug'] as String?,
        address: json['address'] as String?,
        phone: json['phone'] as String?,
        coverImage: json['coverImage'] as String?,
        status: json['status'] as String? ?? 'inactive',
        rating: (json['rating'] as num?)?.toDouble() ?? 0,
        reviewCount: (json['reviewCount'] as num?)?.toInt() ?? 0,
        workingHours: json['workingHours'] is Map<String, dynamic>
            ? json['workingHours'] as Map<String, dynamic>
            : const <String, dynamic>{},
        specialistsCount: (json['specialistsCount'] as num?)?.toInt() ?? 0,
        servicesCount: (json['servicesCount'] as num?)?.toInt() ?? 0,
      );

  final String id;
  final String name;
  final String? slug;
  final String? address;
  final String? phone;
  final String? coverImage;

  /// `active` or `inactive`.
  final String status;

  /// 0–5, Decimal(3,2) on the backend.
  final double rating;
  final int reviewCount;

  /// The `working_hours` JSONB, keyed sat…fri after the migration shape.
  final Map<String, dynamic> workingHours;

  final int specialistsCount;
  final int servicesCount;
}
