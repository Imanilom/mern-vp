import 'package:flutter_test/flutter_test.dart';
import 'package:nadiku/screens/scenarios/hil_recorded_scenario_screen.dart';

void main() {
  test('latest qualifying deviation is selected ahead of newer normal samples',
      () {
    final samples = [
      {
        '_id': 'deviation',
        'heart_rate_bpm': 95,
        'data_quality': {
          'status': 'accepted',
          'q_signal': 0.9,
          'q_complete': 0.9,
        },
      },
      {
        '_id': 'normal',
        'heart_rate_bpm': 75,
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

    expect(selected?['_id'], 'deviation');
  });

  test('latest deviation requires accepted signal and completeness quality',
      () {
    final samples = [
      {
        '_id': 'low-quality',
        'heart_rate_bpm': 110,
        'data_quality': {
          'status': 'accepted',
          'q_signal': 0.9,
          'q_complete': 0.5,
        },
      },
    ];

    expect(
      HilRecordedScenarioAnalysis.latestDeviationSample(
        samples: samples,
        baselineMean: 70,
        thresholdBpm: 10,
      ),
      isNull,
    );
  });
}
