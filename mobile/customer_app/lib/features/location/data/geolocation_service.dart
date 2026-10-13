import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

/// Device GPS for the «موقعیت من» entry and the «نزدیک من» feed.
///
/// Every failure resolves to `null` rather than throwing: the callers own the
/// user-facing copy («دسترسی به موقعیت ممکن نیست») and a stack trace here adds
/// nothing to it. The permission chain is walked in order — location service,
/// then a permission request, then the `deniedForever` state — because only the
/// first two are recoverable from inside the app.
class GeolocationService {
  /// The device's current position, or `null` when GPS is off, the permission is
  /// denied, or no fix arrives within the time limit.
  Future<Position?> getCurrentPosition() async {
    // A device with location services off cannot be helped by a permission
    // prompt, so it is checked first and reported as "unavailable".
    if (!await Geolocator.isLocationServiceEnabled()) return null;

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return null;
    }

    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          // `medium` is enough to pick a city and costs less battery than `high`,
          // which chases a precision the feed does not use.
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 15),
        ),
      );
    } catch (_) {
      // A timeout, a lost location lock, or an unreachable platform service are
      // not exceptional from the customer's point of view — the caller tells
      // them the position could not be found.
      return null;
    }
  }
}

final geolocationServiceProvider =
    Provider<GeolocationService>((ref) => GeolocationService());
