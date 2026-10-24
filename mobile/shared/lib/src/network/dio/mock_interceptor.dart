import 'package:dio/dio.dart';

class MockInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // For Pilot Phase: simulate network delay and return mock data based on path

    if (options.path.contains('/auth/otp')) {
      return handler.resolve(
        Response(
          requestOptions: options,
          statusCode: 200,
          data: {'success': true, 'message': 'OTP sent'},
        ),
      );
    }

    // Let real requests pass (if any) or handle more mocks
    super.onRequest(options, handler);
  }
}
