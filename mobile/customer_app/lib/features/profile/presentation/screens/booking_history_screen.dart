import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/boya_app_bar.dart';
import '../../data/booking_history_api.dart';
import '../widgets/booking_history_card.dart';

class BookingHistoryScreen extends ConsumerWidget {
  const BookingHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: const BoyaAppBar(
          title: 'رزروهای من',
          bottom: TabBar(tabs: [Tab(text: 'فعال'), Tab(text: 'تاریخی')]),
        ),
        body: const TabBarView(
          children: [
            BookingList(status: 'active'),
            BookingList(status: 'past'),
          ],
        ),
      ),
    );
  }
}

class BookingList extends ConsumerWidget {
  const BookingList({required this.status, super.key});

  final String status;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookingsAsync = ref.watch(bookingsProvider(status));
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(bookingsProvider(status));
      },
      child: bookingsAsync.when(
        data: (bookings) {
          if (bookings.isEmpty) {
            return LayoutBuilder(
              builder: (context, constraints) => ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(
                    height: constraints.maxHeight,
                    child: const Center(child: Text('هنوز رزروی ندارید', style: BoyaTypography.body)),
                  ),
                ],
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: bookings.length,
            itemBuilder: (context, index) => BookingHistoryCard(booking: bookings[index]),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
        error: (_, _) => const Center(child: Text('خطا در دریافت رزروها', style: BoyaTypography.body)),
      ),
    );
  }
}
