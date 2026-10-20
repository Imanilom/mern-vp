import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';
import 'theme/app_theme.dart';
import 'providers/app_state.dart';
import 'screens/welcome_screen.dart';
import 'screens/home/home_screen.dart';
import 'screens/summary/daily_summary_screen.dart';
import 'screens/scenarios/scenario_lab_screen.dart';
import 'services/morning_summary_reminder.dart';

final GlobalKey<NavigatorState> _appNavigatorKey = GlobalKey<NavigatorState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('id_ID', null);
  final appState = AppState();
  await appState.initialize();

  void openDailySummary() {
    _appNavigatorKey.currentState?.push(
      MaterialPageRoute<void>(
        builder: (_) => const DailySummaryScreen(),
      ),
    );
  }

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(VidyaMedicApp(appState: appState));
  unawaited(_initializeReminder(openDailySummary));
}

Future<void> _initializeReminder(VoidCallback openDailySummary) async {
  try {
    final openedFromReminder = await MorningSummaryReminder.initialize(
      onReminderTap: openDailySummary,
    );
    if (openedFromReminder) {
      WidgetsBinding.instance.addPostFrameCallback((_) => openDailySummary());
    }
  } catch (error, stackTrace) {
    debugPrint('Gagal menginisialisasi pengingat ringkasan pagi: '
        '$error\n$stackTrace');
  }
}

class VidyaMedicApp extends StatelessWidget {
  final AppState appState;
  const VidyaMedicApp({super.key, required this.appState});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: appState,
      child: MaterialApp(
        navigatorKey: _appNavigatorKey,
        title: 'VidyaMedic',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: Consumer<AppState>(
          builder: (context, state, _) => state.isAuthenticated
              ? const HomeScreen()
              : const WelcomeScreen(),
        ),
        routes: {
          '/scenarios': (_) => const ScenarioLabScreen(),
          '/scenarios/a': (_) =>
              const ScenarioLabScreen(initialScenarioId: 'a'),
          '/scenarios/b': (_) =>
              const ScenarioLabScreen(initialScenarioId: 'b'),
          '/scenarios/c': (_) =>
              const ScenarioLabScreen(initialScenarioId: 'c'),
        },
      ),
    );
  }
}
