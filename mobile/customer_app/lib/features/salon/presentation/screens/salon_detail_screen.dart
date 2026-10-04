import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/widgets/boya_app_bar.dart';
import '../../data/salon_api.dart';
import '../../domain/salon_detail.dart';
import '../widgets/salon_people.dart';
import '../widgets/salon_portfolio_tab.dart';
import '../widgets/working_hours_section.dart';
import 'package:dio/dio.dart';

class SalonDetailScreen extends ConsumerStatefulWidget {
  const SalonDetailScreen({required this.salonId, super.key});

  final String salonId;

  @override
  ConsumerState<SalonDetailScreen> createState() => _SalonDetailScreenState();
}

/// The screen owns two pieces of state the tabs have to agree on:
///
/// - [TabController], so the selected tab survives a rebuild, and so tapping a
///   specialist can switch to «نمونه‌کارها».
/// - [_specialistId], the optional specialist filter. It stays null until the
///   customer picks someone in the strip, which keeps «همه» the default.
class _SalonDetailScreenState extends ConsumerState<SalonDetailScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  /// Selected specialist id, or null while every specialist's work is shown.
  String? _specialistId;

  /// Index of the portfolio tab inside the [TabController] below, which is the
  /// only tab the page needs to address by name (tapping a specialist jumps
  /// there).
  static const int _portfolioTab = 2;

  /// Index the [TabBar] is on, mirrored into the tree. The page's own
  /// [CustomScrollView] renders the visible tab directly, so the selection has
  /// to drive a rebuild rather than being owned by a [TabBarView].
  late int _tabIndex;

  @override
  void initState() {
    super.initState();
    // The length must match the TabBar below, in order: خدمات، متخصصان،
    // نمونه‌کارها.
    _tabs = TabController(length: 3, vsync: this);
    _tabIndex = _tabs.index;
    _tabs.addListener(_onTabChanged);
  }

  /// Repaints the page when the customer taps or swipes to another tab.
  void _onTabChanged() {
    if (_tabs.index == _tabIndex) return;
    setState(() => _tabIndex = _tabs.index);
  }

  @override
  void dispose() {
    _tabs.removeListener(_onTabChanged);
    _tabs.dispose();
    super.dispose();
  }

  /// The body of the tab currently on screen, sized by its own content so the
  /// page's [CustomScrollView] can scroll it alongside the cover photo.
  Widget _currentTab(SalonDetail salon) => switch (_tabIndex) {
    0 => _ServicesTab(services: salon.services),
    1 => _SpecialistsTab(
      specialists: salon.specialists,
      specialistId: _specialistId,
      onShowPortfolio: _showSpecialistPortfolio,
    ),
    _ => Padding(
      padding: const EdgeInsets.only(top: 8),
      child: SalonPortfolioTab(salonId: widget.salonId, specialistId: _specialistId),
    ),
  };

  void _showSpecialistPortfolio(String specialistId) {
    setState(() => _specialistId = specialistId);
    _tabs.animateTo(_portfolioTab);
  }

  @override
  Widget build(BuildContext context) {
    final salonId = widget.salonId;
    final salonAsync = ref.watch(salonDetailProvider(salonId));
    return Scaffold(
      backgroundColor: BoyaColors.cream,
      body: salonAsync.when(
        data: (salon) => DefaultTabController(
          length: 3,
          child: CustomScrollView(
            slivers: [
              // Sliver mode: the bar is the first sliver of the page's own
              // CustomScrollView, so the cover photo can collapse on scroll
              // while the TabBar stays pinned. The leading and action widgets
              // come from BoyaAppBar, not from here.
              BoyaAppBar.sliver(
                title: salon.name,
                backgroundColor: BoyaColors.primary,
                foregroundColor: BoyaColors.white,
                pinned: true,
                expandedHeight: 160,
                flexibleSpaceBackground: _SalonCover(url: salon.coverImage),
                bottom: TabBar(
                  controller: _tabs,
                  labelColor: BoyaColors.white,
                  unselectedLabelColor: BoyaColors.white.withValues(alpha: 0.7),
                  indicatorColor: BoyaColors.white,
                  labelStyle: BoyaTypography.caption.copyWith(fontWeight: FontWeight.w600),
                  tabs: const [
                    Tab(text: 'خدمات'),
                    Tab(text: 'متخصصان'),
                    Tab(text: 'نمونه‌کارها'),
                  ],
                ),
              ),
              SliverToBoxAdapter(child: _SalonHeader(salon: salon)),
              // Working hours sit in their own sliver in the normal scroll flow,
              // below the header and above the tab content. A [SliverToBoxAdapter]
              // gives the section its full intrinsic height, so it never overlaps
              // the tabs — the tabs are the *next* sliver, laid out after it, not
              // painted on top of it.
              SliverToBoxAdapter(child: WorkingHoursSection(workingHours: salon.workingHours)),
              // Only the selected tab is built, and the page's own scroller moves
              // it. A [TabBarView] cannot be used here: inside a sliver its
              // [PageView] is handed an unbounded height, and a horizontal
              // viewport needs a bounded one — that fails with "Horizontal
              // viewport was given unbounded height" and leaves the whole page
              // unlaid-out (blank body, hasSize assertion in box.dart).
              SliverToBoxAdapter(child: _currentTab(salon)),
              const SliverToBoxAdapter(child: SizedBox(height: 100)),
            ],
          ),
        ),
        loading: () => const _LoadingSkeleton(),
        error: (error, _) {
          // Log the failure for debugging.
          debugPrint('SalonDetailScreen: error fetching salon $salonId: $error');
          return _SalonErrorView(
            salonId: salonId,
            error: error,
            onRetry: () => ref.refresh(salonDetailProvider(salonId)),
          );
        },
      ),
      bottomNavigationBar: salonAsync.maybeWhen(
        data: (_) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: FilledButton(
              onPressed: () => context.push('/salon/$salonId/booking'),
              child: const Text('رزرو نوبت'),
            ),
          ),
        ),
        orElse: () => const SizedBox.shrink(),
      ),
    );
  }
}

/// Tab 1, «خدمات»: the price list, or a placeholder when the salon published
/// none. The heading moved here from the page body when the tabs were added, so
/// each tab names itself.
class _ServicesTab extends StatelessWidget {
  const _ServicesTab({required this.services});

  final List<SalonService> services;

  @override
  Widget build(BuildContext context) {
    if (services.isEmpty) return const _EmptyLine('خدمتی ثبت نشده است');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final service in services) SalonServiceTile(service: service),
      ],
    );
  }
}

/// Tab 2, «متخصصان»: the horizontal strip, plus the optional portfolio filter.
///
/// Tapping a specialist selects them and opens the portfolio tab, and a banner
/// makes it obvious that the grid below is now filtered and how to undo it.
class _SpecialistsTab extends StatelessWidget {
  const _SpecialistsTab({
    required this.specialists,
    required this.specialistId,
    required this.onShowPortfolio,
  });

  final List<SalonSpecialist> specialists;

  /// Currently selected specialist, or null when nobody is selected.
  final String? specialistId;

  final ValueChanged<String> onShowPortfolio;

  @override
  Widget build(BuildContext context) {
    final selectedId = specialistId;
    final selected = selectedId == null
        ? null
        : specialists.where((specialist) => specialist.id == selectedId).firstOrNull;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (specialists.isEmpty)
          const _EmptyLine('متخصصان به‌زودی')
        else ...[
          const SizedBox(height: 16),
          SalonSpecialistStrip(
            specialists: specialists,
            selectedId: selectedId,
            onSelected: onShowPortfolio,
          ),
          if (selected != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'نمونه‌کارهای ${selected.fullName}',
                      style: BoyaTypography.caption,
                    ),
                  ),
                  TextButton(
                    onPressed: () => onShowPortfolio(selected.id),
                    child: const Text('مشاهده'),
                  ),
                ],
              ),
            ),
        ],
      ],
    );
  }
}

/// Cover photo behind the app bar, falling back to a neutral tile when the
/// salon has no image.
class _SalonCover extends StatelessWidget {
  const _SalonCover({required this.url});

  final String? url;

  @override
  Widget build(BuildContext context) {
    final cover = url;
    if (cover == null || cover.isEmpty) return const _CoverFallback();
    return Image.network(
      cover,
      fit: BoxFit.cover,
      loadingBuilder: (context, child, progress) =>
          progress == null ? child : const ColoredBox(color: BoyaColors.primary),
      errorBuilder: (_, _, _) => const _CoverFallback(),
    );
  }
}

class _CoverFallback extends StatelessWidget {
  const _CoverFallback();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: BoyaColors.primary,
      child: Center(child: Icon(Icons.storefront_outlined, color: BoyaColors.white, size: 40)),
    );
  }
}

/// Rating, review count, address and phone, plus the distance and discount
/// badges the API only sends when it has something to report.
class _SalonHeader extends StatelessWidget {
  const _SalonHeader({required this.salon});

  final SalonDetail salon;

  @override
  Widget build(BuildContext context) {
    final address = salon.address;
    final phone = salon.phone;
    final specialty = salon.specialty;
    final distance = salon.distanceKm;
    final discount = salon.discountPercent;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.star, size: 16, color: BoyaColors.warning),
              const SizedBox(width: 4),
              Text(
                _persianDecimal(salon.rating),
                style: BoyaTypography.caption.copyWith(color: BoyaColors.ink, fontWeight: FontWeight.w700),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  '${toPersianDigits(salon.reviewCount)} نظر',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: BoyaTypography.overline,
                ),
              ),
              if (distance != null) _Badge(label: '${_persianDecimal(distance)} کیلومتر'),
              if (discount != null) ...[
                const SizedBox(width: 8),
                _Badge(label: '${toPersianDigits(discount)}٪ تخفیف', color: BoyaColors.error),
              ],
            ],
          ),
          if (specialty != null && specialty.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(specialty, style: BoyaTypography.overline),
          ],
          if (address != null && address.isNotEmpty) ...[
            const SizedBox(height: 8),
            _HeaderLine(icon: Icons.place_outlined, text: address),
          ],
          if (phone != null && phone.isNotEmpty) ...[
            const SizedBox(height: 6),
            _HeaderLine(icon: Icons.phone_outlined, text: phone),
          ],
        ],
      ),
    );
  }
}

class _HeaderLine extends StatelessWidget {
  const _HeaderLine({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: BoyaColors.inkMuted),
        const SizedBox(width: 6),
        Expanded(child: Text(text, maxLines: 2, overflow: TextOverflow.ellipsis, style: BoyaTypography.caption)),
      ],
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, this.color = BoyaColors.primary});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: BoyaTypography.overline.copyWith(color: color, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}

/// `2.3` becomes `۲٫۳` with the Persian decimal separator.
String _persianDecimal(double value) =>
    toPersianDigits(value.toStringAsFixed(1)).replaceAll('.', '٫');



class _EmptyLine extends StatelessWidget {
  const _EmptyLine(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(padding: const EdgeInsets.all(16), child: Text(text, style: BoyaTypography.caption));
  }
}

/// Shimmer-free loading placeholder for the salon detail page. Replaces the
/// plain `CircularProgressIndicator` so the page never looks blank while the
/// detail request is in flight.
class _LoadingSkeleton extends StatelessWidget {
  const _LoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        // Cover + app bar placeholder.
        Container(
          height: 160,
          color: BoyaColors.inkMuted.withValues(alpha: 0.08),
        ),
        const SizedBox(height: 16),
        // Header placeholders.
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 18,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: BoyaColors.inkMuted.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(height: 12),
              Container(
                height: 18,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: BoyaColors.inkMuted.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(height: 12),
              Container(
                height: 18,
                width: 200,
                decoration: BoxDecoration(
                  color: BoyaColors.inkMuted.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Centered error view with a Persian message and a retry button. When the
/// backend reports a 404 the message becomes «این سالن یافت نشد» so the user
/// understands a stale id, not a transient network failure.
class _SalonErrorView extends StatelessWidget {
  const _SalonErrorView({
    required this.salonId,
    required this.error,
    required this.onRetry,
  });

  final String salonId;
  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final dioError = error is DioException ? error as DioException : null;
    final statusCode = dioError?.response?.statusCode;
    final isNotFound = statusCode == 404;
    final message = isNotFound
        ? 'این سالن یافت نشد'
        : 'خطا در دریافت اطلاعات سالن';

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isNotFound ? Icons.storefront_outlined : Icons.error_outline,
              size: 48,
              color: BoyaColors.inkMuted,
            ),
            const SizedBox(height: 16),
            Text(
              message,
              style: BoyaTypography.body.copyWith(color: BoyaColors.ink),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            // Only show the underlying error detail when it actually helps the
            // user — i.e. anything other than a 404.
            if (dioError != null && !isNotFound)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  '${dioError.response?.statusCode ?? 'نا‌مشخص'}: '
                  '${(dioError.response?.data as Map?)?['message'] ?? dioError.message}',
                  style: BoyaTypography.overline.copyWith(color: BoyaColors.inkMuted),
                  textAlign: TextAlign.center,
                ),
              ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: onRetry,
              child: const Text('تلاش مجدد'),
            ),
          ],
        ),
      ),
    );
  }
}
