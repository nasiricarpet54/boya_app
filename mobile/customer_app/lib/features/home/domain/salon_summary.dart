/// Lightweight salon row rendered by the home feed.
///
/// Mirrors one item of `GET /salons`; see [SalonSummary.fromJson].
class SalonSummary {
  const SalonSummary({
    required this.id,
    required this.name,
    required this.specialty,
    required this.imageUrl,
    required this.rating,
    required this.reviewCount,
    required this.distanceKm,
    required this.discountPercent,
    required this.tags,
    required this.minPrice,
    this.cityId = '',
    this.provinceId = '',
    this.cityName = '',
    this.provinceName = '',
    this.isOpenNow = false,
    this.offersMobileService = false,
  });

  /// Parses one `GET /salons` item.
  ///
  /// Every number is treated as optional because the API omits or nulls them:
  /// `distanceKm` is null when the caller sent no coordinates, and a salon may
  /// not have a priceable service yet.
  factory SalonSummary.fromJson(Map<String, dynamic> json) => SalonSummary(
        id: (json['id'] as String?) ?? '',
        name: (json['name'] as String?) ?? '',
        specialty: (json['specialty'] as String?) ?? '',
        imageUrl: (json['coverImage'] as String?) ?? '',
        rating: (json['rating'] as num?)?.toDouble() ?? 0.0,
        reviewCount: (json['reviewCount'] as num?)?.toInt() ?? 0,
        distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 0,
        discountPercent: (json['discountPercent'] as num?)?.toInt(),
        tags:
            (json['tags'] as List?)?.whereType<String>().toList(growable: false) ??
                const <String>[],
        minPrice: (json['minPrice'] as num?)?.toInt() ?? 0,
        // The list endpoint reports only the ids so far; the names come later,
        // so absent is the normal case and the card falls back to the picker's
        // selected city, which is accurate while the feed is city-filtered.
        cityId: (json['cityId'] as String?) ?? '',
        provinceId: (json['provinceId'] as String?) ?? '',
        cityName: (json['cityName'] as String?) ?? '',
        provinceName: (json['provinceName'] as String?) ?? '',
        isOpenNow: json['isOpenNow'] as bool? ?? false,
        offersMobileService: json['offersMobileService'] as bool? ?? false,
      );

  final String id;
  final String name;

  /// Short category summary, e.g. رنگ مو و کراتین.
  final String specialty;

  final String imageUrl;

  /// 0.0 – 5.0.
  final double rating;
  final int reviewCount;

  /// 0 when the API had no reference point to measure from.
  final double distanceKm;

  /// `null` when the salon has no active promotion.
  final int? discountPercent;

  /// Service names shown as the third line, e.g. رنگ مو, کراتین.
  final List<String> tags;

  /// Cheapest bookable service, in Toman.
  final int minPrice;

  /// Whether the salon is serving at request time, Tehran clock.
  final bool isOpenNow;

  /// ADR-011: whether this salon has at least one specialist who travels to
  /// the customer. The list endpoint leaves it out until it has something to
  /// report, so absent means false and the card simply shows no car badge.
  final bool offersMobileService;

  /// `cities.id` of the salon's city. Empty until the list endpoint reports it.
  final String cityId;

  /// `provinces.id`, for detail screens that will group by province later.
  final String provinceId;

  /// Persian city name for the card's location line. Empty until the list
  /// endpoint reports it; see [SalonSummary.fromJson].
  final String cityName;

  final String provinceName;
}
