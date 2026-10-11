/// One bookable service of a salon, as returned in `services` by
/// `GET /salons/{id}`.
class SalonService {
  const SalonService({
    required this.id,
    required this.name,
    required this.price,
    this.description,
    this.isMobileAvailable = false,
  });

  factory SalonService.fromJson(Map<String, dynamic> json) {
    return SalonService(
      id: (json['id'] as String?) ?? '',
      name: (json['name'] as String?) ?? '',
      description: json['description'] as String?,
      price: _toInt(json['price']),
      isMobileAvailable: json['isMobileAvailable'] as bool? ?? false,
    );
  }

  final String id;
  final String name;

  /// Optional long text; the catalogue leaves it null for most services.
  final String? description;

  /// Price in Toman. Postgres numerics may arrive as strings, so this is parsed
  /// leniently rather than cast.
  final int price;

  /// ADR-011: whether this service can be delivered away from the salon. Set
  /// per service because some need fixed equipment a travelling specialist
  /// cannot carry.
  final bool isMobileAvailable;
}

/// A specialist of a salon, as returned in `specialists` by `GET /salons/{id}`.
class SalonSpecialist {
  const SalonSpecialist({
    required this.id,
    required this.fullName,
    this.avatarUrl,
    this.bio,
    this.skills = const <String>[],
    this.offersMobileService = false,
  });

  final String id;
  final String fullName;
  final String? avatarUrl;
  final String? bio;
  final List<String> skills;

  /// ADR-011: whether this specialist travels to the customer. Independent of
  /// any one service's own flag — both must be true for an on-site booking.
  final bool offersMobileService;

  factory SalonSpecialist.fromJson(Map<String, dynamic> json) {
    return SalonSpecialist(
      id: '${json['id']}',
      fullName: '${json['fullName'] ?? json['full_name'] ?? 'متخصص'}',
      avatarUrl: json['avatarUrl'] as String?,
      bio: json['bio'] as String?,
      skills: (json['skills'] as List?)?.cast<String>() ?? const <String>[],
      offersMobileService: json['offersMobileService'] as bool? ?? false,
    );
  }
}

/// One portfolio photo of a specialist, as returned in `data` by
/// `GET /salons/{id}/portfolio`.
///
/// The API flattens every active specialist's `portfolio_images` into this one
/// shape, so the caller does not have to walk the specialist list.
class PortfolioItem {
  const PortfolioItem({
    required this.id,
    required this.imageUrl,
    required this.specialistId,
    this.specialistName,
  });

  factory PortfolioItem.fromJson(Map<String, dynamic> json) {
    return PortfolioItem(
      id: '${json['id'] ?? ''}',
      imageUrl: '${json['imageUrl'] ?? json['image_url'] ?? ''}',
      specialistId: '${json['specialistId'] ?? json['specialist_id'] ?? ''}',
      specialistName: _toText(json['specialistName'] ?? json['specialist_name']),
    );
  }

  /// Stable key of the image: its own id when the salon app stored one,
  /// otherwise a key the API derived from the specialist and the element index.
  final String id;

  /// Absolute URL of the photo.
  final String imageUrl;

  final String specialistId;

  /// Null when the specialist's user row has no full name.
  final String? specialistName;

  /// True when there is something a grid tile or viewer can actually show.
  bool get isUsable => imageUrl.trim().isNotEmpty;
}

/// One row of `GET /salons/{id}`.
///
/// Every optional field is parsed leniently: the API nulls out `coverImage`,
/// `phone`, `address`, `distanceKm` and `discountPercent` depending on what the
/// salon filled in, and only sends `distanceKm` when the caller passed
/// coordinates.
class SalonDetail {
  const SalonDetail({
    required this.id,
    required this.name,
    required this.services,
    required this.specialists,
    this.portfolio = const <PortfolioItem>[],
    this.nameEn,
    this.specialty,
    this.slug,
    this.phone,
    this.coverImage,
    this.address,
    this.rating = 0.0,
    this.reviewCount = 0,
    this.distanceKm,
    this.discountPercent,
    this.minPrice = 0,
    this.tags = const <String>[],
    this.isOpenNow = false,
    this.latitude,
    this.longitude,
    this.workingHours = const <String, dynamic>{},
    this.settings = const <String, dynamic>{},
  });

  final String id;
  final String name;

  /// English name, when the salon set one.
  final String? nameEn;

  /// Category label, e.g. رنگ و هایلایت.
  final String? specialty;

  final String? slug;
  final String? phone;

  /// Absolute URL of the cover photo; null when the salon has none.
  final String? coverImage;

  final String? address;

  /// 0.0 – 5.0.
  final double rating;
  final int reviewCount;

  /// Null when the request carried no coordinates, or the salon has no lat/lng.
  final double? distanceKm;

  /// Null when the salon has no active promotion.
  final int? discountPercent;

  /// Cheapest bookable service, in Toman.
  final int minPrice;

  final List<String> tags;
  final bool isOpenNow;

  final double? latitude;
  final double? longitude;

  /// Weekly schedule keyed by Jalali day (`sat` … `fri`).
  final Map<String, dynamic> workingHours;

  final Map<String, dynamic> settings;

  final List<SalonService> services;

  /// Active specialists of the salon, as sent by `GET /salons/{id}`.
  final List<SalonSpecialist> specialists;

  /// Portfolio photos of the salon's active specialists — the «نمونه‌کارها»
  /// tab. Empty while the salon published nothing.
  final List<PortfolioItem> portfolio;

  factory SalonDetail.fromJson(Map<String, dynamic> json) {
    final rows = json['services'];
    return SalonDetail(
      id: (json['id'] as String?) ?? '',
      name: (json['name'] as String?) ?? '',
      nameEn: json['nameEn'] as String?,
      specialty: json['specialty'] as String?,
      slug: json['slug'] as String?,
      phone: json['phone'] as String?,
      coverImage: json['coverImage'] as String?,
      address: json['address'] as String?,
      rating: (json['rating'] as num?)?.toDouble() ?? 0.0,
      reviewCount: (json['reviewCount'] as num?)?.toInt() ?? 0,
      distanceKm: (json['distanceKm'] as num?)?.toDouble(),
      discountPercent: (json['discountPercent'] as num?)?.toInt(),
      minPrice: (json['minPrice'] as num?)?.toInt() ?? 0,
      tags: (json['tags'] as List?)?.cast<String>() ?? const <String>[],
      isOpenNow: json['isOpenNow'] as bool? ?? false,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      workingHours: _toMap(json['workingHours']),
      settings: _toMap(json['settings']),
      services: [
        for (final row in (rows as List? ?? const <dynamic>[]))
          if (row is Map<String, dynamic>) SalonService.fromJson(row),
      ],
      specialists: [
        for (final row in (json['specialists'] as List? ?? const <dynamic>[]))
          if (row is Map<String, dynamic>) SalonSpecialist.fromJson(row),
      ],
      portfolio: [
        for (final row in (json['portfolio'] as List? ?? const <dynamic>[]))
          if (row is Map<String, dynamic>) PortfolioItem.fromJson(row),
      ],
    );
  }
}

/// Postgres `numeric` columns arrive as strings, so prices are parsed rather
/// than cast. Anything unparseable falls back to 0.
int _toInt(Object? value) {
  if (value is num) return value.toInt();
  return num.tryParse('$value')?.toInt() ?? 0;
}

Map<String, dynamic> _toMap(Object? value) {
  if (value is Map) return value.map((key, item) => MapEntry('$key', item));
  return const <String, dynamic>{};
}

/// Optional display text that may arrive as null or an empty string; both become
/// null so a caller can test one case instead of two.
String? _toText(Object? value) {
  if (value == null) return null;
  final text = '$value'.trim();
  return text.isEmpty ? null : text;
}
