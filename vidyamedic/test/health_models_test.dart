import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nadiku/models/health_models.dart';

void main() {
  test('missing triage level remains unknown instead of implying green', () {
    expect(
      ActionTriageLevel.fromString(null),
      ActionTriageLevel.unknown,
    );
  });

  test('missing stress remains unrecorded instead of implying low stress', () {
    expect(StressLevel.fromApiValue(null), isNull);
    expect(StressLevel.fromApiValue(0), isNull);
    expect(StressLevel.fromApiValue(6), isNull);
  });

  test('stress values map to the three recorded patient-reported levels', () {
    expect(StressLevel.fromApiValue(1), StressLevel.rendah);
    expect(StressLevel.fromApiValue(2), StressLevel.sedang);
    expect(StressLevel.fromApiValue(3), StressLevel.tinggi);
    expect(StressLevel.fromApiValue(4), isNull);
    expect(StressLevel.fromApiValue(5), isNull);
  });

  test('sleep quality codes match the patient API contract', () {
    expect(SleepQuality.sangatBaik.apiValue, 'very_good');
    expect(SleepQuality.fromApiValue('very_good'), SleepQuality.sangatBaik);
    expect(SleepQuality.fromApiValue('excellent'), SleepQuality.sangatBaik);
  });

  test('sleep duration is calculated across midnight from entered times', () {
    expect(
      calculateSleepDurationMinutes(
        const TimeOfDay(hour: 22, minute: 30),
        const TimeOfDay(hour: 5, minute: 30),
      ),
      420,
    );
    expect(
      calculateSleepDurationMinutes(
        const TimeOfDay(hour: 1, minute: 0),
        const TimeOfDay(hour: 6, minute: 45),
      ),
      345,
    );
    expect(
      calculateSleepDurationMinutes(
        const TimeOfDay(hour: 6, minute: 0),
        const TimeOfDay(hour: 6, minute: 0),
      ),
      0,
    );
  });

  test('steps can be estimated from accelerometer magnitude peaks', () {
    final steps = WearableData.calculateStepsFromAcc([
      [0, 0, 1],
      [0, 0, 1.2],
      [0, 0, 1],
      [0, 0, 1.3],
      [0, 0, 1],
    ]);

    expect(steps, 2);
  });

  test('accelerometer cadence suggests walking or running for confirmation',
      () {
    List<List<double>> periodicAcceleration(double cadenceHz) => [
          for (var index = 0; index < 250; index++)
            [
              1 + 0.18 * math.sin(2 * math.pi * cadenceHz * index / 50),
              0,
              0,
            ],
        ];

    final walking = WearableData.analyzeLocomotion(periodicAcceleration(1.6));
    final running = WearableData.analyzeLocomotion(periodicAcceleration(2.8));
    expect(walking?.activity, 'Berjalan');
    expect(walking?.cadenceHz, closeTo(1.6, 0.1));
    expect(walking?.rmsDeltaMagnitudeG, greaterThan(0));
    expect(running?.activity, 'Berlari');
    expect(running?.cadenceHz, closeTo(2.8, 0.1));
    expect(
      WearableData.inferLocomotionActivity(
          List.generate(250, (_) => [0, 0, 1])),
      isNull,
    );
    expect(
      ActivityMotionPolicy.demo.status,
      'NON-CLINICAL / PLACEHOLDER',
    );
    expect(ActivityMotionPolicy.demo.confidence, 0);
    expect(mapActivityToApi('Berlari'), 'running');
    expect(mapApiToActivity('running'), 'Berlari');
  });

  test('palpitations are labeled as a reported sensation, not a diagnosis', () {
    expect(
      mapApiToSymptomLabel('palpitations'),
      'Jantung terasa berdebar/tidak teratur',
    );
  });
}
