import 'package:flutter/material.dart';

import 'screens/history/history_screen.dart';
import 'screens/home/home_screen.dart';
import 'screens/insight/insight_screen.dart';
import 'screens/journey/journey_screen.dart';
import 'screens/onboarding/baseline_readiness_screen.dart';
import 'screens/onboarding/consent_screen.dart';
import 'screens/onboarding/device_pairing_screen.dart';
import 'screens/onboarding/welcome_screen.dart';
import 'screens/onboarding/login_screen.dart';
import 'screens/profile/profile_screen.dart';
import 'services/socket_service.dart';
import 'theme/app_colors.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'services/background_task.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Catch Flutter framework errors so they show on screen instead of black screen
  FlutterError.onError = (details) {
    debugPrint('FlutterError: ${details.exception}');
    debugPrint('Stack: ${details.stack}');
    FlutterError.presentError(details);
  };

  // Show error widget instead of black screen on build errors
  ErrorWidget.builder = (FlutterErrorDetails details) {
    return MaterialApp(
      home: Scaffold(
        backgroundColor: Colors.red.shade50,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'ERROR: ${details.exception}',
              style: const TextStyle(color: Colors.red, fontSize: 14),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  };

  final prefs = await SharedPreferences.getInstance();
  final hasToken = prefs.getString('auth_token') != null;

  runApp(CaparMobileApp(hasToken: hasToken));
}

class CaparMobileApp extends StatelessWidget {
  final bool hasToken;
  const CaparMobileApp({super.key, this.hasToken = false});

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
      initialRoute: hasToken ? '/app' : '/',
      routes: {
        '/': (context) => const WelcomeScreen(),
        '/login': (context) => const LoginScreen(),
        '/consent': (context) => const ConsentScreen(),
        '/pairing': (context) => const DevicePairingScreen(),
        '/baseline': (context) => const BaselineReadinessScreen(),
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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      SocketService.init(context);
      BackgroundTask.initializeService().catchError((e) {
        debugPrint('Background service init error: $e');
      });
    });
  }

  final List<Widget> _pages = const [
    HomeScreen(),
    JourneyScreen(),
    HistoryScreen(),
    InsightScreen(),
    ProfileScreen(),
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
