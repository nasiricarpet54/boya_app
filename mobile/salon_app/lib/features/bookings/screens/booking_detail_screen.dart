import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/api_client.dart';
import '../../../shared/widgets/salon_app_bar.dart';
import '../data/bookings_api.dart';
import '../domain/booking_summary.dart';
import '../widgets/booking_status_badge.dart';

/// A failure with the backend's own Persian message, plus a retry.
class _ErrorPane extends StatelessWidget {
  const _ErrorPane({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, style: BoyaTypography.body, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          TextButton(onPressed: onRetry, child: const Text('تلاش مجدد')),
        ],
      ),
    );
  }
}

/// One booking, with the actions its status allows.
///
/// The buttons are derived from the *loaded* booking rather than from the
/// route, so a booking that changed while this screen was open simply renders
/// as it now is — approving a booking the backend has already declined returns
/// 409, whose Persian message `messageFromDio` surfaces, and the screen then
/// re-reads the row instead of showing a stale one.
class BookingDetailScreen extends ConsumerWidget {
  const BookingDetailScreen({required this.id, super.key});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(bookingDetailProvider(id));

    return Scaffold(
      appBar: const SalonAppBar(title: 'جزئیات رزرو'),
      body: detailAsync.when(
        data: (detail) => _DetailBody(detail: detail),
        loading: () =>
            const Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
        error: (error, _) => _ErrorPane(
          message: messageFromDio(error),
          onRetry: () => ref.invalidate(bookingDetailProvider(id)),
        ),
      ),
    );
  }
}

class _DetailBody extends ConsumerWidget {
  const _DetailBody({required this.detail});

  final BookingDetail detail;

  BookingSummary get booking => detail.summary;

  /// Runs one action and replaces the row with what the backend returns.
  ///
  /// The write returns the refreshed booking, so [bookingDetailProvider] is
  /// given that value directly rather than invalidated — invalidating would
  /// re-fetch a row this request already carries, and the response is the more
  /// up-to-date of the two by construction.
  Future<void> _run(
    BuildContext context,
    WidgetRef ref,
    Future<BookingDetail> Function() action,
  ) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final updated = await action();
      // The list behind this screen is stale either way, and which filter is
      // active is not known here — invalidating the unfiltered one covers the
      // common case without guessing.
      ref.invalidate(bookingsProvider);
      ref.invalidate(bookingDetailProvider(updated.summary.id));
      messenger.showSnackBar(
        SnackBar(content: Text('${updated.summary.status.label} ثبت شد')),
      );
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text(messageFromDio(error))));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Header(booking: booking),
          const SizedBox(height: 24),
          if (booking.isMobile) ...[
            _MobileBanner(),
            const SizedBox(height: 16),
          ],
          _DetailRow(label: 'مشتری', value: booking.customerLabel),
          if (booking.customerPhone != null && booking.customerPhone!.isNotEmpty)
            _DetailRow(
              label: 'شماره تماس',
              value: booking.customerPhone!,
              trailing: IconButton(
                onPressed: () => _callCustomer(context, booking.customerPhone!),
                icon: const Icon(Icons.call_outlined, size: 18),
                tooltip: 'تماس با مشتری',
              ),
            ),
          _DetailRow(label: 'خدمت', value: booking.serviceName ?? 'بدون خدمت'),
          _DetailRow(label: 'متخصص', value: booking.specialistName ?? 'بدون متخصص'),
          _DetailRow(
            label: 'زمان',
            value: '${formatJalaliDate(booking.startsAt)} ساعت '
                '${formatJalaliTime(booking.startsAt)} تا ${formatJalaliTime(booking.endsAt)}',
          ),
          _DetailRow(label: 'قیمت کل', value: '${toPersianDigits(booking.totalPrice)} تومان'),
          _DetailRow(
            label: 'پرداخت‌شده',
            value: '${toPersianDigits(booking.depositPaid)} تومان',
          ),
          if (booking.isMobile) ...[
            const SizedBox(height: 16),
            _CustomerAddress(booking: booking),
          ],
          if (booking.notes != null && booking.notes!.trim().isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('یادداشت', style: BoyaTypography.overline),
            const SizedBox(height: 4),
            Text(booking.notes!, style: BoyaTypography.body),
          ],
          if (detail.workingHours.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('ساعات کاری سالن', style: BoyaTypography.overline),
            const SizedBox(height: 4),
            Text(_workingHoursLabel(), style: BoyaTypography.caption),
          ],
          const SizedBox(height: 24),
          _Actions(detail: detail, onRun: (action) => _run(context, ref, action)),
        ],
      ),
    );
  }

  /// Dials the customer, falling back to a message when the device has no
  /// handler for `tel:` (a simulator, a desktop build).
  Future<void> _callCustomer(BuildContext context, String phone) async {
    final messenger = ScaffoldMessenger.of(context);
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      messenger.showSnackBar(
        SnackBar(content: Text('امکان تماس با شماره $phone در این دستگاه وجود ندارد')),
      );
    }
  }

  /// Renders the `working_hours` JSONB as «۰۹:۰۰ — ۱۸:۰۰» per day, skipping
  /// anything that is not a pair of times.
  ///
  /// The shape is the backend's own (keyed by day, values as `open-close`
  /// strings); an entry that does not fit is simply not shown rather than
  /// crashing the detail screen over a policy string.
  String _workingHoursLabel() {
    final entries = <String>[];
    detail.workingHours.forEach((day, value) {
      if (value is String && value.isNotEmpty) entries.add('$day: $value');
    });
    return entries.isEmpty ? 'ثبت نشده' : entries.join('، ');
  }
}

/// ADR-011's on-site marker: a tinted banner above the details so an on-site
/// booking cannot be mistaken for one in the salon.
class _MobileBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: BoyaColors.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.directions_car_rounded, color: BoyaColors.primary),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('رزرو سیار', style: BoyaTypography.body.copyWith(fontWeight: FontWeight.bold)),
                const SizedBox(height: 2),
                Text('این رزرو در محل مشتری انجام می‌شود', style: BoyaTypography.caption),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The address the specialist travels to, plus a jump to Neshan when the
/// customer sent coordinates with it (ADR-011).
class _CustomerAddress extends StatelessWidget {
  const _CustomerAddress({required this.booking});

  final BookingSummary booking;

  @override
  Widget build(BuildContext context) {
    final address = booking.customerAddress?.trim() ?? '';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('آدرس مشتری', style: BoyaTypography.overline),
        const SizedBox(height: 4),
        Text(address.isEmpty ? 'ثبت نشده' : address, style: BoyaTypography.body),
        if (booking.hasCoordinates) ...[
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => _openInNeshan(context),
            icon: const Icon(Icons.map_outlined, size: 18),
            label: const Text('مسیریابی'),
          ),
        ],
      ],
    );
  }

  /// Opens the pinned location in Neshan.
  ///
  /// Neshan reads a dropped pin as `https://neshan.org/maps/@<lat>,<lng>,<z>`,
  /// where the last segment is the zoom level; it is an `https` link rather
  /// than a custom scheme, so the URL goes through `url_launcher` as an
  /// external application link. `canLaunchUrl` still guards it: a device
  /// without a browser (or a desktop build) gets a message instead of a silent
  /// no-op.
  Future<void> _openInNeshan(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final uri = Uri.parse(
      'https://neshan.org/maps/@${booking.customerLatitude},${booking.customerLongitude},17z',
    );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      messenger.showSnackBar(
        const SnackBar(content: Text('امکان باز کردن نقشه نیشن در این دستگاه وجود ندارد')),
      );
    }
  }
}

/// The customer, service, specialist and money, as label/value rows.
class _Header extends StatelessWidget {
  const _Header({required this.booking});

  final BookingSummary booking;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(booking.customerLabel, style: BoyaTypography.headline),
              const SizedBox(height: 4),
              Text(booking.serviceName ?? 'بدون خدمت', style: BoyaTypography.caption),
            ],
          ),
        ),
        BookingStatusBadge(status: booking.status, compact: true),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value, this.trailing});

  final String label;
  final String value;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(label, style: BoyaTypography.overline),
          ),
          Expanded(child: Text(value, style: BoyaTypography.body)),
          ?trailing,
        ],
      ),
    );
  }
}

/// The action bar: only the buttons the current status makes sense.
///
/// A pending booking offers approve/reject (reject first, because declining is
/// the destructive one and is behind a confirmation that collects a reason);
/// a confirmed booking whose slot has started offers visit/no-show. Once the
/// booking is completed or cancelled there is nothing the panel may do, so the
/// bar renders as an explanatory line rather than disabled buttons — a greyed
/// button invites a tap that cannot be honoured.
class _Actions extends ConsumerWidget {
  const _Actions({required this.detail, required this.onRun});

  final BookingDetail detail;
  final void Function(Future<BookingDetail> Function() action) onRun;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final booking = detail.summary;
    // The API is read from the provider here rather than passed down, so the
    // four action closures are written against the same client the read used.
    final api = ref.watch(bookingsApiProvider);

    if (booking.isPending) {
      return Column(
        children: [
          FilledButton(
            onPressed: () => onRun(() => api.approve(booking.id)),
            child: const Text('تایید رزرو'),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => _confirmReject(context, onRun, api, booking.id),
            style: OutlinedButton.styleFrom(foregroundColor: BoyaColors.error),
            child: const Text('رد رزرو'),
          ),
        ],
      );
    }

    if (booking.status == BookingStatus.confirmed) {
      final started = !booking.startsAt.isAfter(DateTime.now());
      return Column(
        children: [
          FilledButton(
            onPressed: () => onRun(() => api.markVisited(booking.id)),
            child: const Text('ثبت مراجعه'),
          ),
          if (started) ...[
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: () => onRun(() => api.noShow(booking.id)),
              style: OutlinedButton.styleFrom(foregroundColor: BoyaColors.error),
              child: const Text('عدم مراجعه'),
            ),
          ],
        ],
      );
    }

    // Finished, cancelled, reviewed or a no-show already written off: the
    // status is terminal and the sentence says so more clearly than buttons
    // that would only return a 409.
    return Text(
      'این رزرو ${booking.status.label} است و قابل تغییر نیست.',
      style: BoyaTypography.caption,
    );
  }

  /// Collects the reason before declining.
  ///
  /// The backend requires 5–280 characters because the text reaches the
  /// customer, so the dialog keeps its confirm button disabled until the
  /// reason qualifies rather than letting the rejection fail on the network.
  Future<void> _confirmReject(
    BuildContext context,
    void Function(Future<BookingDetail> Function() action) onRun,
    BookingsApi api,
    String id,
  ) async {
    final controller = TextEditingController();
    final navigator = Navigator.of(context);
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('رد رزرو'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 3,
          maxLength: 280,
          decoration: const InputDecoration(
            labelText: 'دلیل لغو',
            hintText: 'این متن برای مشتری ارسال می‌شود',
          ),
          onChanged: (_) => (context as Element).markNeedsBuild(),
        ),
        actions: [
          TextButton(
            onPressed: () => navigator.pop(),
            child: const Text('انصراف'),
          ),
          ValueListenableBuilder<TextEditingValue>(
            valueListenable: controller,
            builder: (context, value, _) => TextButton(
              onPressed: value.text.trim().length >= 5
                  ? () => navigator.pop(controller.text.trim())
                  : null,
              style: TextButton.styleFrom(foregroundColor: BoyaColors.error),
              child: const Text('رد رزرو'),
            ),
          ),
        ],
      ),
    );
    controller.dispose();
    if (reason == null || reason.isEmpty) return;
    onRun(() => api.reject(id, reason));
  }
}
