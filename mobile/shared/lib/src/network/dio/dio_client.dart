import 'package:dio/dio.dart';
import 'mock_interceptor.dart';

class DioClient {
  static final DioClient _instance = DioClient._internal();

  factory DioClient() => _instance;

  late final Dio dio;

  DioClient._internal() {
    dio = Dio(
      BaseOptions(
        baseUrl: 'https://api.boya.test', // Placeholder
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Add Mock Interceptor for the pilot phase
    dio.interceptors.add(MockInterceptor());

    // Can add auth and logging interceptors here
  }
}
