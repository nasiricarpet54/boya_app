/// The approval lifecycle of a tenant, mirroring the backend
/// `approval_status` enum (migration 1730000000018) that
/// `GET /salon/me/status` reports.
///
/// The wire format is snake_case; [wireValue] is the only place the two
/// spellings meet, and [fromWire] is the only place one becomes the other.
enum SalonApprovalStatus {
  /// The DDL default: the row was created but no gated edit was ever sent.
  draft('draft'),

  /// An edit sits in `pending_changes` waiting for an admin decision.
  pendingApproval('pending_approval'),

  /// Live, and nothing queued behind it.
  approved('approved'),

  /// An admin turned the last edit down; see [SalonStatusInfo.rejectionReason].
  /// The backend drops `pending_changes` on a rejection, so the salon has to
  /// send its values again.
  rejected('rejected'),

  /// Unpublished by an admin. Nothing the salon sends will go live.
  suspended('suspended');

  const SalonApprovalStatus(this.wireValue);

  /// The value as it appears in the API payload.
  final String wireValue;

  /// Parses an API value, falling back to [draft] for anything unknown so a
  /// value added to the backend enum cannot crash the panel.
  static SalonApprovalStatus fromWire(String? value) {
    for (final status in values) {
      if (status.wireValue == value) return status;
    }
    return SalonApprovalStatus.draft;
  }
}

/// The approval state of the signed-in staff user's own salon, as returned by
/// `GET /salon/me/status`.
///
/// [status] and [hasPendingChanges] answer different questions and the UI needs
/// both: the status is the last decision an admin made, while
/// `hasPendingChanges` is true whenever a newer edit is queued *behind* that
/// decision. A salon that was approved last month and edited today is
/// `approved` with `hasPendingChanges: true`.
class SalonStatusInfo {
  const SalonStatusInfo({
    required this.status,
    required this.hasPendingChanges,
    this.rejectionReason,
  });

  factory SalonStatusInfo.fromJson(Map<String, dynamic> json) {
    final reason = json['rejectionReason'];
    return SalonStatusInfo(
      status: SalonApprovalStatus.fromWire(json['status'] as String?),
      hasPendingChanges: json['hasPendingChanges'] as bool? ?? false,
      // A blank reason is no reason at all; normalising it here keeps the
      // banner from rendering a dangling separator.
      rejectionReason: reason is String && reason.trim().isNotEmpty ? reason.trim() : null,
    );
  }

  final SalonApprovalStatus status;

  /// Set only while [status] is [SalonApprovalStatus.rejected]; cleared as
  /// soon as the salon resubmits.
  final String? rejectionReason;

  /// True while an edit is waiting for an admin decision.
  final bool hasPendingChanges;

  /// The one state that needs no banner: published, and nothing queued.
  bool get isSettled =>
      status == SalonApprovalStatus.approved && !hasPendingChanges;
}