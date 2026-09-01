import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'screens/history/history_screen.dart';
import 'screens/home/home_screen.dart';
import 'screens/insight/insight_screen.dart';
import 'screens/journey/journey_screen.dart';
import 'screens/onboarding/baseline_readiness_screen.dart';
import 'screens/onboarding/consent_screen.dart';
import 'screens/onboarding/device_pairing_screen.dart';
import 'screens/onboarding/login_screen.dart';
import 'screens/onboarding/splash_transition_screen.dart';
import 'screens/onboarding/welcome_screen.dart';
import 'screens/profile/profile_screen.dart';
import 'screens/insight/zero_shot_screen.dart';
import 'theme/app_colors.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();



  runApp(
    const ProviderScope(
      child: CaparMobileApp(),
    ),
  );
}

class CaparMobileApp extends StatelessWidget {
  const CaparMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CAPAR Participant App',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: AppColors.bg,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.teal,
          primary: AppColors.teal,
          surface: AppColors.surface,
        ),
        textTheme: GoogleFonts.plusJakartaSansTextTheme(
          ThemeData.light().textTheme,
        ),
      ),
      initialRoute: '/',
      routes: {
        '/': (context) => const WelcomeScreen(),
        '/login': (context) => const LoginScreen(),
        '/consent': (context) => const ConsentScreen(),
        '/pairing': (context) => const DevicePairingScreen(),
        '/baseline': (context) => const BaselineReadinessScreen(),
        '/splash_transition': (context) => const SplashTransitionScreen(),
        '/app': (context) => const MainTabShell(),
      },
    );
  }
}

class MainTabShell extends StatefulWidget {
  const MainTabShell({super.key});

  @override
  State<MainTabShell> createState() => _MainTabShellState();
}

class _MainTabShellState extends State<MainTabShell> {
  int _currentIndex = 0;

  final List<Widget> _pages = [
    const HomeScreen(),
    const JourneyScreen(),
    const HistoryScreen(),
    const InsightScreen(),
    const ZeroShotScreen(),
    const ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 16,
              offset: const Offset(0, -3),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          child: BottomNavigationBar(
            currentIndex: _currentIndex,
            onTap: (idx) => setState(() => _currentIndex = idx),
            type: BottomNavigationBarType.fixed,
            backgroundColor: AppColors.surface,
            selectedItemColor: AppColors.teal,
            unselectedItemColor: AppColors.gray,
            selectedFontSize: 11,
            unselectedFontSize: 10.5,
            selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w800),
            unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600),
            elevation: 0,
            items: const [
              BottomNavigationBarItem(
                icon: Icon(Icons.home_rounded),
                activeIcon: Icon(Icons.home_rounded, size: 24),
                label: 'Home',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.explore_rounded),
                activeIcon: Icon(Icons.explore_rounded, size: 24),
                label: 'Journey',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.show_chart_rounded),
                activeIcon: Icon(Icons.show_chart_rounded, size: 24),
                label: 'Episode',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.lightbulb_rounded),
                activeIcon: Icon(Icons.lightbulb_rounded, size: 24),
                label: 'Insights',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.smart_toy_rounded),
                activeIcon: Icon(Icons.smart_toy_rounded, size: 24),
                label: 'AI',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.person_rounded),
                activeIcon: Icon(Icons.person_rounded, size: 24),
                label: 'Profile',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
