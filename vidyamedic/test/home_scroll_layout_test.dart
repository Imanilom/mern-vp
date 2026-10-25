import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';
import 'package:nadiku/providers/app_state.dart';
import 'package:nadiku/screens/home/home_screen.dart';
import 'package:nadiku/theme/app_theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets(
      'today shows reported activity and CAPAR episodes, insights '
      'show personal physiology by activity', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await initializeDateFormatting('id_ID', null);
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    final now = DateTime.now();
    final state = AppState()
      ..dataError = 'Test data state'
      ..dailySummaryData = {
        'check_ins': [
          {
            'recorded_at': now.toIso8601String(),
            'activity': 'walking',
            'symptoms': [],
          },
        ],
      }
      ..personalChatCheckIns = [
        {
          'recorded_at': now.toIso8601String(),
          'activity': 'walking',
          'symptoms': [],
        },
      ]
      ..personalChatWearableHistory = [
        {
          'recorded_at':
              now.subtract(const Duration(hours: 1)).toIso8601String(),
          'activity': 'walking',
          'heart_rate_bpm': 100,
          'rmssd_ms': 42,
          'sample_count': 4,
          'is_simulated': false,
        },
        {
          'recorded_at':
              now.subtract(const Duration(minutes: 30)).toIso8601String(),
          'activity': 'sitting',
          'heart_rate_bpm': 72,
          'rmssd_ms': 55,
          'sample_count': 3,
          'is_simulated': false,
        },
      ]
      ..rawCaparInsights = {
        'capar': {
          'episode_history': [
            {
              'start_at': now.toIso8601String(),
              'activity': 'walking',
              'classification': 'Perubahan fisiologis',
              'outcome': 'recovered',
              'duration_ms': 120000,
              'features': {'heart_rate_mean': 104},
            },
          ],
        },
      };
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
    await tester.pump(const Duration(milliseconds: 100));
    await tester.tap(find.text('Hari Ini').last);
    await tester.pumpAndSettle();
    expect(find.text('Aktivitas hari ini'), findsOneWidget);
    expect(find.text('Berjalan'), findsWidgets);
    await tester.scrollUntilVisible(
      find.text('Episode hari ini'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Episode hari ini'), findsOneWidget);
    expect(find.text('Perubahan fisiologis'), findsOneWidget);
    expect(find.textContaining('HR rata-rata segmen 104 bpm'), findsOneWidget);

    await tester.tap(find.text('Insight').last);
    await tester.pumpAndSettle();
    expect(find.text('Pola fisiologis berdasarkan aktivitas'), findsOneWidget);
    expect(find.text('Berjalan'), findsWidgets);
    expect(find.text('Duduk'), findsOneWidget);
    expect(find.textContaining('RMSSD 42.0 ms'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Tren fisiologis personal'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Tren fisiologis personal'), findsOneWidget);
  });

  testWidgets('primary tabs and preserved features keep valid layouts',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    await initializeDateFormatting('id_ID', null);
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final now = DateTime.now();
    final appState = AppState()
      ..dataError = 'Test data state'
      ..wearableSamples = [
        {
          'recorded_at':
              now.subtract(const Duration(minutes: 10)).toIso8601String(),
          'heart_rate_bpm': 80,
          'rmssd_ms': 40,
          'sample_count': 1,
          'is_simulated': false,
        },
        {
          'recorded_at': now.toIso8601String(),
          'heart_rate_bpm': 100,
          'rmssd_ms': 60,
          'sample_count': 1,
          'is_simulated': false,
        },
        {
          'recorded_at': now.toIso8601String(),
          'heart_rate_bpm': 180,
          'rmssd_ms': 100,
          'is_simulated': true,
        },
      ];
    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => appState,
        child: MaterialApp(
          theme: AppTheme.lightTheme,
          home: const HomeScreen(),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.takeException(), isNull);
    expect(find.text('Monitoring wearable'), findsOneWidget);
    expect(find.text('Detak Jantung'), findsOneWidget);
    expect(find.text('HRV (RMSSD)'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Ringkasan fisiologis hari ini'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Rata-rata denyut'), findsOneWidget);
    expect(find.textContaining('90 bpm'), findsOneWidget);
    expect(find.textContaining('50 ms · RMSSD'), findsOneWidget);
    expect(find.text('Gambaran diri Anda'), findsOneWidget);
    expect(find.text('Catatan Hari Ini'), findsOneWidget);
    expect(find.text('Progres catatan hari ini'), findsOneWidget);
    expect(find.text('Misi pemantauan'), findsNothing);
    expect(find.text('Progres pemantauan hari ini'), findsNothing);
    expect(
      tester.getTopLeft(find.text('Detak Jantung')).dy,
      lessThan(tester.getTopLeft(find.text('Gambaran diri Anda')).dy),
    );
    expect(
      tester.getTopLeft(find.text('Gambaran diri Anda')).dy,
      lessThan(tester.getTopLeft(find.text('Catatan Hari Ini')).dy),
    );

    for (final tab in [
      'Hari Ini',
      'Insight',
      'Tanya AI',
      'Profil',
      'Beranda'
    ]) {
      await tester.tap(find.text(tab).last);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.takeException(), isNull, reason: 'Layout failed on $tab');
    }

    await tester.tap(find.text('Hari Ini').last);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Catat Hari Ini'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Catat Hari Ini'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Buka semua pilihan pencatatan'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Buka semua pilihan pencatatan'), findsOneWidget);

    await tester.tap(find.text('Insight').last);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Tren & perjalanan kesehatan'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Tren & perjalanan kesehatan'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Riwayat baseline dan CAPAR'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Riwayat baseline dan CAPAR'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Skenario HCI A/B/C'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Komunitas'), findsOneWidget);
    expect(find.text('Skenario HCI A/B/C'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Komunitas'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Komunitas'));
    await tester.pumpAndSettle();
    expect(find.text('Koin & Komunitas'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('Insight'), findsWidgets);
  });
}
