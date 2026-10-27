import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nadiku/screens/scenarios/human_in_the_loop_baseline_summary_screen.dart';

void main() {
  testWidgets('summary averages stored time contexts and compares new capture',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: HumanInTheLoopBaselineSummaryScreen(
          existingBaselineContexts: [
            {
              'activity': 'Rest',
              'time_period': 'morning',
              'feature_stats': {
                'mean_hr': {'mean': 60},
                'mean_rr': {'mean': 1000},
              },
            },
            {
              'activity': 'rest',
              'time_period': 'evening',
              'feature_stats': {
                'mean_hr': {'mean': 80},
                'mean_rr': {'mean': 900},
              },
            },
          ],
          stageResults: [
            {
              'activity': 'sitting',
              'skipped': false,
              'incomplete': false,
              'recorded_readings': [
                {
                  'recorded_at': '2026-10-27T01:00:00.000Z',
                  'heart_rate_bpm': 70,
                  'rr_interval_ms': 900,
                },
                {
                  'recorded_at': '2026-10-27T01:00:01.000Z',
                  'heart_rate_bpm': 80,
                  'rr_interval_ms': 1000,
                },
              ],
            },
          ],
        ),
      ),
    );

    expect(find.text('Baseline lama'), findsOneWidget);
    expect(
      find.text('Rata-rata baseline lama: pagi, malam'),
      findsOneWidget,
    );
    expect(find.text('Rekaman baru'), findsNWidgets(3));
    expect(find.text('70.0'), findsOneWidget);
    expect(find.text('75.0'), findsOneWidget);
    expect(find.text('950.0'), findsNWidgets(2));
    await tester.scrollUntilVisible(
      find.text('Grafik HR seluruh konteks'),
      200,
    );
    expect(find.text('Grafik HR seluruh konteks'), findsOneWidget);
    expect(find.text('Berjalan'), findsWidgets);
  });
}
