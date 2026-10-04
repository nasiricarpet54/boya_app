/// One tappable beauty category in the home grid.
class ServiceCategory {
  const ServiceCategory({
    required this.id,
    required this.label,
    required this.emoji,
    this.icon,
  });

  /// Builds one row of `GET /categories`.
  ///
  /// The API keys a category by `slug`, which is exactly what the grid sends
  /// back as `?category=`, so the slug becomes the id and `name` becomes the
  /// label.
  factory ServiceCategory.fromJson(Map<String, dynamic> json) {
    final slug = (json['slug'] as String?)?.trim();
    final name = (json['name'] as String?)?.trim();
    final emoji = (json['emoji'] as String?)?.trim();
    final icon = (json['icon'] as String?)?.trim();

    return ServiceCategory(
      id: slug != null && slug.isNotEmpty ? slug : (json['id'] as String? ?? ''),
      label: name ?? '',
      // A row saved before the glyph existed still needs something to render.
      emoji: emoji != null && emoji.isNotEmpty ? emoji : '💇',
      icon: icon != null && icon.isNotEmpty ? icon : null,
    );
  }

  /// Stable key so the catalog endpoint can map back to it later.
  final String id;

  final String label;

  /// Glyph drawn in the circle of the category cell.
  final String emoji;

  /// Material icon name from the API, once the design system adopts one.
  final String? icon;
}
