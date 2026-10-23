/// Neshan Maps API keys configuration for the customer app.
///
/// **Security:** Do not hardcode production keys. Load them at runtime via environment
/// variables using `const String.fromEnvironment('NESHAN_MAP_API_KEY')`.
/// Placeholders are empty to allow offline development (map errors will be shown).
abstract class NeshanKeys {
  /// Neshan map key — must be a Web key from platform.neshan.org.
  static const String mapKey = String.fromEnvironment('NESHAN_MAP_API_KEY', defaultValue: '');

  /// Reverse geocoding API key (used by location picker for address bar).
  static const String reverseGeocodingKey =
      String.fromEnvironment('NESHAN_REVERSE_GEOCODING_KEY', defaultValue: '');

  /// Search API key (optional; for advanced location search).
  static const String searchKey = String.fromEnvironment('NESHAN_SEARCH_API_KEY', defaultValue: '');
}