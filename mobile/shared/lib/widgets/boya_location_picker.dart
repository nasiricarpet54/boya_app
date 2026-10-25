import 'package:flutter/material.dart';

class BoyaLocationPicker extends StatelessWidget {
  const BoyaLocationPicker({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    // Fallback abstract location picker
    return const Scaffold(
      body: Center(child: Text('Location Picker Placeholder')),
    );
  }
}
