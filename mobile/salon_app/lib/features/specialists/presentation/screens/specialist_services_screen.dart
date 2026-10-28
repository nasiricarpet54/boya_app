import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../services/data/services_api.dart';
import '../../../services/domain/service_line.dart';
import '../../data/specialist_api.dart';
import '../widgets/specialist_service_list.dart';
import '../../features/auth/application/auth_controller.dart';

/// The owner's per-specialist service picker.
///
/// Every service of the salon carries a checkbox: checking assigns it to the
/// specialist, un-checking removes it, and the switch on an assigned row turns
/// the service off *for this specialist* without losing the assignment. Save
/// replaces the whole list, so the customer's booking form never shows a
/// service this screen did not define.
class SpecialistServicesScreen extends ConsumerStatefulWidget {
  const SpecialistServicesScreen({
    required this.specialistId,
    required this.specialistName,
    super.key,
  });

  final String specialistId;
  final String specialistName;

  @override
  ConsumerState<SpecialistServicesScreen> createState() => _SpecialistServicesScreenState();
}

class _SpecialistServicesScreenState extends ConsumerState<SpecialistServicesScreen> {
  /// Local edits, applied only by Save. Keyed by the catalogue service id.
  final Map<String, bool> _assigned = {};
  final Map<String, bool> _active = {};
  bool _seeded = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    // Seed the local state once the current assignments arrive; this screen's
    // own writes never clobber the user's in-flight edits.
    ref.listen(
      specialistServicesProvider(widget.specialistId),
      (_, next) => next.whenData((items) {
        if (!_seeded && mounted) {
          setState(() {
            for (final item in items) {
              _assigned[item.serviceId] = true;
              _active[item.serviceId] = item.isActive;
            }
            _seeded = true;
          });
        }
      }),
    );
  }

  bool get _hasEdits {
    final current =
        ref.read(specialistServicesProvider(widget.specialistId)).valueOrNull ?? [];
    final currentAssigned = {for (final item in current) item.serviceId: item.isActive};
    final selected =
        _assigned.entries.where((entry) => entry.value).map((entry) => entry.key).toSet();
    if (selected.length != currentAssigned.length) return true;
    for (final id in selected) {
      if (currentAssigned[id] != (_active[id] ?? true)) return true;
    }
    return false;
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    final assignments = [
      for (final entry in _assigned.entries)
        if (entry.value)
          SpecialistServiceAssignment(serviceId: entry.key, isActive: _active[entry.key] ?? true),
    ];
    try {
      await ref.read(specialistApiProvider).setSpecialistServices(
            widget.specialistId,
            assignments,
          );
      ref.invalidate(specialistServicesProvider(widget.specialistId));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('خدمات متخصص ثبت شد')),
      );
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(messageFromDio(error))),
      );
      setState(() => _saving = false);
    }
  }

  /// The salon's whole catalogue, flattened from the per-line providers.
  List<SalonService> _allServices(List<ServiceLine> lines) {
    final services = <SalonService>[];
    for (final line in lines) {
      final lineServices = ref.watch(lineServicesProvider(line.id)).valueOrNull ?? [];
      services.addAll(lineServices);
    }
    return services;
  }


  @override
  Widget build(BuildContext context) {
    final linesAsync = ref.watch(serviceLinesProvider);
    final assignedAsync = ref.watch(specialistServicesProvider(widget.specialistId));

    return Scaffold(
      appBar: AppBar(
        title: Text('خدمات ${widget.specialistName}', style: BoyaTypography.title),
        actions: [
          TextButton(
            onPressed: _seeded && _hasEdits && !_saving ? _save : null,
            child: const Text('ذخیره'),
          ),
        ],
      ),
      body: linesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
        error: (error, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(messageFromDio(error), style: BoyaTypography.body),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(serviceLinesProvider),
                child: const Text('تلاش مجدد'),
              ),
            ],
          ),
        ),
        data: (lines) {
          final services = _allServices(lines);
          if (services.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('هنوز خدمتی برای این سالن ثبت نشده است', style: BoyaTypography.body),
                  const SizedBox(height: 8),
                  Text(
                    'ابتدا در بخش خدمات سالن خدمت‌ها را تعریف کنید تا بتوانید '
                    'آن‌ها را به ${widget.specialistName} اختصاص دهید.',
                    textAlign: TextAlign.center,
                    style: BoyaTypography.caption,
                  ),
                ],
              ),
            );
          }

          // Until the assignments arrive the catalogue shows untouched boxes;
          // saving stays blocked by _seeded, so a toggle in this window can
          // never be submitted by mistake.
          return assignedAsync.when(
            loading: () =>
                const Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
            error: (error, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(messageFromDio(error), style: BoyaTypography.body),
              ),
            ),
            data: (_) => SpecialistServiceList(
              services: services,
              assigned: _assigned,
              active: _active,
              onChanged: (serviceId, value) => setState(() {
                _assigned[serviceId] = value;
                if (value && !_active.containsKey(serviceId)) _active[serviceId] = true;
              }),
              onActiveChanged: (serviceId, value) => setState(() => _active[serviceId] = value),
            ),
          );
        },
      ),
    );
  }
}
