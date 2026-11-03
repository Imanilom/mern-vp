import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nadiku/screens/scenarios/hil_baseline_history_screen.dart';

void main() {
  testWidgets('baseline history shows longitudinal chart and stored windows',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: HilBaselineHistoryScreen(
          baselineContexts: [
            {
              'activity': 'sitting',
              'segment_count': 3,
              'feature_stats': {
                'mean_hr': {'mean': 72},
              },
              'scenario_readiness': {'valid_window_count': 2},
              'history': [
                {
                  'date': '2026-11-01',
                  'segment_count': 3,
                  'valid_window_count': 2,
                  'feature_stats': {
                    'mean_hr': {'mean': 72},
                  },
                  'windows': [
                    {
                      'window_start': '2026-11-01T04:00:00.000Z',
                      'quality': {'q_signal': 0.9, 'q_complete': 0.9},
                      'quality_passed': true,
                      'features': {
                        'mean_hr': 70,
                        'mean_rr': 850,
                        'rmssd': 20,
                      },
                    },
                    {
                      'window_start': '2026-11-01T04:01:00.000Z',
                      'quality': {'q_signal': 0.8, 'q_complete': 0.9},
                      'quality_passed': true,
                      'features': {'mean_hr': 74},
                    },
                    {
                      'window_start': '2026-11-01T04:02:00.000Z',
                      'quality': {'q_signal': 0.4, 'q_complete': 0.9},
                      'quality_passed': false,
                      'features': {'mean_hr': 120},
                    },
                  ],
                },
              ],
            },
          ],
        ),
      ),
    );

    expect(find.byKey(const Key('hil-baseline-longitudinal-chart')),
        findsOneWidget);
    expect(find.textContaining('HR baseline 72.0 bpm'), findsOneWidget);

    final activity = find.byKey(
      const Key('hil-baseline-history-activity-sitting'),
    );
    await tester.ensureVisible(activity);
    await tester.tap(activity);
    await tester.pumpAndSettle();
    final day = find.byKey(
      const Key('hil-baseline-history-day-sitting-2026-11-01'),
    );
    await tester.ensureVisible(day);
    await tester.tap(day);
    await tester.pumpAndSettle();

    expect(
      find.byKey(const Key('hil-baseline-window-sitting-1793505600000')),
      findsOneWidget,
    );
    expect(find.textContaining('HR 70.0 bpm · RR 850.0 ms'), findsOneWidget);
    expect(find.textContaining('Mutu sinyal 0.40'), findsOneWidget);
    expect(find.textContaining('Tidak lolos'), findsOneWidget);
  });
}
