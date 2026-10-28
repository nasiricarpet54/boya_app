import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/addresses_api.dart';
import '../domain/customer_address.dart';

/// State + logic for the customer's saved addresses (booking form picker).
final addressesProvider = StateNotifierProvider<AddressesController, AddressesState>(
  (ref) => AddressesController(ref.read),
);

class AddressesState {
  const AddressesState({
    this.addresses = const [],
    this.selectedId,
    this.error,
    this.isLoading = false,
  });

  final List<CustomerAddress> addresses;
  final String? selectedId;
  final String? error;
  final bool isLoading;

  AddressesState copyWith({
    List<CustomerAddress>? addresses,
    String? selectedId,
    String? error,
    bool? isLoading,
  }) =>
      AddressesState(
        addresses: addresses ?? this.addresses,
        selectedId: selectedId ?? this.selectedId,
        error: error ?? this.error,
        isLoading: isLoading ?? this.isLoading,
      );

  bool get hasError => error != null;
  bool get isEmpty => addresses.isEmpty;
}

class AddressesController extends StateNotifier<AddressesState> {
  final Reader _read;

  AddressesController(this._read) : super(const AddressesState()) {
    _load();
  }

  Future<void> _load() async {
    state = state.copyWith(isLoading: true);
    try {
      state = state.copyWith(addresses: await fetchCustomerAddresses(_read), isLoading: false);
    } catch (error) {
      state = state.copyWith(error: error.toString(), isLoading: false);
    }
  }

  void select(CustomerAddress address) {
    state = state.copyWith(selectedId: address.id, error: null);
  }

  /// "Add address" — the map picker submits (title, address, lat, lng).
  Future<void> addAddress(String title, String address, double latitude, double longitude) async {
    try {
      final created = await createCustomerAddress(
        _read(),
        title,
        address,
        latitude,
        longitude,
        isDefault: true,
      );
      state = state.copyWith(
        addresses: [created, ...state.addresses],
        selectedId: created.id,
        error: null,
      );
    } catch (error) {
      state = state.copyWith(error: error.toString());
    }
  }

  void clearError() => state = state.copyWith(error: null);

  Future<void> refresh() async {
    await _load();
  }
}
