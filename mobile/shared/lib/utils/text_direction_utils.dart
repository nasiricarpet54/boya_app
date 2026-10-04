import 'package:flutter/widgets.dart';

/// Persian copy is RTL. Isolate card numbers, CVV, and codes with [ltr].
const TextDirection boyaTextDirection = TextDirection.rtl;

Widget rtl(Widget child) {
  return Directionality(textDirection: TextDirection.rtl, child: child);
}

/// Keeps a Latin fragment left-to-right inside Persian text.
Widget ltr(Widget child) {
  return Directionality(textDirection: TextDirection.ltr, child: child);
}
