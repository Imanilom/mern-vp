import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nadiku/screens/scenarios/hil_recorded_scenario_screen.dart';
import 'package:nadiku/widgets/hil_hr_line_chart.dart';

void main() {
  test('selects the maximum heart-rate sample from a recording', () {
    final samples = [
      {
        '_id': 'peak',
        'heart_rate_bpm': 125,
      },
      {
        '_id': 'last',
        'heart_rate_bpm': 88,
      },
    ];

    final selected =
        HilRecordedScenarioAnalysis.maximumHeartRateSample(samples);

    expect(selected?['_id'], 'peak');
  });

  test('maximum sample ignores non-numeric and non-finite heart rates', () {
    final samples = [
      {'_id': 'invalid', 'heart_rate_bpm': double.nan},
      {'_id': 'missing', 'heart_rate_bpm': null},
      {'_id': 'valid', 'heart_rate_bpm': 104},
    ];

    expect(
      HilRecordedScenarioAnalysis.maximumHeartRateSample(samples)?['_id'],
      'valid',
    );
  });

  test('scenario C detects qualified raw HR above baseline', () {
    final rawReading = {
      'heart_rate_bpm': 76,
      'sensor_contact': true,
      'signal_confidence': 0.9,
      'recorded_at': '2026-11-01T04:00:00.000Z',
    };

    expect(
      HilRecordedScenarioAnalysis.isElevatedRawReading(
        reading: rawReading,
        baselineMean: 75,
        thresholdBpm: 0,
      ),
      isTrue,
    );
    expect(
      HilRecordedScenarioAnalysis.isElevatedRawReading(
        reading: rawReading,
        baselineMean: 76,
        thresholdBpm: 0,
      ),
      isFalse,
    );
    expect(
      HilRecordedScenarioAnalysis.isElevatedRawReading(
        reading: {...rawReading, 'signal_confidence': 0.4},
        baselineMean: 70,
        thresholdBpm: 0,
      ),
      isFalse,
    );
    expect(
      HilRecordedScenarioAnalysis.maximumQualifiedRawHeartRateSample([
        {
          ...rawReading,
          'heart_rate_bpm': 180,
          'signal_confidence': 0.3,
        },
        rawReading,
      ])?['heart_rate_bpm'],
      76,
    );
  });

  testWidgets('HR line chart replaces per-reading BPM chips', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: HilHrLineChart(
            chartKey: Key('hil-recorded-hr-line-chart'),
            readings: [90, 78, 92, 83, 81, 87],
            personalBaseline: 70,
            activityAverage: null,
          ),
        ),
      ),
    );

    expect(find.byKey(const Key('hil-recorded-hr-line-chart')), findsOneWidget);
    expect(find.byType(Chip), findsNothing);
  });
}
