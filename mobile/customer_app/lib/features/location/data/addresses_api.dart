import 'package:dio/dio.dart';

import '../domain/customer_address.dart';

/// GET /customer/addresses — the customer's saved addresses, consumed by the
/// booking form's address picker (no manual address entry: decision 6).
Future<List<CustomerAddress>> fetchCustomerAddresses(Dio dio) async {
  final response = await dio.get<List<dynamic>>('/customer/addresses');
  if (response.data == null) return const [];
  return response.data!
      .map((item) => CustomerAddress.fromJson(item as Map<String, dynamic>))
      .toList();
}

/// POST /customer/addresses — create a new saved address.
Future<CustomerAddress> createCustomerAddress(
  Dio dio,
  String title,
  String address,
  double latitude,
  double longitude, {
  bool isDefault = true,
}) async {
  final response = await dio.post<Map<String, dynamic>>(
    '/customer/addresses',
    data: {
      'title': title,
      'address': address,
      'latitude': latitude,
      'longitude': longitude,
      if (isDefault) 'isDefault': true,
    },
  );
  return CustomerAddress.fromJson(response.data!);
}

/// PATCH /customer/addresses/:id — edit title/text of a saved address.
Future<void> updateCustomerAddress(
  Dio dio,
  String id,
  String? title,
  String? address,
) async {
  await dio.patch('/customer/addresses/$id', data: {
    if (title != null) 'title': title,
    if (address != null) 'address': address,
  });
}

/// PATCH /customer/addresses/:id/default — promote an address to the only
/// default (the previous default turns off: decision 5).
Future<void> setDefaultCustomerAddress(Dio dio, String id) async {
  await dio.patch('/customer/addresses/$id/default');
}

/// DELETE /customer/addresses/:id
Future<void> deleteCustomerAddress(Dio dio, String id) async {
  await dio.delete('/customer/addresses/$id');
}
