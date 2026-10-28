import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:neshan_maps_flutter/neshan_maps_flutter.dart';
import 'package:latlong2/latlong.dart';

import '../../domain/customer_address.dart';
import '../application/addresses_state.dart';
import '../data/addresses_api.dart';

/// Full-screen NeshanLocationPicker for a *new* address (decision 7:
/// full-screen picker, reached from the address sheet).
class NewAddressMapScreen extends StatefulWidget {
  const NewAddressMapScreen({super.key, required this.onCreated});

  /// Called with (title, address, latitude, longitude) when the pin is dropped.
  final ValueChanged<Map<String, dynamic>> onCreated;

  @override
  State<NewAddressMapScreen> createState() => _NewAddressMapScreenState();
}

class _NewAddressMapScreenState extends State<NewAddressMapScreen> {
  final _controller = MapController();
  LatLng? _position;
  String _address = '';
  String _title = 'home';
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _controller.currentLocation.onLocationAccepted = (location, address) {
      setState(() {
        _position = location;
        _address = address ?? _address;
        _loaded = true;
      });
    };
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('انتخاب آدرس جدید')),
      body: _loaded && _position != null
          ? NeshanMap(
            mapController: _controller,
            initialCameraPosition: CameraPosition(
              target: _position!,
              zoom: 17,
            ),
            myLocationEnabled: true,
          )
          : const Center(child: CircularProgressIndicator()),
      bottomNavigationBar: BottomAppBar(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _canProceed
                      ? () => _submit()
                      : null,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: BoyaColors.primary,
                    side: const BorderSide(color: BoyaColors.primary),
                  ),
                  icon: const Icon(Icons.check),
                  label: const Text('ذخیره آدرس'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  bool get _canProceed => _loaded && _position != null && _address.isNotEmpty;

  Future<void> _submit() async {
    if (!_canProceed) return;
    await widget.onCreated({
      'title': _title,
      'address': _address,
      'latitude': _position!.latitude,
      'longitude': _position!.longitude,
    });
    context.pop();
  }
}
