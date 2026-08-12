import 'package:flutter/material.dart';

import 'screens/history/history_screen.dart';
import 'screens/home/home_screen.dart';
import 'screens/insight/insight_screen.dart';
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
  await BackgroundTask.initializeService();
  final prefs = await SharedPreferences.getInstance();
  final hasToken = prefs.getString('auth_token') != null;

  runApp(CaparMobileApp(hasToken: hasToken));
}

class CaparMobileApp extends StatelessWidget {
  final bool hasToken;
  const CaparMobileApp({super.key, required this.hasToken});

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
        textTheme: GoogleFonts.interTextTheme(Theme.of(context).textTheme),
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
      SocketService.init(context);
    });
  }

  final List<Widget> _pages = const [
    HomeScreen(),
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
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (idx) => setState(() => _currentIndex = idx),
        type: BottomNavigationBarType.fixed,
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.teal,
        unselectedItemColor: AppColors.gray,
        selectedFontSize: 11,
        unselectedFontSize: 11,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_rounded),
            label: 'Beranda',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.history_rounded),
            label: 'Riwayat',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.lightbulb_rounded),
            label: 'Insight',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_rounded),
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}
