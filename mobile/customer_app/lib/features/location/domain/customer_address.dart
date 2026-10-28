/// Saved address the customer selects from (no manual entry â€” decision 6).
class CustomerAddress {
  const CustomerAddress({
    required this.id,
    required this.userId,
    required this.title,
    required this.address,
    required this.latitude,
    required this.longitude,
    required this.isDefault,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String userId;
  final String title;
  final String address;
  final double latitude;
  final double longitude;
  final bool isDefault;

  /// ISO-8601 timestamp returned by the API (`created_at`).
  final String createdAt;
  final String updatedAt;

  factory CustomerAddress.fromJson(Map<String, dynamic> json) {
    return CustomerAddress(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      title: json['title'] as String,
      address: json['address'] as String,
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      isDefault: json['is_default'] as bool? ?? false,
      createdAt: json['created_at'] as String? ?? '',
      updatedAt: json['updated_at'] as String? ?? '',
    );
  }

  CustomerAddress copyWith({
    String? id,
    String? userId,
    String? title,
    String? address,
    double? latitude,
    double? longitude,
    bool? isDefault,
    String? createdAt,
    String? updatedAt,
  }) =>
      CustomerAddress(
        id: id ?? this.id,
        userId: userId ?? this.userId,
        title: title ?? this.title,
        address: address ?? this.address,
        latitude: latitude ?? this.latitude,
        longitude: longitude ?? this.longitude,
        isDefault: isDefault ?? this.isDefault,
        createdAt: createdAt ?? this.createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'user_id': userId,
        'title': title,
        'address': address,
        'latitude': latitude,
        'longitude': longitude,
        'is_default': isDefault,
        'created_at': createdAt,
        'updated_at': updatedAt,
      };

  @override
  String toString() =>
      'CustomerAddress(id: $id, title: $title, isDefault: $isDefault)';
}

