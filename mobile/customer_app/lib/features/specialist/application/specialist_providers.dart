import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/api_client.dart';
import '../data/specialist_api.dart';
import '../domain/specialist_summary.dart';

final specialistApiProvider = Provider<SpecialistApi>((ref) {
  return SpecialistApi(ref.watch(dioProvider));
});

final mobileSpecialistsProvider = FutureProvider<List<SpecialistSummary>>((ref) async {
  return ref.watch(specialistApiProvider).getMobileSpecialists();
});