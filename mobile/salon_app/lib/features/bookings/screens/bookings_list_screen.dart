import 'dart:async';

import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../features/auth/application/auth_controller.dart';
import '../../../core/network/api_client.dart';
import '../../../core/router/app_router.dart';
import '../../../shared/widgets/salon_app_bar.dart';
import '../data/bookings_api.dart';
import '../domain/booking_summary.dart';
import '../widgets/booking_status_badge.dart';

/// The bookings working surface of the salon panel: every booking the caller's
/// role can see, filterable by status and by day.
///
/// The counts on the tabs come from the same response as the rows, so the two
/// cannot describe different filters — switching a tab costs one request, not
/// one per tab.
class BookingsListScreen extends ConsumerStatefulWidget {
  const BookingsListScreen({super.key});

  @override
  ConsumerState<BookingsListScreen> createState() => _BookingsListScreenState();
}

class _BookingsListScreenState extends ConsumerState<BookingsListScreen> {
  BookingsQuery _query = const BookingsQuery.all();

  /// Picks up the day the calendar handed over.
  ///
  /// Read once, in [initState], and only when the router actually carried a
  /// date: the list owns its filters afterwards, so a later rebuild (or a tab
  /// switch) must not silently re-apply a day the user has since cleared.
  @override
  void initState() {
    super.initState();
    final date = GoRouterState.of(context).uri.queryParameters['date'];
    if (date != null && date.isNotEmpty) {
      _query = const BookingsQuery.all().copyWith(date: date);
    }
  }

  void _apply(BookingsQuery next) => setState(() => _query = next);

  @override
  Widget build(BuildContext context) {
    final pageAsync = ref.watch(bookingsProvider(_query));
    final theme = Theme.of(context);
    final foreground = theme.colorScheme.onSurface;

    return Scaffold(
      // A plain AppBar rather than the shared [SalonAppBar]: this screen needs
      // two trailing actions (the calendar switch and the home shortcut) and
      // the shared bar owns its trailing slot for the home button alone.
      appBar: AppBar(
        elevation: 0,
        centerTitle: true,
        title: Text('رزروها', style: BoyaTypography.title.copyWith(color: foreground)),
        actions: [
          IconButton(
            // The calendar tab is the other way to look at the same bookings by
            // date; both live in this branch of the shell.
            onPressed: () => context.go(bookingsCalendarPath),
            icon: const Icon(Icons.calendar_month_outlined),
            tooltip: 'نمای تقویم',
          ),
          IconButton(
            onPressed: () => context.go(
              salonHomePathFor(ref.read(authControllerProvider).user?.role),
            ),
            icon: const Icon(Icons.home_outlined),
            tooltip: 'خانه',
          ),
        ],
      ),
      body: Column(
        children: [
          _StatusTabs(
            selected: _query.status,
            // The counts ride along with the rows in the same response, so
            // reading them off the resolved page cannot show a tab count from
            // a different filter than the rows underneath it. `asData` is null
            // while loading and on error, which leaves the tabs without numbers
            // rather than with stale ones.
            counts: pageAsync.asData?.value.counts,
            onSelect: (status) => _apply(
              status == null ? const BookingsQuery.all() : BookingsQuery.withStatus(status),
            ),
          ),
          _DateFilterChip(query: _query, onChanged: _apply),
          Expanded(
            child: pageAsync.when(
              data: (page) => _BookingList(page: page, query: _query, onApply: _apply),
              loading: () =>
                  const Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
              error: (error, _) => _ErrorPane(
                message: messageFromDio(error),
                onRetry: () => ref.invalidate(bookingsProvider(_query)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The six status filters plus «همه», with the window's counts.
///
/// A null [selected] is the unfiltered list. The counts are only shown once a
/// response has arrived — a tab showing «۰» before the first load would claim
/// there is nothing to do.
class _StatusTabs extends StatelessWidget {
  const _StatusTabs({required this.selected, required this.counts, required this.onSelect});

  final BookingStatus? selected;
  final BookingCounts? counts;
  final ValueChanged<BookingStatus?> onSelect;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        children: [
          _Tab(label: 'همه', isSelected: selected == null, onTap: () => onSelect(null)),
          for (final status in BookingStatus.values)
            _Tab(
              label: status.label,
              count: counts?.of(status),
              isSelected: selected == status,
              onTap: () => onSelect(status),
            ),
        ],
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({required this.label, required this.isSelected, required this.onTap, this.count});

  final String label;
  final int? count;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8, top: 8),
      child: GestureDetector(
        onTap: onTap,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: isSelected ? BoyaColors.primarySubtle : BoyaColors.surface,
            border: Border.all(color: isSelected ? BoyaColors.primary : BoyaColors.line),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                Text(
                  label,
                  style: BoyaTypography.overline.copyWith(
                    color: isSelected ? BoyaColors.primary : BoyaColors.inkMuted,
                  ),
                ),
                if (count != null) ...[
                  const SizedBox(width: 4),
                  Text(
                    toPersianDigits('$count'),
                    style: BoyaTypography.overline.copyWith(
                      color: isSelected ? BoyaColors.primary : BoyaColors.inkMuted,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Picks one day, or clears the day filter.
///
/// The backend resolves the day in Tehran time, so the chip sends the Gregorian
/// `YYYY-MM-DD` the shared picker returns rather than a Jalali string — the
/// conversion is the backend's one source of truth.
class _DateFilterChip extends StatelessWidget {
  const _DateFilterChip({required this.query, required this.onChanged});

  final BookingsQuery query;
  final ValueChanged<BookingsQuery> onChanged;

  @override
  Widget build(BuildContext context) {
    final date = query.date;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Row(
        children: [
          ActionChip(
            avatar: const Icon(Icons.event_outlined, size: 16),
            label: Text(date == null ? 'همه روزها' : formatJalaliDate(DateTime.parse(date))),
            onPressed: () async {
              final picked = await _pickDay(context);
              if (picked == null) return;
              onChanged(query.copyWith(date: _isoDay(picked)));
            },
          ),
          if (date != null)
            IconButton(
              onPressed: () => onChanged(query.copyWith(clearDate: true)),
              icon: const Icon(Icons.close, size: 16),
              tooltip: 'حذف فیلتر تاریخ',
            ),
        ],
      ),
    );
  }

  /// Opens the shared Jalali picker for one day and returns it as a
  /// Gregorian `DateTime`, or null if the dialog was dismissed.
  ///
  /// This is the only place the list converts Jalali to Gregorian, because
  /// the query DTO takes `YYYY-MM-DD`; everything above this line keeps
  /// DateTime so the shared formatter stays the single place that prints
  /// Jalali dates.
  Future<DateTime?> _pickDay(BuildContext context) async {
    final controller = Completer<DateTime?>();
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        contentPadding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
        content: BoyaDatePicker(
          initialDate: DateTime.now(),
          onDateSelected: (date) {
            controller.complete(date);
            Navigator.of(context).pop();
          },
        ),
      ),
    );
    // Dismissing without a choice completes nothing, so the future is
    // completed with null to keep the caller's single await shape.
    if (!controller.isCompleted) controller.complete(null);
    return controller.future;
  }

  /// `YYYY-MM-DD` in local time — the format the query DTO matches on.
  static String _isoDay(DateTime value) =>
      '${value.year.toString().padLeft(4, '0')}-'
      '${value.month.toString().padLeft(2, '0')}-'
      '${value.day.toString().padLeft(2, '0')}';
}

class _BookingList extends ConsumerWidget {
  const _BookingList({required this.page, required this.query, required this.onApply});

  final BookingPage page;
  final BookingsQuery query;
  final ValueChanged<BookingsQuery> onApply;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (page.data.isEmpty) {
      return Center(
        child: Text(
          // An empty *filtered* list is a different situation from an empty
          // salon, and the words differ so the reader knows which they are.
          query.status == null && query.date == null
              ? 'رزروی ثبت نشده است'
              : 'رزروی با این فیلترها یافت نشد',
          style: BoyaTypography.body,
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => ref.refresh(bookingsProvider(query).future),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        // Always scrollable so pull-to-refresh works even on a short page.
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: page.data.length + (page.page < page.totalPages ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == page.data.length) {
            return Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Center(
                child: TextButton(
                  onPressed: () => onApply(query.copyWith(page: query.page + 1)),
                  child: Text(
                    'صفحه ${toPersianDigits('${query.page + 1}')} '
                    'از ${toPersianDigits('${page.totalPages}')}',
                  ),
                ),
              ),
            );
          }
          final booking = page.data[index];
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _BookingCard(booking: booking),
          );
        },
      ),
    );
  }
}
class _BookingCard extends StatelessWidget {
  const _BookingCard({required this.booking});

  final BookingSummary booking;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: () => context.push(bookingDetailPath(booking.id)),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      booking.customerLabel,
                      style: BoyaTypography.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  BookingStatusBadge(status: booking.status),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '${formatJalaliDate(booking.startsAt)} — '
                '${formatJalaliTime(booking.startsAt)}',
                style: BoyaTypography.caption,
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      booking.serviceName ?? 'بدون خدمت',
                      style: BoyaTypography.caption,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    '${toPersianDigits(booking.totalPrice)} تومان',
                    style: BoyaTypography.body,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

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