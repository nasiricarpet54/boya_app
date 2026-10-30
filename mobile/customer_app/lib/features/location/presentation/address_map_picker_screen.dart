import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';


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
  
  LatLng? _position;
  final String _address = '';
  final String _title = 'home';
  final bool _loaded = false;

  @override
  void initState() {
    super.initState();
    // Map controller temporarily disabled due to package API update
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('انتخاب آدرس جدید')),
      body: _loaded && _position != null
          ? Container(color: Colors.grey[300], child: const Center(child: Text('نقشه موقتا غیرفعال است')))
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
    widget.onCreated({
      'title': _title,
      'address': _address,
      'latitude': _position!.latitude,
      'longitude': _position!.longitude,
    });
    if (mounted) context.pop();
  }
}





