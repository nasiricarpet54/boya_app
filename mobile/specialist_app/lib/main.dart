import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('fa_IR');
  runApp(const ProviderScope(child: SpecialistRoot()));
}

class SpecialistRoot extends StatelessWidget {
  const SpecialistRoot({super.key});

  @override
  Widget build(BuildContext context) {
    return boyaMaterialApp(title: 'پنل متخصص', home: const SpecialistShell());
  }
}
