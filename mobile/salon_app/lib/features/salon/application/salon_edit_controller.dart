import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/salon_api.dart';
import '../domain/salon_status.dart';

/// Owns the save button state of the salon edit form.
///
/// The state is the whole `AsyncValue<void>` rather than a bare bool so the
/// form can render an inline error straight from the controller, the same way
/// the read-only screens render theirs from a `FutureProvider`.
class SalonEditController extends Notifier<AsyncValue<void>> {
  @override
  AsyncValue<void> build() => const AsyncData(null);

  /// Sends the edited fields to `PATCH /salon/me`.
  ///
  /// Returns [SalonApprovalStatus.pendingApproval] on success — the only
  /// outcome the API reports for a gated write, and the one the form confirms
  /// to the user. Throws on anything else, leaving [state] in an error the
  /// caller can read instead of swallowing it.
  ///
  /// Both providers are invalidated on success so the profile card and the
  /// approval banner re-read the API. The profile is re-read even though the
  /// live row has not changed yet: the point is that the header must stop
  /// showing a stale approval state on the way back.
  Future<SalonApprovalStatus> submitChanges({
    String? name,
    String? address,
    String? phone,
    String? coverImage,
    Map<String, dynamic>? workingHours,
  }) async {
    state = const AsyncLoading();
    try {
      final status = await ref.read(salonApiProvider).patchSalon(
            name: name,
            address: address,
            phone: phone,
            coverImage: coverImage,
            workingHours: workingHours,
          );
      ref.invalidate(salonStatusProvider);
      ref.invalidate(salonProfileProvider);
      state = const AsyncData(null);
      return status;
    } catch (error, stackTrace) {
      state = AsyncError<void>(error, stackTrace);
      rethrow;
    }
  }
}

final salonEditControllerProvider =
    NotifierProvider<SalonEditController, AsyncValue<void>>(SalonEditController.new);