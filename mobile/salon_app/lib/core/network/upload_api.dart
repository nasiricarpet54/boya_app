import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_client.dart';

/// CRUD-less client for `POST /upload/image` — the salon panel's image
/// upload behind the cover photo, the specialist portrait and the portfolio
/// gallery. Token-protected, so the interceptor attaches the bearer header;
/// the tenant directory comes from the verified JWT on the backend.
class UploadApi {
  UploadApi(this._dio);

  final Dio _dio;

  /// Uploads one image as multipart (`file` + `category`) and returns the
  /// stored public URL (`/uploads/{tenant}/{category}/{uuid}.{ext}`).
  ///
  /// The bytes — not a file path — are sent, because the picker's `XFile`
  /// has no filesystem path on the web build, where the panel also runs.
  /// The backend answers with the Persian error messages for a wrong MIME
  /// type or an oversized file; the caller renders them via `messageFromDio`.
  Future<String> uploadImage({
    required Uint8List bytes,
    required String filename,
    required String category,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/upload/image',
      data: FormData.fromMap({
        'file': MultipartFile.fromBytes(bytes, filename: filename),
        'category': category,
      }),
    );
    return response.data?['url'] as String? ?? '';
  }
}

final uploadApiProvider = Provider<UploadApi>(
  (ref) => UploadApi(ref.watch(dioProvider)),
);

/// Turns a stored `/uploads/...` path into an absolute URL on the API
/// origin, so `Image.network`/`NetworkImage` can fetch it from a different
/// origin than the one serving the app (the app and the API only share a
/// host behind Caddy).
///
/// Absolute URLs (the free-form ones from before local storage) and other
/// schemes pass through untouched — only paths under this app's own origin
/// are rebased.
String resolveUploadUrl(String url) {
  if (!url.startsWith('/')) return url;
  final base = Uri.parse(boyaApiBaseUrl);
  return base.replace(path: url).toString();
}
