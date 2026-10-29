class SpecialistSummary {
  final String id;
  final String fullName;
  final String phone;
  final String? avatarUrl;
  final String? bio;
  final List<String> skills;
  final bool offersMobileService;

  SpecialistSummary({
    required this.id,
    required this.fullName,
    required this.phone,
    this.avatarUrl,
    this.bio,
    this.skills = const [],
    this.offersMobileService = false,
  });

  factory SpecialistSummary.fromJson(Map<String, dynamic> json) {
    return SpecialistSummary(
      id: json['id'] as String,
      fullName: json['fullName'] as String,
      phone: json['phone'] as String,
      avatarUrl: json['avatarUrl'] as String?,
      bio: json['bio'] as String?,
      skills: (json['skills'] as List?)?.map((e) => e.toString()).toList() ?? [],
      offersMobileService: json['offersMobileService'] as bool? ?? false,
    );
  }
}