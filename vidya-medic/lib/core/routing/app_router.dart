import 'package:go_router/go_router.dart';
import '../../features/onboarding/splash_page.dart';
import '../../features/auth/login_page.dart';
import '../../features/home/home_page.dart';
import '../../features/monitoring/monitoring_page.dart';
import '../../features/activity/activity_page.dart';
import '../../features/alerts/alerts_page.dart';
import '../../features/history/history_page.dart';
import '../../features/profile/profile_page.dart';
import '../../shared/main_shell.dart';

final appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const SplashPage(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginPage(),
    ),
    GoRoute(
      path: '/alerts',
      builder: (context, state) => const AlertsPage(),
    ),
    ShellRoute(
      builder: (context, state, child) => MainShell(child: child),
      routes: [
        GoRoute(
          path: '/home',
          builder: (context, state) => const HomePage(),
        ),
        GoRoute(
          path: '/monitoring',
          builder: (context, state) => const MonitoringPage(),
        ),
        GoRoute(
          path: '/activity',
          builder: (context, state) => const ActivityPage(),
        ),
        GoRoute(
          path: '/history',
          builder: (context, state) => const HistoryPage(),
        ),
        GoRoute(
          path: '/profile',
          builder: (context, state) => const ProfilePage(),
        ),
      ],
    ),
  ],
);
