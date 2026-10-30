import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:boya_shared/boya_shared.dart';
import '../../application/specialist_providers.dart';

class MobileSpecialistsScreen extends ConsumerWidget {
  const MobileSpecialistsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final specialistsAsync = ref.watch(mobileSpecialistsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('متخصصان سیار')),
      body: specialistsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('���: $err')),
        data: (specialists) {
          if (specialists.isEmpty) {
            return const Center(child: Text('هیچ متخصص سیاری یافت نشد.'));
          }
          return ListView.builder(
            itemCount: specialists.length,
            itemBuilder: (context, index) {
              final specialist = specialists[index];
              return Card(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundImage: specialist.avatarUrl != null ? NetworkImage(specialist.avatarUrl!) : null,
                    child: specialist.avatarUrl == null ? const Icon(Icons.person) : null,
                  ),
                  title: Text(specialist.fullName, style: BoyaTypography.body),
                  subtitle: Text(specialist.bio ?? 'متخصص سیار', style: BoyaTypography.caption),
                  trailing: specialist.offersMobileService
                      ? const Chip(label: Text('سیار'))
                      : null,
                ),
              );
            },
          );
        },
      ),
    );
  }
}