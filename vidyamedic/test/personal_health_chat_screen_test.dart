import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';
import 'package:nadiku/models/health_models.dart';
import 'package:nadiku/providers/app_state.dart';
import 'package:nadiku/screens/chat/personal_health_chat_screen.dart';
import 'package:nadiku/screens/home/home_screen.dart';
import 'package:nadiku/theme/app_theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('chat answers from personal data and keeps local history',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final state = AppState()
      ..userProfile.name = 'Pasien A'
      ..wearable = WearableData(
        hasServerSamples: true,
        heartRate: 90,
        baselineHr: 72,
      );
    addTearDown(state.dispose);

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: state,
        child: const MaterialApp(home: PersonalHealthChatScreen()),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    await tester
        .tap(find.text('Bagaimana denyut jantung saya dibanding baseline?'));
    await tester.pumpAndSettle();
    expect(find.textContaining('90 bpm'), findsOneWidget);
    expect(find.textContaining('baseline pribadi 72 bpm'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: state,
        child: const MaterialApp(home: PersonalHealthChatScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Bagaimana denyut jantung saya dibanding baseline?'),
        findsOneWidget);
    expect(find.textContaining('90 bpm'), findsOneWidget);
  });

  testWidgets('home opens the personal chat', (tester) async {
    await initializeDateFormatting('id_ID', null);
    SharedPreferences.setMockInitialValues({});
    final state = AppState()..dataError = 'Test data state';
    addTearDown(state.dispose);
    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: state,
        child: MaterialApp(
          theme: AppTheme.lightTheme,
          home: const HomeScreen(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    final entry = find.text('Tanya Wawasan Personal');
    await tester.ensureVisible(entry);
    await tester.tap(entry);
    await tester.pumpAndSettle();

    expect(find.text('Wawasan Personal'), findsOneWidget);
  });
}
