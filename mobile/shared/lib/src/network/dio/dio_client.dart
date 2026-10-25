import 'package:dio/dio.dart';
import 'package:dio_cache_interceptor/dio_cache_interceptor.dart';
import 'mock_interceptor.dart';

class DioClient {
  static final DioClient _instance = DioClient._internal();

  factory DioClient() => _instance;

  late final Dio dio;
  late final CacheOptions cacheOptions;

  DioClient._internal() {
    // Configure cache with memory store for the pilot
    final cacheStore = MemCacheStore();

    cacheOptions = CacheOptions(
      store: cacheStore,
      policy: CachePolicy.request, // Request first, fallback to cache
      maxStale: const Duration(days: 1),
      priority: CachePriority.normal,
      keyBuilder: CacheOptions.defaultCacheKeyBuilder,
      allowPostMethod: false, // Don't cache POST
    );

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

    dio.interceptors.add(DioCacheInterceptor(options: cacheOptions));
    // Custom interceptor for dynamic cache expiration based on routes
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          // No Cache for sensitive routes
          if (options.path.contains('/appointments') ||
              options.path.contains('/cart') ||
              options.path.contains('/payment') ||
              options.path.contains('/otp') ||
              options.path.contains('/auth')) {
            options.extra.addAll(
              cacheOptions.copyWith(policy: CachePolicy.noCache).toExtra(),
            );
          }
          // 10 minutes cache for salons & services
          else if (options.path.contains('/salons') ||
              options.path.contains('/services')) {
            options.extra.addAll(
              CacheOptions(
                store: cacheStore,
                policy: CachePolicy.request,
                maxStale: const Duration(minutes: 10),
                priority: CachePriority.normal,
                keyBuilder: CacheOptions.defaultCacheKeyBuilder,
                allowPostMethod: false,
              ).toExtra(),
            );
          }
          // 5 minutes cache for other general GETs
          else if (options.method.toUpperCase() == 'GET') {
            options.extra.addAll(
              CacheOptions(
                store: cacheStore,
                policy: CachePolicy.request,
                maxStale: const Duration(minutes: 5),
                priority: CachePriority.normal,
                keyBuilder: CacheOptions.defaultCacheKeyBuilder,
                allowPostMethod: false,
              ).toExtra(),
            );
          }
          return handler.next(options);
        },
      ),
    );

    // Add Mock Interceptor for the pilot phase
    dio.interceptors.add(MockInterceptor());
  }
}
