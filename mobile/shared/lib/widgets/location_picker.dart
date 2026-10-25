import 'package:flutter/material.dart';
import '../services/map_service.dart';

class LocationPicker extends StatefulWidget {
  final ValueChanged<MapLocation> onLocationSelected;

  const LocationPicker({Key? key, required this.onLocationSelected})
    : super(key: key);

  @override
  State<LocationPicker> createState() => _LocationPickerState();
}

class _LocationPickerState extends State<LocationPicker> {
  // We use a mock location for the pilot since neshan_maps_flutter has dependency issues
  // Real implementation would use the map controller.

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('انتخاب موقعیت مکانی (آزمایشی)')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.map, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            const Text('نقشه در حالت آزمایشی'),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: () {
                widget.onLocationSelected(
                  const MapLocation(
                    latitude: 35.6892,
                    longitude: 51.3890,
                    address: 'میدان آزادی، تهران',
                  ),
                );
                Navigator.of(context).pop();
              },
              child: const Text('تأیید موقعیت تستی (تهران)'),
            ),
          ],
        ),
      ),
    );
  }
}
