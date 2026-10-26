import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

import '../../../services/domain/service_line.dart';

/// `(serviceId, isChecked)` for the checkbox and the active switch rows.
typedef ServiceToggle = void Function(String serviceId, bool value);

class _ServiceRow extends StatelessWidget {
  const _ServiceRow({
    required this.service,
    required this.assigned,
    required this.active,
    required this.onChanged,
    required this.onActiveChanged,
  });

  final SalonService service;
  final bool assigned;
  final bool active;
  final ValueChanged<bool> onChanged;
  final ValueChanged<bool> onActiveChanged;

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ExpansionTile(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        initiallyExpanded: assigned,
        tilePadding: const EdgeInsets.symmetric(horizontal: 8),
        leading: Checkbox(
          value: assigned,
          // Checkbox hands back `bool?` (null while the value animates); a null
          // can only mean "unchanged", so it is read as the current value.
          onChanged: (value) => onChanged(value ?? assigned),
        ),
        title: Text(
          service.name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: BoyaTypography.body.copyWith(color: BoyaColors.ink),
        ),
        subtitle: Text(
          '${formatPrice(service.price)} · ${toPersianDigits(service.durationMinutes)} دقیقه',
          style: BoyaTypography.caption,
        ),
        children: [
          if (assigned)
            SwitchListTile(
              value: active,
              onChanged: onActiveChanged,
              title: const Text('فعال برای این متخصص', style: BoyaTypography.body),
              subtitle: Text(
                active
                    ? 'در لیست خدمات این متخصص دیده می‌شود'
                    : 'غیرفعال: مشتری نمی‌تواند آن را رزرو کند',
                style: BoyaTypography.caption,
              ),
            )
          else
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Text(
                'با تیک کردن، این خدمت به متخصص اختصاص داده می‌شود.',
                style: BoyaTypography.caption,
              ),
            ),
        ],
      ),
    );
  }
}


/// The catalogue rows of the per-specialist service picker: one card per
/// service of the salon, a checkbox that assigns it to the specialist, and —
/// once assigned — a switch that turns it off for this specialist without
/// dropping the assignment.
class SpecialistServiceList extends StatelessWidget {
  const SpecialistServiceList({
    required this.services,
    required this.assigned,
    required this.active,
    required this.onChanged,
    required this.onActiveChanged,
    super.key,
  });

  final List<SalonService> services;
  final Map<String, bool> assigned;
  final Map<String, bool> active;
  final ServiceToggle onChanged;
  final ServiceToggle onActiveChanged;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: services.length,
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final service = services[index];
        return _ServiceRow(
          service: service,
          assigned: assigned[service.id] ?? false,
          active: active[service.id] ?? true,
          onChanged: (value) => onChanged(service.id, value),
          onActiveChanged: (value) => onActiveChanged(service.id, value),
        );
      },
    );
  }
}
