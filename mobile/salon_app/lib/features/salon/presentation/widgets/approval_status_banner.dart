import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/salon_api.dart';
import '../../domain/salon_status.dart';

/// Tells the salon where its last edit stands, and is the only place the
/// approval lifecycle reaches the UI.
///
/// Renders nothing in the settled state (approved with nothing queued), so the
/// profile and the edit form can both drop it in unconditionally instead of
/// asking the API twice. Loading and error also render nothing: the banner is
/// an addition to a screen that already handles its own load failure, and a
/// banner that flashes a spinner on every tab switch is noise.
class ApprovalStatusBanner extends ConsumerWidget {
  const ApprovalStatusBanner({this.onEdit, super.key});

  /// Action of the "ویرایش مجدد" button on a rejected banner. Omit it where
  /// the user is already sitting on the edit form — the button would push a
  /// second copy of the screen on top of itself.
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statusAsync = ref.watch(salonStatusProvider);
    final info = statusAsync.value;
    if (info == null || info.isSettled) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: _StatusCard(info: info, onEdit: onEdit),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.info, this.onEdit});

  final SalonStatusInfo info;
  final VoidCallback? onEdit;

  /// The tone and the message for a state.
  ///
  /// Ordered by urgency, and the ordering is the point: a suspended salon that
  /// also has a queued edit has to read as suspended, because the queued edit
  /// is not going to be approved. Rejection outranks the pending check for the
  /// same reason — the admin already said no once.
  ({Color color, Color background, IconData icon, String message}) _tone() {
    if (info.status == SalonApprovalStatus.suspended) {
      return (
        color: BoyaColors.error,
        background: BoyaColors.errorSubtle,
        icon: Icons.block,
        message: 'سالن شما تعلیق شده',
      );
    }
    if (info.status == SalonApprovalStatus.rejected) {
      final reason = info.rejectionReason;
      return (
        color: BoyaColors.error,
        background: BoyaColors.errorSubtle,
        icon: Icons.cancel_outlined,
        message: reason == null ? 'تغییرات شما رد شد' : 'تغییرات رد شد: $reason',
      );
    }
    return (
      color: BoyaColors.warning,
      background: BoyaColors.warningSubtle,
      icon: Icons.hourglass_top_outlined,
      message: 'تغییرات در انتظار تایید',
    );
  }

  @override
  Widget build(BuildContext context) {
    final tone = _tone();
    // Only a rejection offers a retry, and only where there is somewhere to
    // retry from.
    final showAction = info.status == SalonApprovalStatus.rejected && onEdit != null;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: tone.background,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tone.color.withValues(alpha: 0.35)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(tone.icon, color: tone.color, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                tone.message,
                style: BoyaTypography.caption.copyWith(color: tone.color),
              ),
            ),
            if (showAction) ...[
              const SizedBox(width: 8),
              TextButton(
                onPressed: onEdit,
                style: TextButton.styleFrom(
                  foregroundColor: tone.color,
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                ),
                child: const Text('ویرایش مجدد'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}