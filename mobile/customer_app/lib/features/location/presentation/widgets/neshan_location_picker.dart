import 'package:flutter/material.dart';
import 'package:neshan_maps_flutter/neshan_maps_flutter.dart';

class NeshanLocationPicker extends StatefulWidget {
  final Function(LatLng) onLocationSelected;

  const NeshanLocationPicker({
    super.key,
    required this.onLocationSelected,
  });

  @override
  State<NeshanLocationPicker> createState() => _NeshanLocationPickerState();
}

class _NeshanLocationPickerState extends State<NeshanLocationPicker> {
  NeshanMapController? mapController;
  LatLng _center = const LatLng(35.699739, 51.338097); // Tehran default
  bool _isMoving = false;

  void _onMapCreated(NeshanMapController controller) {
    mapController = controller;
  }

  void _onCameraMove(CameraPosition position) {
    setState(() {
      _center = position.target;
      _isMoving = true;
    });
  }

  void _onCameraIdle() {
    setState(() {
      _isMoving = false;
    });
    // In a real flow, trigger reverse geocoding here
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        NeshanMap(
          mapType: MapType.normal,
          initialCameraPosition: CameraPosition(
            target: _center,
            zoom: 15,
          ),
          onMapCreated: _onMapCreated,
          onCameraMove: _onCameraMove,
          onCameraIdle: _onCameraIdle,
          mapStyle: 'YOUR_NESHAN_MAP_KEY_PLACEHOLDER', // Placeholder
        ),
        // Center Pin
        IgnorePointer(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                transform: Matrix4.translationValues(0, _isMoving ? -10 : 0, 0),
                child: Icon(
                  Icons.location_on,
                  size: 40,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
              const SizedBox(height: 20), // Shadow spacing
            ],
          ),
        ),
        // Action Button
        Positioned(
          bottom: 24,
          left: 24,
          right: 24,
          child: ElevatedButton(
            onPressed: _isMoving ? null : () => widget.onLocationSelected(_center),
            child: const Text('تایید موقعیت'),
          ),
        )
      ],
    );
  }
}
