import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../data/salon_api.dart';
import '../../domain/salon_status.dart';
import '../../domain/working_hours.dart';
import '../../../../shared/widgets/salon_app_bar.dart';
import '../widgets/approval_status_banner.dart';

/// Weekly schedule editor: one card per day (Saturday first), each with an
/// active switch, opening/closing pickers, and an optional breaks list.
///
/// Saves to `PATCH /salon/me/schedule`, which stages the week in
/// `pending_changes` like every other gated write — the success message says
/// so explicitly instead of pretending the booking wall changed already.
class WorkingHoursScreen extends ConsumerStatefulWidget {
  const WorkingHoursScreen({super.key});

  @override
  ConsumerState<WorkingHoursScreen> createState() => _WorkingHoursScreenState();
}

class _WorkingHoursScreenState extends ConsumerState<WorkingHoursScreen> {
  WorkingHours _hours = WorkingHours.closed();
  bool _seeded = false;
  bool _saving = false;

  /// `listenManual` rather than `listen`: the declarative form is only valid
  /// inside `build`, and this is a `ConsumerState`.
  ProviderSubscription<AsyncValue<dynamic>>? _profileSubscription;

  @override
  void initState() {
    super.initState();
    _seedFrom(ref.read(salonProfileProvider).value?.workingHours);
    _profileSubscription = ref.listenManual(
      salonProfileProvider,
      (_, next) => _seedFrom(next.value?.workingHours),
    );
  }

  @override
  void dispose() {
    _profileSubscription?.close();
    super.dispose();
  }

  /// The form is seeded once. A rebuild (including the one that follows a
  /// save invalidating the profile) must never overwrite the user's edits.
  void _seedFrom(Map<String, dynamic>? workingHours) {
    if (_seeded) return;
    _seeded = true;
    if (workingHours == null || workingHours.isEmpty) return;
    setState(() => _hours = WorkingHours.fromJson(workingHours));
  }

  DaySchedule _day(String key) =>
      _hours.days[key] ?? const DaySchedule(active: false);

  void _setDay(String key, DaySchedule day) {
    setState(() => _hours = _hours.copyWithDay(key, day));
  }

  Future<void> _pickTime({
    required String label,
    required String initial,
    required ValueChanged<String> onPicked,
  }) async {
    final parts = initial.split(':');
    final initialTime = TimeOfDay(
      hour: int.tryParse(parts.first) ?? 9,
      minute: parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0,
    );
    final picked = await showTimePicker(
      context: context,
      initialTime: initialTime,
      helpText: label,
    );
    if (picked == null) return;
    final formatted = '${picked.hour.toString().padLeft(2, '0')}:'
        '${picked.minute.toString().padLeft(2, '0')}';
    onPicked(formatted);
  }


  Future<void> _addBreak(String dayKey) async {
    final day = _day(dayKey);
    final startController =
        TextEditingController(text: _suggestBreakStart(day));
    final endController = TextEditingController(text: day.end);
    final titleController = TextEditingController();
    var dialogError = '';
    final result = await showDialog<WorkingBreak>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: const Text('وقفه جدید'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleController,
                decoration: const InputDecoration(
                  labelText: 'عنوان (اختیاری)',
                  hintText: 'مثلاً ناهار',
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: startController,
                      textDirection: TextDirection.ltr,
                      textAlign: TextAlign.center,
                      decoration: const InputDecoration(labelText: 'از'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: endController,
                      textDirection: TextDirection.ltr,
                      textAlign: TextAlign.center,
                      decoration: const InputDecoration(labelText: 'تا'),
                    ),
                  ),
                ],
              ),
              if (dialogError.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  dialogError,
                  style: BoyaTypography.caption
                      .copyWith(color: BoyaColors.error),
                ),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('انصراف'),
            ),
            FilledButton(
              onPressed: () {
                final candidate = WorkingBreak(
                  start: startController.text.trim(),
                  end: endController.text.trim(),
                  title: titleController.text.trim(),
                );
                final trial = day.copyWith(
                  breaks: <WorkingBreak>[...day.breaks, candidate],
                );
                final error = WorkingHours(
                  days: {dayKey: trial},
                ).validate()[dayKey];
                if (error != null) {
                  setDialogState(() => dialogError = error);
                  return;
                }
                Navigator.of(dialogContext).pop(candidate);
              },
              child: const Text('افزودن'),
            ),
          ],
        ),
      ),
    );
    startController.dispose();
    endController.dispose();
    titleController.dispose();
    if (result == null) return;
    _setDay(dayKey, day.copyWith(
      breaks: <WorkingBreak>[...day.breaks, result],
    ));
  }

  String _suggestBreakStart(DaySchedule day) {
    final start = WorkingHours.minutesOf(day.start);
    final end = WorkingHours.minutesOf(day.end);
    if (start == null || end == null || end - start < 90) return '12:00';
    final mid = (start + end) ~/ 2 - 30;
    final hours = mid ~/ 60;
    final minutes = mid % 60;
    return '${hours.toString().padLeft(2, '0')}:'
        '${minutes.toString().padLeft(2, '0')}';
  }

  Future<void> _save() async {
    final errors = _hours.validate();
    if (errors.isNotEmpty) {
      final firstKey = WorkingHours.dayKeys.firstWhere(
        errors.containsKey,
        orElse: () => WorkingHours.dayKeys.first,
      );
      final dayLabel = WorkingHours.dayLabels[firstKey] ?? firstKey;
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$dayLabel: ${errors[firstKey]}'),
          backgroundColor: BoyaColors.error,
        ),
      );
      return;
    }
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _saving = true);
    try {
      final status =
          await ref.read(salonApiProvider).patchSchedule(_hours);
      ref.invalidate(salonStatusProvider);
      ref.invalidate(salonProfileProvider);
      if (!mounted) return;
      if (status == SalonApprovalStatus.pendingApproval) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text('ساعات کاری برای بررسی به ادمین ارسال شد'),
            backgroundColor: BoyaColors.success,
          ),
        );
        context.pop();
      }
    } catch (error) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            error is SalonEditNotQueuedException
                ? 'تغییرات شما ثبت نشد. لطفاً دوباره تلاش کنید.'
                : messageFromDio(error),
          ),
          backgroundColor: BoyaColors.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BoyaColors.surface,
      appBar: const SalonAppBar(title: 'ساعات کاری سالن'),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const ApprovalStatusBanner(),
                  for (final key in WorkingHours.dayKeys)
                    _DayCard(
                      dayKey: key,
                      day: _day(key),
                      error: _hours.validate()[key],
                      onChanged: (day) => _setDay(key, day),
                      onPickStart: () => _pickTime(
                        label: 'ساعت شروع',
                        initial: _day(key).start,
                        onPicked: (value) =>
                            _setDay(key, _day(key).copyWith(start: value)),
                      ),
                      onPickEnd: () => _pickTime(
                        label: 'ساعت پایان',
                        initial: _day(key).end,
                        onPicked: (value) =>
                            _setDay(key, _day(key).copyWith(end: value)),
                      ),
                      onAddBreak: () => _addBreak(key),
                    ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () => setState(
                      () => _hours = _hours.copySaturdayToAll(),
                    ),
                    icon: const Icon(Icons.content_copy_outlined),
                    label: const Text('کپی شنبه به بقیه روزها'),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'تغییرات پس از تایید ادمین اعمال می‌شود.',
                    style: BoyaTypography.overline,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _saving ? null : _save,
                  child: _saving
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: BoyaColors.white,
                          ),
                        )
                      : const Text('ذخیره'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DayCard extends StatelessWidget {
  const _DayCard({
    required this.dayKey,
    required this.day,
    required this.onChanged,
    required this.onPickStart,
    required this.onPickEnd,
    required this.onAddBreak,
    this.error,
  });

  final String dayKey;
  final DaySchedule day;
  final ValueChanged<DaySchedule> onChanged;
  final VoidCallback onPickStart;
  final VoidCallback onPickEnd;
  final VoidCallback onAddBreak;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final label = WorkingHours.dayLabels[dayKey] ?? dayKey;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SwitchListTile(
              title: Text(label, style: BoyaTypography.body),
              subtitle: day.active
                  ? Text(
                      '${toPersianDigits(day.start)} تا '
                      '${toPersianDigits(day.end)}',
                      style: BoyaTypography.caption,
                    )
                  : const Text('تعطیل'),
              value: day.active,
              onChanged: (active) => onChanged(
                active
                    ? day.copyWith(active: true)
                    : const DaySchedule(active: false),
              ),
            ),
            if (day.active) ...[
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onPickStart,
                      child: Text(
                        toPersianDigits(day.start),
                        textDirection: TextDirection.ltr,
                      ),
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 8),
                    child: Text('تا'),
                  ),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: onPickEnd,
                      child: Text(
                        toPersianDigits(day.end),
                        textDirection: TextDirection.ltr,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text('وقفه‌ها', style: BoyaTypography.caption),
              for (var i = 0; i < day.breaks.length; i++)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    day.breaks[i].title.trim().isEmpty
                        ? 'وقفه'
                        : day.breaks[i].title.trim(),
                    style: BoyaTypography.body,
                  ),
                  subtitle: Text(
                    '${toPersianDigits(day.breaks[i].start)} تا '
                    '${toPersianDigits(day.breaks[i].end)}',
                    style: BoyaTypography.caption,
                  ),
                  trailing: IconButton(
                    icon: const Icon(
                      Icons.delete_outline,
                      color: BoyaColors.error,
                    ),
                    tooltip: 'حذف وقفه',
                    onPressed: () {
                      final next = List<WorkingBreak>.of(day.breaks)
                        ..removeAt(i);
                      onChanged(day.copyWith(breaks: next));
                    },
                  ),
                ),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton.icon(
                  onPressed: onAddBreak,
                  icon: const Icon(Icons.add),
                  label: const Text('افزودن وقفه'),
                ),
              ),
            ],
            if (error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  error!,
                  style: BoyaTypography.caption.copyWith(
                    color: BoyaColors.error,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
