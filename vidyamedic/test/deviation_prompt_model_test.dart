import 'package:flutter_test/flutter_test.dart';
import 'package:nadiku/models/health_models.dart';
import 'package:nadiku/services/deviation_prompt_model.dart';

void main() {
  const model = DeviationPromptModel();

  test('only uses recorded context within 24 hours before the deviation', () {
    final message = model.generate(
      followUp: CaparFollowUpPrompt(
        status: 'requested',
        peakTime: DateTime.utc(2026, 10, 21, 8),
        mainFactors: [
          {'feature': 'delta_hr', 'delta': -8},
        ],
      ),
      wearable: WearableData(),
      checkIns: [
        {
          'recorded_at': '2026-10-20T07:59:00Z',
          'activity': 'running',
          'stress_level': 3,
        },
        {
          'recorded_at': '2026-10-21T09:00:00Z',
          'activity': 'running',
          'stress_level': 3,
        },
      ],
    );

    expect(message, contains('8 bpm lebih rendah'));
    expect(message, contains('Belum ada catatan aktivitas'));
    expect(message, isNot(contains('berlari')));
    expect(message, isNot(contains('stres tinggi')));
  });

  test('includes recorded sleep and caffeine context when available', () {
    final message = model.generate(
      followUp: CaparFollowUpPrompt(
        status: 'requested',
        peakTime: DateTime.utc(2026, 10, 21, 8),
      ),
      wearable: WearableData(),
      checkIns: [
        {
          'recorded_at': '2026-10-21T07:30:00Z',
          'sleep': {'duration_minutes': 390, 'quality': 'fair'},
          'lifestyle': {'caffeine': true},
        },
      ],
    );

    expect(message, contains('tidur 6 jam 30 menit'));
    expect(message, contains('kualitas tidur cukup'));
    expect(message, contains('konsumsi kafein'));
  });

  test('does not use a wearable sample recorded far from the deviation', () {
    final message = model.generate(
      followUp: CaparFollowUpPrompt(
        status: 'requested',
        peakTime: DateTime.utc(2026, 10, 20, 8),
      ),
      wearable: WearableData(
        hasServerSamples: true,
        heartRate: 120,
        baselineHr: 60,
        lastSync: DateTime.utc(2026, 10, 21, 8),
      ),
      checkIns: const [],
    );

    expect(message, isNot(contains('120 bpm')));
    expect(message, isNot(contains('60 bpm')));
  });

  test('uses a recent wearable sample when CAPAR has no heart-rate factor', () {
    final timestamp = DateTime.utc(2026, 10, 21, 8);
    final message = model.generate(
      followUp: const CaparFollowUpPrompt(status: 'requested'),
      wearable: WearableData(
        hasServerSamples: true,
        heartRate: 88,
        baselineHr: 72,
        lastSync: timestamp,
      ),
      checkIns: const [],
      now: timestamp,
    );

    expect(message, contains('denyut jantung 88 bpm'));
    expect(message, contains('16 bpm di atas baseline pribadi Anda (72 bpm)'));
  });
}
