import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';
import 'package:nadiku/providers/app_state.dart';
import 'package:nadiku/screens/home/home_screen.dart';
import 'package:nadiku/theme/app_theme.dart';

void main() {
  testWidgets('home, daily summary, and community keep valid scroll layouts',
      (tester) async {
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
    expect(find.text('Gambaran diri Anda'), findsOneWidget);

    for (final tab in [
      'Catat Harian',
      'Ringkasan',
      'Profil',
      'Komunitas',
      'Beranda',
    ]) {
      await tester.tap(find.text(tab).last);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.takeException(), isNull, reason: 'Layout failed on $tab');
    }
  });
}
