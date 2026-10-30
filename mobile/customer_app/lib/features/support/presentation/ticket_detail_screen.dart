import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/boya_app_bar.dart';
import '../../../core/network/api_client.dart' show messageFromDio;
import '../data/support_api.dart';
import '../data/support_ticket.dart';

/// One ticket: the customer's message, then the staff reply if there is one.
///
/// The row comes from the already-cached [myTicketsProvider] list, so opening a
/// ticket is instant and works offline if the list was loaded. An unknown id —
/// e.g. a deep link to a ticket the cache does not have — renders an explicit
/// "not found" rather than a blank page.
class TicketDetailScreen extends ConsumerWidget {
  const TicketDetailScreen({required this.ticketId, super.key});

  final String ticketId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ticketsAsync = ref.watch(myTicketsProvider);
    return Scaffold(
      backgroundColor: BoyaColors.cream,
      appBar: const BoyaAppBar(title: 'جزئیات تیکت'),
      body: ticketsAsync.when(
        data: (tickets) {
          SupportTicket? ticket;
          for (final element in tickets) {
            if (element.id == ticketId) {
              ticket = element;
              break;
            }
          }
          if (ticket == null) {
            return const Center(
              child: Text('تیکت موردنظر یافت نشد', style: BoyaTypography.body),
            );
          }
          return _TicketDetailBody(ticket: ticket);
        },
        loading: () => const Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
        error: (error, _) => Center(
          child: Text(
            'بارگذاری تیکت ناموفق بود: ${messageFromDio(error)}',
            style: BoyaTypography.body,
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}

class _TicketDetailBody extends StatelessWidget {
  const _TicketDetailBody({required this.ticket});

  final SupportTicket ticket;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          color: BoyaColors.surface,
          elevation: 1,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(ticket.subject, style: BoyaTypography.title),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  children: [
                    _Meta(label: ticket.typeLabel),
                    _Meta(label: ticket.statusLabel, color: ticket.statusTone),
                  ],
                ),
                const SizedBox(height: 12),
                Text(ticket.message, style: BoyaTypography.body),
                const SizedBox(height: 12),
                Text(
                  'ارسال شده در ${formatJalaliDate(ticket.createdAt)}',
                  style: BoyaTypography.caption,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        if (ticket.hasReply) ...[
          const Text('پاسخ پشتیبانی', style: BoyaTypography.title),
          const SizedBox(height: 8),
          Card(
            color: BoyaColors.primarySubtle,
            elevation: 1,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(ticket.adminResponse!, style: BoyaTypography.body),
                  if (ticket.respondedAt != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      'پاسخ در ${formatJalaliDate(ticket.respondedAt!)}',
                      style: BoyaTypography.caption,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ] else ...[
          Card(
            color: BoyaColors.surface,
            elevation: 1,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: const Padding(
              padding: EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(Icons.hourglass_empty, color: BoyaColors.inkMuted),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'تیکت شما در حال بررسی است; پاسخ اینجا نمایش داده می‌شود.',
                      style: BoyaTypography.caption,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta({required this.label, this.color});

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
