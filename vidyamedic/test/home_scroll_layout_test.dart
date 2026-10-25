import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';
import 'package:nadiku/providers/app_state.dart';
import 'package:nadiku/screens/home/home_screen.dart';
import 'package:nadiku/theme/app_theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('primary tabs and preserved features keep valid layouts',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    await initializeDateFormatting('id_ID', null);
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final appState = AppState()..dataError = 'Test data state';
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
    expect(find.text('Catat Hari Ini'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Buka semua pilihan pencatatan'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Buka semua pilihan pencatatan'), findsOneWidget);

    await tester.tap(find.text('Insight').last);
    await tester.pumpAndSettle();
    expect(find.text('Tren & perjalanan kesehatan'), findsOneWidget);
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
