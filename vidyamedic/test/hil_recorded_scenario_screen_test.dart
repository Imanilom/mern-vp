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

  test('scenario C conclusion includes the measured delta and reported context',
      () {
    final conclusion = HilRecordedScenarioAnalysis.participantContextConclusion(
      heartRate: 96,
      baselineMean: 72,
      participantContext: 'Saya baru selesai berjalan.',
    );

    expect(conclusion, contains('HR raw saat deviasi 96.0'));
    expect(conclusion, contains('lebih tinggi 24.0'));
    expect(conclusion, contains('rata-rata baseline 72.0'));
    expect(conclusion, contains('Saya baru selesai berjalan.'));
    expect(conclusion, contains('tidak membuktikan penyebab deviasi'));
  });

  test('repeat recording averages only qualified raw readings', () {
    final average = HilRecordedScenarioAnalysis.averageQualifiedRawHeartRate([
      {'heart_rate_bpm': 80, 'sensor_contact': true, 'signal_confidence': 0.9},
      {'heart_rate_bpm': 100, 'sensor_contact': true, 'signal_confidence': 0.8},
      {'heart_rate_bpm': 240, 'sensor_contact': true, 'signal_confidence': 0.2},
      {'heart_rate_bpm': 70, 'sensor_contact': false, 'signal_confidence': 1.0},
    ]);

    expect(average, 90);
    expect(HilRecordedScenarioAnalysis.minimumRepeatReadings, 5);
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
