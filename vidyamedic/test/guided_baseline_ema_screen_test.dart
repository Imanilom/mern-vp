import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nadiku/screens/scenarios/guided_baseline_ema_screen.dart';

void main() {
  testWidgets('seventh screen captures a separate EMA after interpretation',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: GuidedBaselineEmaScreen(
          stageResults: [
            {
              'activity': 'sitting',
              'label': 'Duduk',
              'skipped': false,
              'incomplete': false,
              'reading_count': 240,
              'window_count': 5,
              'rr_interval_count': 220,
              'minimum_hr': 60,
              'maximum_hr': 72,
            },
            {
              'activity': 'standing',
              'label': 'Berdiri',
              'skipped': false,
              'incomplete': false,
              'reading_count': 235,
              'window_count': 5,
              'rr_interval_count': 210,
              'minimum_hr': 64,
              'maximum_hr': 80,
            },
            {
              'activity': 'walking',
              'label': 'Berjalan',
              'skipped': true,
              'incomplete': false,
              'reading_count': 0,
              'window_count': 0,
              'rr_interval_count': 0,
              'minimum_hr': null,
              'maximum_hr': null,
            },
            {
              'activity': 'sitting',
              'label': 'Duduk kembali',
              'skipped': false,
              'incomplete': true,
              'reading_count': 30,
              'window_count': 1,
              'rr_interval_count': 25,
              'minimum_hr': 59,
              'maximum_hr': 70,
            },
          ],
        ),
      ),
    );

    expect(find.text('Layar 7 dari 7'), findsOneWidget);
    expect(find.text('Catatan pengalaman sesi'), findsOneWidget);
    expect(find.text('Duduk'), findsNWidgets(2));
    expect(find.text('Berjalan'), findsOneWidget);
    expect(find.textContaining('Dilewati · HR minimum — bpm'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Lebih tenang'), 300);
    expect(find.text('Lebih tenang'), findsOneWidget);
    expect(find.text('Tidak nyaman'), findsOneWidget);

    final calmerAnswer = find.ancestor(
      of: find.text('Lebih tenang'),
      matching: find.byType(ChoiceChip),
    );
    await tester.ensureVisible(calmerAnswer);
    await tester.tap(calmerAnswer);
    await tester.pump();

    expect(tester.widget<ChoiceChip>(calmerAnswer).selected, isTrue);
  });
}
