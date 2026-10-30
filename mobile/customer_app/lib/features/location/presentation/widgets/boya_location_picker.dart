import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:neshan_maps_flutter/location_picker.dart';

import '../../../../config/neshan_map_keys.dart';

/// BOYA-styled location picker wrapper around NeshanLocationPicker.
///
/// It displays a dialog containing the interactive map, with a minimal styling.
/// On success, it calls [onLocationAccepted] with the selected position and
/// the reverse-geocoded address (may be empty if Neshan key missing).
/// If the map fails to load (missing keys or error), an error message is shown.
class BoyaLocationPicker extends StatefulWidget {
  const BoyaLocationPicker({
    super.key,
    required this.onLocationAccepted,
    this.initialCenter,
    this.initialZoom = 15,
  });

  final Function(LatLng position, String address)? onLocationAccepted;
  final LatLng? initialCenter;
  final double initialZoom;

  @override
  State<BoyaLocationPicker> createState() => _BoyaLocationPickerState();
}

class _BoyaLocationPickerState extends State<BoyaLocationPicker> {
  @override
  Widget build(BuildContext context) {
    // Use LocationPicker from neshan_maps_flutter.
    return Dialog(
      backgroundColor: BoyaColors.cream,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              border: Border(
                  bottom: BorderSide(color: BoyaColors.line, width: 0.5)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '������ ����?� ��? ����',
                  style: BoyaTypography.title.copyWith(color: BoyaColors.ink),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text('لغو', style: BoyaTypography.overline),
                ),
              ],
            ),
          ),
          // Map area with loading/error padding
          if (widget.initialCenter != null)
            SizedBox(
              height: 400,
              width: double.infinity,
              child: NeshanLocationPicker(
                mapKey: NeshanKeys.mapKey,
                reverseGeocodingApiKey: NeshanKeys.reverseGeocodingKey,
                searchApiKey: NeshanKeys.searchKey,
                enableDebug: false,
                mapConfig: NeshanMapConfig(
                  initialCenter: widget.initialCenter!,
                  initialZoom: widget.initialZoom,
                ),
                onLocationAccepted: (position, address) {
                  if (!mounted) return;
                  Navigator.of(context).pop();
                  widget.onLocationAccepted?.call(position, address);
                },
                onError: (message, exception, stackTrace) {
                  debugPrint('Location picker error: $message');
                },
              ),
            )
          else
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(
                child: CircularProgressIndicator(
                  color: BoyaColors.primary,
                ),
              ),
            ),
          // Footer note (optional)
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              '���? ��� ���ӡ ��� ���� ��� �� ��? ���� ������ ��?�.',
              style: BoyaTypography.caption,
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}