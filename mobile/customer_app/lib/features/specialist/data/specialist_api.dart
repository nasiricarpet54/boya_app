import 'package:dio/dio.dart';
import '../domain/specialist_summary.dart';

class SpecialistApi {
  final Dio _dio;
  SpecialistApi(this._dio);

  Future<List<SpecialistSummary>> getMobileSpecialists() async {
    final response = await _dio.get('/customer/mobile-specialists');
    return (response.data as List)
        .map((e) => SpecialistSummary.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}