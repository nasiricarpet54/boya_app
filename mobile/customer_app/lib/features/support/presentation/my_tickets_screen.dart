import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/boya_app_bar.dart';
import '../../../core/network/api_client.dart' show messageFromDio;
import '../data/support_api.dart';
import '../data/support_ticket.dart';

/// The signed-in user's tickets, newest first, tappable into the detail view.
///
/// Reads [myTicketsProvider]; the create screen invalidates it after a submit,
/// so returning to this list shows the new row without a manual reload.
class MyTicketsScreen extends ConsumerWidget {
  const MyTicketsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ticketsAsync = ref.watch(myTicketsProvider);
    return Scaffold(
      backgroundColor: BoyaColors.cream,
      appBar: const BoyaAppBar(title: 'تیکت‌های من'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/support/new'),
        icon: const Icon(Icons.add),
        label: const Text('تیکت جدید'),
      ),
      body: ticketsAsync.when(
        data: (tickets) {
          if (tickets.isEmpty) {
            return const _EmptyTickets();
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            itemCount: tickets.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, index) => _TicketRow(ticket: tickets[index]),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
        error: (error, _) => _TicketListError(
          message: messageFromDio(error),
          onRetry: () => ref.invalidate(myTicketsProvider),
        ),
      ),
    );
  }
}

class _EmptyTickets extends StatelessWidget {
  const _EmptyTickets();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.inbox_outlined, size: 56, color: BoyaColors.inkMuted),
          const SizedBox(height: 12),
          const Text('هنوز تیکتی ثبت نکرده‌اید', style: BoyaTypography.body),
          const SizedBox(height: 4),
          Text(
            'سوال یا مشکلی دارید? یک تیکت ثبت کنید',
            style: BoyaTypography.caption,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _TicketListError extends StatelessWidget {
  const _TicketListError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off, size: 56, color: BoyaColors.error),
          const SizedBox(height: 12),
          Text('بارگذاری تیکت‌ها ناموفق بود', style: BoyaTypography.body),
          const SizedBox(height: 4),
          Text(message, style: BoyaTypography.caption, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('تلاش دوباره'),
          ),
        ],
      ),
    );
  }
}

class _TicketRow extends StatelessWidget {
  const _TicketRow({required this.ticket});

  final SupportTicket ticket;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: BoyaColors.surface,
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ListTile(
        title: Text(
          ticket.subject,
          style: BoyaTypography.body.copyWith(fontWeight: FontWeight.w600),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Wrap(
            spacing: 6,
            children: [
              _Chip(label: ticket.typeLabel),
              _Chip(label: ticket.statusLabel, color: ticket.statusTone),
            ],
          ),
        ),
        trailing: Text(
          formatJalaliDate(ticket.createdAt),
          style: BoyaTypography.caption,
        ),
        onTap: () => context.push('/support/tickets/${ticket.id}'),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, this.color});

  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final tone = color ?? BoyaColors.inkMuted;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(label, style: BoyaTypography.caption.copyWith(color: tone)),
    );
  }
}
