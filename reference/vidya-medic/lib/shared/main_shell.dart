import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphoricons_flutter/phosphoricons_flutter.dart';
import '../core/theme/htm_colors.dart';

class MainShell extends StatelessWidget {
  final Widget child;

  const MainShell({super.key, required this.child});

  int _calculateSelectedIndex(BuildContext context) {
    final String location = GoRouterState.of(context).uri.path;
    if (location.startsWith('/home')) return 0;
    if (location.startsWith('/monitoring')) return 1;
    if (location.startsWith('/activity')) return 2;
    if (location.startsWith('/history')) return 3;
    if (location.startsWith('/profile')) return 4;
    return 0;
  }

  void _onItemTapped(int index, BuildContext context) {
    switch (index) {
      case 0:
        context.go('/home');
        break;
      case 1:
        context.go('/monitoring');
        break;
      case 2:
        context.go('/activity');
        break;
      case 3:
        context.go('/history');
        break;
      case 4:
        context.go('/profile');
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedIndex = _calculateSelectedIndex(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final border = isDark ? HtmColors.hairlineDark : HtmColors.hairlineLight;
    final bg = isDark ? HtmColors.surfaceDark : HtmColors.surfaceLight;

    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: bg,
          border: Border(
            top: BorderSide(color: border, width: 1.0),
          ),
        ),
        child: SafeArea(
          child: NavigationBar(
            selectedIndex: selectedIndex,
            onDestinationSelected: (index) => _onItemTapped(index, context),
            height: 62,
            destinations: [
              NavigationDestination(
                icon: Icon(PhosphorIcons.house),
                selectedIcon: Icon(PhosphorIcons.houseFill),
                label: 'Beranda',
              ),
              NavigationDestination(
                icon: Icon(PhosphorIcons.heartbeat),
                selectedIcon: Icon(PhosphorIcons.heartbeatFill),
                label: 'Monitoring',
              ),
              NavigationDestination(
                icon: Icon(PhosphorIcons.barbell),
                selectedIcon: Icon(PhosphorIcons.barbellFill),
                label: 'Aktivitas',
              ),
              NavigationDestination(
                icon: Icon(PhosphorIcons.calendar),
                selectedIcon: Icon(PhosphorIcons.calendarFill),
                label: 'Riwayat',
              ),
              NavigationDestination(
                icon: Icon(PhosphorIcons.user),
                selectedIcon: Icon(PhosphorIcons.userFill),
                label: 'Profil',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
