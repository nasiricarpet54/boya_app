import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../home/application/home_providers.dart';
import '../application/city_provider.dart';
import '../data/locations_api.dart';

/// Two-step city picker: the provinces first, then the cities of the chosen
/// province.
///
/// Snapp/Divar style — one searchable list per step, the province's capital
/// leading the second, and a «موقعیت من» entry that resolves the device to a
/// city outright. Picking a city writes it to [cityProvider] and closes the sheet.
class CityPickerSheet extends ConsumerStatefulWidget {
  const CityPickerSheet({super.key});

  /// Opens the sheet as a bottom modal.
  static Future<void> show(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: BoyaColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => const CityPickerSheet(),
    );
  }

  @override
  ConsumerState<CityPickerSheet> createState() => _CityPickerSheetState();
}

class _CityPickerSheetState extends ConsumerState<CityPickerSheet> {
  /// `0` lists the provinces, `1` the cities of [_selectedProvince].
  var _step = 0;
  Province? _selectedProvince;

  final _provinceSearch = TextEditingController();
  final _citySearch = TextEditingController();

  @override
  void dispose() {
    _provinceSearch.dispose();
    _citySearch.dispose();
    super.dispose();
  }

  void _openProvince(Province province) {
    setState(() {
      _selectedProvince = province;
      _step = 1;
      _citySearch.clear();
    });
  }

  void _backToProvinces() {
    setState(() {
      _step = 0;
      _selectedProvince = null;
    });
  }

  Future<void> _chooseCity(Province province, City city) async {
    await ref.read(cityProvider.notifier).selectCity(province, city);
    if (mounted) Navigator.of(context).pop();
  }

  Widget _searchField(TextEditingController controller, String hint) {
    // Typing rebuilds the sheet so the list filters live; the controller keeps
    // its own text, so the field does not lose focus or the caret on a rebuild.
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: TextField(
        controller: controller,
        onChanged: (_) => setState(() {}),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: BoyaTypography.overline.copyWith(color: BoyaColors.inkMuted),
          prefixIcon: const Icon(Icons.search, color: BoyaColors.inkMuted),
          filled: true,
          fillColor: BoyaColors.cream,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(vertical: 10),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.78,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const _DragHandle(),
            _Header(
              title: _step == 0 ? 'انتخاب شهر' : _selectedProvince!.nameFa,
              showBack: _step == 1,
              onBack: _backToProvinces,
            ),
            if (_step == 0) ...[
              _searchField(_provinceSearch, 'جستجوی استان...'),
              _ProvinceStep(controller: _provinceSearch, onSelect: _openProvince),
            ] else ...[
              _searchField(_citySearch, 'جستجوی شهر...'),
              _CityStep(
                province: _selectedProvince!,
                controller: _citySearch,
                onChoose: _chooseCity,
              ),
            ],
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.title, required this.showBack, required this.onBack});

  final String title;
  final bool showBack;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
      child: Row(
        children: [
          // Both sides reserve the same width so the title stays centred
          // whether the back button is there or not.
          SizedBox(
            width: 48,
            child: showBack
                ? IconButton(
                    onPressed: onBack,
                    // RTL: "back" sits on the right and points right.
                    icon: const Icon(Icons.arrow_forward, color: BoyaColors.ink),
                    tooltip: 'بازگشت',
                  )
                : const SizedBox.shrink(),
          ),
          Expanded(
            child: Text(
              title,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: BoyaTypography.title,
            ),
          ),
          const SizedBox(width: 48),
        ],
      ),
    );
  }
}

class _DragHandle extends StatelessWidget {
  const _DragHandle();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 12, bottom: 4),
      child: Container(
        width: 40,
        height: 4,
        decoration: BoxDecoration(
          color: BoyaColors.inkMuted.withValues(alpha: 0.3),
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }
}

class _ProvinceStep extends ConsumerWidget {
  const _ProvinceStep({required this.controller, required this.onSelect});

  final TextEditingController controller;
  final ValueChanged<Province> onSelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provinces = ref.watch(provincesProvider);
    return provinces.when(
      loading: () => const _Loading(),
      error: (_, _) => _Retry(onRetry: () => ref.invalidate(provincesProvider)),
      data: (all) {
        final query = controller.text.trim();
        final filtered = query.isEmpty
            ? all
            : all
                .where(
                  (province) =>
                      province.nameFa.contains(query) ||
                      province.nameEn.toLowerCase().contains(query.toLowerCase()),
                )
                .toList(growable: false);
        return _List(
          children: <Widget>[
            const _MyLocationTile(),
            for (final province in filtered)
              _ProvinceTile(province: province, onTap: () => onSelect(province)),
            if (filtered.isEmpty) const _NothingFound(message: 'استانی یافت نشد'),
          ],
        );
      },
    );
  }
}

class _CityStep extends ConsumerWidget {
  const _CityStep({
    required this.province,
    required this.controller,
    required this.onChoose,
  });

  final Province province;
  final TextEditingController controller;

  /// The province and city the customer picked, passed through rather than
  /// looked up again here so a tap always reports the province the list was
  /// built from.
  final void Function(Province province, City city) onChoose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedCityId = ref.watch(cityProvider.select((state) => state.cityId));
    final cities = ref.watch(citiesProvider(province.id));
    return cities.when(
      loading: () => const _Loading(),
      error: (_, _) => _Retry(onRetry: () => ref.invalidate(citiesProvider(province.id))),
      data: (all) {
        // The seed lists the capital first already; enforcing it here keeps the
        // contract local so a re-seed cannot silently reorder the picker.
        final ordered = [...all]
          ..sort((a, b) {
            if (a.isCapital == b.isCapital) return 0;
            return a.isCapital ? -1 : 1;
          });
        final query = controller.text.trim();
        final filtered = query.isEmpty
            ? ordered
            : ordered
                .where(
                  (city) =>
                      city.nameFa.contains(query) ||
                      city.nameEn.toLowerCase().contains(query.toLowerCase()),
                )
                .toList(growable: false);
        return _List(
          children: <Widget>[
            for (final city in filtered)
              _CityTile(
                city: city,
                selected: city.id == selectedCityId,
                onTap: () => onChoose(province, city),
              ),
            if (filtered.isEmpty) const _NothingFound(message: 'شهری یافت نشد'),
          ],
        );
      },
    );
  }
}

class _List extends StatelessWidget {
  const _List({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Flexible(
      // `shrinkWrap` so the sheet is never taller than it needs, and `Flexible`
      // so a long catalogue scrolls instead of overflowing the constrained box.
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        shrinkWrap: true,
        children: children,
      ),
    );
  }
}

/// «موقعیت من»: resolves the device to a city in one tap.
///
/// GPS → reverse-geocode → the picker's own selection. Each way it can fail is
/// reported with its own sentence, because "ناموفق بود" tells the customer
/// nothing they can act on: a refused permission, an unserved city and an
/// unconfigured geocoder each need a different next step.
class _MyLocationTile extends ConsumerStatefulWidget {
  const _MyLocationTile();

  @override
  ConsumerState<_MyLocationTile> createState() => _MyLocationTileState();
}

class _MyLocationTileState extends ConsumerState<_MyLocationTile> {
  /// The chain is GPS → permission → network; long enough to need its own
  /// spinner so the tile does not look dead while the platform dialog is up.
  var _resolving = false;

  Future<void> _resolve() async {
    setState(() => _resolving = true);
    try {
      final outcome = await ref.read(userLocationProvider.notifier).resolve();
      if (!mounted) return;

      // Only a resolved city closes the sheet: every other outcome leaves the
      // customer on the picker, where they can still choose by hand instead of
      // staring at a feed that silently stayed scoped to the default city.
      if (outcome == UserLocationOutcome.resolved) {
        Navigator.of(context).pop();
        return;
      }

      final message = switch (outcome) {
        UserLocationOutcome.positionUnavailable => 'دسترسی به موقعیت مکانی امکانپذیر نیست',
        UserLocationOutcome.cityNotServed => 'متأسفانه بویا در شهر شما فعال نیست',
        UserLocationOutcome.geocoderUnavailable => 'نزدیکترین شهر یافت نشد، لطفاً دستی انتخاب کنید',
        UserLocationOutcome.resolved => '', // unreachable: popped above
      };

      if (message.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message)),
        );
      }
    } catch (_) {
      // resolve() is null-safe end to end, so this is only the net for a
      // platform channel that throws outright — the tile still has to
      // unblock and say something rather than hang on the spinner.
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('خطا در دریافت موقعیت، لطفاً دوباره تلاش کنید')),
      );
    } finally {
      // Runs on every path out, including the early returns above, so the tile
      // never stays disabled once the chain has ended.
      if (mounted) {
        setState(() => _resolving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return _Hairline(
      child: ListTile(
        enabled: !_resolving,
        leading: _resolving
            ? const Padding(
                padding: EdgeInsets.all(4),
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    color: BoyaColors.primary,
                    strokeWidth: 2,
                  ),
                ),
              )
            : const Icon(Icons.my_location, color: BoyaColors.primary),
        title: Text(
          'موقعیت من',
          style: BoyaTypography.body.copyWith(
            color: _resolving ? BoyaColors.inkMuted : BoyaColors.ink,
            fontWeight: FontWeight.w500,
          ),
        ),
        subtitle: Text(
          'انتخاب خودکار شهر بر اساس GPS',
          style: BoyaTypography.overline.copyWith(color: BoyaColors.inkMuted),
        ),
        onTap: _resolve,
      ),
    );
  }
}


class _ProvinceTile extends StatelessWidget {
  const _ProvinceTile({required this.province, required this.onTap});

  final Province province;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _Hairline(
      child: ListTile(
        title: Text(
          province.nameFa,
          style: BoyaTypography.body.copyWith(color: BoyaColors.ink),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        onTap: onTap,
      ),
    );
  }
}

class _CityTile extends StatelessWidget {
  const _CityTile({required this.city, required this.selected, required this.onTap});

  final City city;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _Hairline(
      child: ListTile(
        title: Text(
          city.nameFa,
          style: BoyaTypography.body.copyWith(
            color: BoyaColors.ink,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: selected
            ? const Icon(Icons.check_circle, color: BoyaColors.primary, size: 20)
            : null,
        onTap: onTap,
      ),
    );
  }
}

/// A list row with a hairline under it.
class _Hairline extends StatelessWidget {
  const _Hairline({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: BoyaColors.line, width: 0.5)),
      ),
      child: child,
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(32),
      child: Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
    );
  }
}

class _Retry extends StatelessWidget {
  const _Retry({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'دریافت لیست ناموفق بود',
              style: BoyaTypography.body.copyWith(color: BoyaColors.inkMuted),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('تلاش دوباره'),
            ),
          ],
        ),
      ),
    );
  }
}

class _NothingFound extends StatelessWidget {
  const _NothingFound({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Center(child: Text(message, style: BoyaTypography.body)),
    );
  }
}

