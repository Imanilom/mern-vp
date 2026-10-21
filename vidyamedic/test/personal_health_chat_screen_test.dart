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
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
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

  testWidgets('shows recovery shortcuts when personal data is missing',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    final state = AppState()
      ..userProfile.name = 'Pasien tanpa data'
      ..wearable = WearableData();
    addTearDown(state.dispose);

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: state,
        child: const MaterialApp(home: PersonalHealthChatScreen()),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pumpAndSettle();
    final sleepSuggestion = find.text('Apa yang tercatat tentang tidur saya?');
    await tester.scrollUntilVisible(
      sleepSuggestion,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(sleepSuggestion);
    await tester.pumpAndSettle();

    expect(
        find.text(
            'Belum ada catatan tidur yang tersedia pada ringkasan yang dimuat.'),
        findsOneWidget);
    expect(find.text('Perbarui data'), findsOneWidget);
    expect(find.text('Cara mencatat data'), findsOneWidget);
    expect(find.text('Coba topik lain'), findsOneWidget);
  });

  testWidgets('requires consent before enabling Gemini', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final state = AppState()..userProfile.name = 'Pasien persetujuan';
    addTearDown(state.dispose);

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: state,
        child: const MaterialApp(home: PersonalHealthChatScreen()),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    await tester.tap(find.byTooltip('Aktifkan Gemini (perlu persetujuan)'));
    await tester.pumpAndSettle();
    expect(find.text('Aktifkan Gemini?'), findsOneWidget);
    expect(
      find.textContaining(
          'akan dikirim melalui backend VidyaMedic ke Google Gemini'),
      findsOneWidget,
    );

    await tester.tap(find.text('Setuju, aktifkan'));
    await tester.pumpAndSettle();
    expect(find.byTooltip('Gemini aktif; ketuk untuk menonaktifkan'),
        findsOneWidget);
    expect(
      find.textContaining('Gemini aktif dengan persetujuan Anda'),
      findsOneWidget,
    );
    expect(
      (await SharedPreferences.getInstance()).getBool(
        'vidyamedic_personal_chat_gemini_consent_v1_Pasien%20persetujuan',
      ),
      isTrue,
    );
  });
}
