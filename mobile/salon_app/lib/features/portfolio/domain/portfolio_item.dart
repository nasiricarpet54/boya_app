/// One portfolio photo of the salon, as flattened by
/// `GET /salon/me/portfolio`. [createdAt] is the element's own timestamp when
/// it carries one, otherwise the specialist row's creation time.
class PortfolioItem {
  const PortfolioItem({
    required this.id,
    required this.imageUrl,
    required this.specialistId,
    this.specialistName,
    this.createdAt,
  });

  factory PortfolioItem.fromJson(Map<String, dynamic> json) {
    return PortfolioItem(
      id: json['id'] as String? ?? '',
      imageUrl: json['imageUrl'] as String? ?? '',
      specialistId: json['specialistId'] as String? ?? '',
      specialistName: json['specialistName'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
    );
  }

  final String id;
  final String imageUrl;
  final String specialistId;
  final String? specialistName;
  final DateTime? createdAt;
}
