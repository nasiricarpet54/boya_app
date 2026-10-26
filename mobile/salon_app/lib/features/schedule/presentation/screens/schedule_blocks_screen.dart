import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../shared/widgets/salon_app_bar.dart';
import '../../../specialists/data/specialist_api.dart';
import '../../../specialists/domain/salon_specialist.dart';
import '../../schedule_block_api.dart';

/// Blocked time ranges of the signed-in provider.
///
/// The use case is the client the provider serves outside Boya: a chair
/// renter whose own customer walks in, a mobile specialist who is booked
/// directly by phone. The range is taken out of the public availability
/// exactly like a booking would, and the provider's own calendar stays the
/// single source of truth.
///
/// The backend scopes writes by token role: a staff token blocks inside its
/// own tenant, a `freelance_mobile` token onto its own calendar. The screen
/// shows every specialist of the salon for staff, or just the caller's own
/// row for a mobile specialist — which is why the specialist picker is only
/// built when the list has more than one entry.
class ScheduleBlocksScreen extends ConsumerWidget {
  const ScheduleBlocksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final blocksAsync = ref.watch(scheduleBlocksProvider);

    return Scaffold(
      appBar: const SalonAppBar(title: 'زمان‌های مسدود'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _addBlock(context, ref),
        icon: const Icon(Icons.block),
        label: const Text('مسدود کردن زمان'),
      ),
      body: blocksAsync.when(
        data: (blocks) => RefreshIndicator(
          onRefresh: () => ref.refresh(scheduleBlocksProvider.future),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              for (final block in blocks) ...[
                _BlockCard(block: block),
                const SizedBox(height: 12),
              ],
              if (blocks.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 64),
                  child: Center(
                    child: Text(
                      'زمان مسدودی ثبت نشده است',
                      style: BoyaTypography.body,
                    ),
                  ),
                ),
            ],
          ),
        ),
        loading: () =>
            const Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
        error: (error, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(messageFromDio(error), style: BoyaTypography.body),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(scheduleBlocksProvider),
                child: const Text('تلاش مجدد'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _addBlock(BuildContext context, WidgetRef ref) async {
    final messenger = ScaffoldMessenger.of(context);
    final specialists = ref.read(specialistListProvider).value ?? const <SalonSpecialist>[];
    final added = await showDialog<bool>(
      context: context,
      builder: (context) => _AddBlockDialog(specialists: specialists),
    );
    if (added != true) return;
    ref.invalidate(scheduleBlocksProvider);
    messenger.showSnackBar(
      const SnackBar(
        content: Text('زمان مسدود شد'),
        backgroundColor: BoyaColors.success,
      ),
    );
  }
}

class _BlockCard extends StatelessWidget {
  const _BlockCard({required this.block});

  final ScheduleBlockItem block;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        leading: const Icon(Icons.block, color: BoyaColors.error),
        title: Text(
          '${formatJalaliDate(block.startTime)} — '
          '${toPersianDigits(formatTime(block.startTime))} تا '
          '${toPersianDigits(formatTime(block.endTime))}',
          style: BoyaTypography.body,
        ),
        subtitle: block.reason == null || block.reason!.isEmpty
            ? null
            : Text(block.reason!, style: BoyaTypography.caption),
      ),
    );
  }

  /// `HH:mm` in the Tehran timezone the backend stores everything in.
  static String formatTime(DateTime date) {
    final tehran = date.toUtc().add(const Duration(hours: 3, minutes: 30));
    return '${tehran.hour.toString().padLeft(2, "0")}:'
        '${tehran.minute.toString().padLeft(2, "0")}';
  }
}

class _AddBlockDialog extends ConsumerStatefulWidget {
  const _AddBlockDialog({required this.specialists});

  final List<SalonSpecialist> specialists;

  @override
  ConsumerState<_AddBlockDialog> createState() => _AddBlockDialogState();
}

class _AddBlockDialogState extends ConsumerState<_AddBlockDialog> {
  DateTime? _date;
  TimeOfDay? _start;
  TimeOfDay? _end;
  String? _specialistId;
  final _reasonController = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final date = _date;
    final start = _start;
    final end = _end;
    if (date == null || start == null || end == null) return;

    final startMinutes = start.hour * 60 + start.minute;
    final endMinutes = end.hour * 60 + end.minute;
    if (endMinutes <= startMinutes) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('زمان پایان باید پس از زمان شروع باشد'),
          backgroundColor: BoyaColors.error,
        ),
      );
      return;
    }

    // Tehran wall-clock to a UTC instant, matching the timestamptz column.
    final startUtc = DateTime(
      date.year,
      date.month,
      date.day,
      start.hour,
      start.minute,
    ).subtract(const Duration(hours: 3, minutes: 30));
    final endUtc = DateTime(
      date.year,
      date.month,
      date.day,
      end.hour,
      end.minute,
    ).subtract(const Duration(hours: 3, minutes: 30));

    setState(() => _saving = true);
    try {
      await ref.read(scheduleBlockApiProvider).createScheduleBlock(
            specialistId: _specialistId,
            startTime: startUtc,
            endTime: endUtc,
            reason: _reasonController.text.trim(),
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(messageFromDio(error))),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('مسدود کردن زمان'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          BoyaDatePicker(
            initialDate: DateTime.now(),
            onDateSelected: (date) => setState(() => _date = date),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () async {
                    final picked = await showTimePicker(
                      context: context,
                      initialTime: _start ?? const TimeOfDay(hour: 9, minute: 0),
                      helpText: 'ساعت شروع',
                    );
                    if (picked != null) setState(() => _start = picked);
                  },
                  child: Text(
                    _start == null
                        ? 'از'
                        : toPersianDigits(
                            '${_start!.hour.toString().padLeft(2, "0")}:'
                            '${_start!.minute.toString().padLeft(2, "0")}',
                          ),
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
                  onPressed: () async {
                    final picked = await showTimePicker(
                      context: context,
                      initialTime: _end ?? const TimeOfDay(hour: 12, minute: 0),
                      helpText: 'ساعت پایان',
                    );
                    if (picked != null) setState(() => _end = picked);
                  },
                  child: Text(
                    _end == null
                        ? 'تا'
                        : toPersianDigits(
                            '${_end!.hour.toString().padLeft(2, "0")}:'
                            '${_end!.minute.toString().padLeft(2, "0")}',
                          ),
                    textDirection: TextDirection.ltr,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // A mobile specialist's block targets their own row, so the list is
          // one entry and a picker would be a no-op.
          if (widget.specialists.length > 1)
            DropdownButtonFormField<String>(
              initialValue: _specialistId,
              decoration: const InputDecoration(labelText: 'متخصص'),
              items: [
                for (final specialist in widget.specialists)
                  DropdownMenuItem(
                    value: specialist.id,
                    child: Text(specialist.fullName ?? 'متخصص'),
                  ),
              ],
              onChanged: (value) => setState(() => _specialistId = value),
            ),
          const SizedBox(height: 12),
          TextField(
            controller: _reasonController,
            decoration: const InputDecoration(
              labelText: 'عنوان (اختیاری)',
              hintText: 'مثلاً مشتری حضوری',
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(false),
          child: const Text('انصراف'),
        ),
        TextButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('ثبت'),
        ),
      ],
    );
  }
}
