import 'package:flutter/material.dart';

class BoyaLayout {
  BoyaLayout._();

  static const double mobileMaxWidth = 600;
  static const double tabletMaxWidth = 900;

  static const EdgeInsets defaultPadding = EdgeInsets.all(16.0);

  static bool isMobile(BuildContext context) =>
      MediaQuery.of(context).size.width < mobileMaxWidth;

  static bool isTablet(BuildContext context) =>
      MediaQuery.of(context).size.width >= mobileMaxWidth &&
      MediaQuery.of(context).size.width < tabletMaxWidth;

  static bool isDesktop(BuildContext context) =>
      MediaQuery.of(context).size.width >= tabletMaxWidth;
}

class BoyaResponsiveWrapper extends StatelessWidget {
  final Widget mobile;
  final Widget? tablet;
  final Widget? desktop;

  const BoyaResponsiveWrapper({
    super.key,
    required this.mobile,
    this.tablet,
    this.desktop,
  });

  @override
  Widget build(BuildContext context) {
    if (BoyaLayout.isDesktop(context) && desktop != null) {
      return desktop!;
    }
    if (BoyaLayout.isTablet(context) && tablet != null) {
      return tablet!;
    }
    return mobile;
  }
}
