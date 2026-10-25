/// Abstract map service to avoid direct dependency on Neshan if needed
abstract class MapService {
  Future<MapLocation?> pickLocation();
  Future<String?> reverseGeocode(double lat, double lng);
}

class MapLocation {
  final double latitude;
  final double longitude;
  final String? address;

  const MapLocation({
    required this.latitude,
    required this.longitude,
    this.address,
  });
}
