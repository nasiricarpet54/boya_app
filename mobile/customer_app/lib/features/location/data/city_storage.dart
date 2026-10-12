import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// The keystore key the city picker persists the selection under.
const _kCityStorageKey = 'boya_customer_city_v1';

/// The province and city the customer last picked.
///
/// Ids only: the names are seeded reference data the picker re-resolves from
/// `/locations`, so caching them here would only let a renamed row go stale.
class StoredCity {
  const StoredCity({this.cityId, this.provinceId});

  final String? cityId;
  final String? provinceId;

  /// A row worth restoring needs a city; the province is carried along so the
  /// picker can re-open on the right list and the name can be resolved.
  static StoredCity? fromJson(Map<String, dynamic> json) {
    final cityId = json['cityId'] as String?;
    final provinceId = json['provinceId'] as String?;
    if (cityId == null || cityId.isEmpty) return null;
    return StoredCity(cityId: cityId, provinceId: provinceId);
  }

  Map<String, dynamic> toJson() => {
        if (cityId != null) 'cityId': cityId,
        if (provinceId != null) 'provinceId': provinceId,
      };
}

/// Where the selected city is persisted.
///
/// An interface so the controller can be tested without platform channels:
/// `flutter_secure_storage` needs a real device, which a unit test cannot
/// provide — the same reason `SessionStore` is abstract.
abstract class CityStorage {
  Future<StoredCity?> read();
  Future<void> write(String cityId, String provinceId);
  Future<void> clear();
}

/// Keeps the selection in the platform keystore (Keychain /
/// EncryptedSharedPreferences). The choice drives which salons the feed shows,
/// but it is not a credential, so a plaintext copy in SharedPreferences is not
/// worth the migration plumbing the session needed.
class SecureCityStorage implements CityStorage {
  SecureCityStorage({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  @override
  Future<StoredCity?> read() async {
    final raw = await _storage.read(key: _kCityStorageKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      return StoredCity.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      // A value this version cannot parse (a future format, a corrupt entry)
      // must not trap the customer: treat it as "no city chosen yet".
      return null;
    }
  }

  @override
  Future<void> write(String cityId, String provinceId) =>
      _storage.write(
        key: _kCityStorageKey,
        value: jsonEncode(StoredCity(cityId: cityId, provinceId: provinceId).toJson()),
      );

  @override
  Future<void> clear() => _storage.delete(key: _kCityStorageKey);
}

/// Test double: keeps the selection in memory for the lifetime of the test.
class InMemoryCityStorage implements CityStorage {
  StoredCity? stored;

  @override
  Future<StoredCity?> read() async => stored;

  @override
  Future<void> write(String cityId, String provinceId) async =>
      stored = StoredCity(cityId: cityId, provinceId: provinceId);

  @override
  Future<void> clear() async => stored = null;
}

final cityStorageProvider = Provider<CityStorage>((ref) => SecureCityStorage());
