import 'package:flutter_test/flutter_test.dart';
import 'package:nadiku/screens/scenarios/hil_recorded_scenario_screen.dart';

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

  test('selects latest qualifying deviation for the one-way scenario flow', () {
    final samples = [
      {
        '_id': 'earlier-deviation',
        'heart_rate_bpm': 110,
        'data_quality': {
          'status': 'accepted',
          'q_signal': 0.9,
          'q_complete': 0.9,
        },
      },
      {
        '_id': 'latest-deviation',
        'heart_rate_bpm': 100,
        'data_quality': {
          'status': 'accepted',
          'q_signal': 0.9,
          'q_complete': 0.9,
        },
      },
    ];

    final selected = HilRecordedScenarioAnalysis.latestDeviationSample(
      samples: samples,
      baselineMean: 70,
      thresholdBpm: 10,
    );

    expect(selected?['_id'], 'latest-deviation');
  });
}
