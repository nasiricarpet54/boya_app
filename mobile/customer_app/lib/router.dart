import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

// Providers for simple state
final selectedTabProvider = StateProvider<int>((ref) => 0);

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      ShellRoute(
        builder: (context, state, child) {
          return MainScaffold(child: child);
        },
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const PlaceholderPage(title: 'Home'),
          ),
          GoRoute(
            path: '/explore',
            builder: (context, state) => const PlaceholderPage(title: 'Explore Salons'),
          ),
          GoRoute(
            path: '/appointments',
            builder: (context, state) => const PlaceholderPage(title: 'My Appointments'),
          ),
          GoRoute(
            path: '/favorites',
            builder: (context, state) => const PlaceholderPage(title: 'Favorites'),
          ),
          GoRoute(
            path: '/profile',
            builder: (context, state) => const PlaceholderPage(title: 'Profile'),
          ),
        ],
      ),
    ],
  );
});

class MainScaffold extends ConsumerWidget {
  final Widget child;
  const MainScaffold({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentIndex = ref.watch(selectedTabProvider);

    return Scaffold(
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: currentIndex,
        onTap: (index) {
          ref.read(selectedTabProvider.notifier).state = index;
          switch (index) {
            case 0:
              context.go('/');
              break;
            case 1:
              context.go('/explore');
              break;
            case 2:
              context.go('/appointments');
              break;
            case 3:
              context.go('/favorites');
              break;
            case 4:
              context.go('/profile');
              break;
          }
        },
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.search_outlined), label: 'Explore'),
          BottomNavigationBarItem(icon: Icon(Icons.calendar_today_outlined), label: 'Appointments'),
          BottomNavigationBarItem(icon: Icon(Icons.favorite_outline), label: 'Favorites'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline), label: 'Profile'),
        ],
      ),
    );
  }
}

class PlaceholderPage extends StatelessWidget {
  final String title;
  const PlaceholderPage({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        title,
        style: Theme.of(context).textTheme.displayLarge,
      ),
    );
  }
}
