import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';
import 'package:nadiku/providers/app_state.dart';
import 'package:nadiku/screens/home/home_screen.dart';
import 'package:nadiku/theme/app_theme.dart';

void main() {
  testWidgets(
      'movement prompt offers sitting and keeps current activity safely',
      (tester) async {
    await initializeDateFormatting('id_ID', null);
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final appState = AppState()
      ..isRefreshing = true
      ..activity = 'Berdiri'
      ..suggestedActivity = 'Berjalan'
      ..showActivityMovementPrompt = true;

    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => appState,
        child: MaterialApp(
          theme: AppTheme.lightTheme,
          home: const HomeScreen(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Duduk'), findsOneWidget);
    expect(find.text('Saya tetap berdiri'), findsOneWidget);

    await tester.tap(find.text('Saya tetap berdiri'));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(appState.showActivityMovementPrompt, isFalse);
    expect(appState.activity, 'Berdiri');
  });
}
