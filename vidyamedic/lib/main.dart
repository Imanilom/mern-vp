import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';
import 'theme/app_theme.dart';
import 'providers/app_state.dart';
import 'screens/welcome_screen.dart';
import 'screens/home/home_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('id_ID', null);
  final appState = AppState();
  await appState.initialize();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(VidyaMedicApp(appState: appState));
}

class VidyaMedicApp extends StatelessWidget {
  final AppState appState;
  const VidyaMedicApp({super.key, required this.appState});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: appState,
      child: MaterialApp(
        title: 'VidyaMedic',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: appState.isAuthenticated ? const HomeScreen() : const WelcomeScreen(),
      ),
    );
  }
}
