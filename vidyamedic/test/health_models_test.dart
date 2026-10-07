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
    expect(StressLevel.fromApiValue(3), StressLevel.sedang);
    expect(StressLevel.fromApiValue(5), StressLevel.tinggi);
    expect(StressLevel.fromApiValue(2), isNull);
    expect(StressLevel.fromApiValue(4), isNull);
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

  test('palpitations are labeled as a reported sensation, not a diagnosis', () {
    expect(
      mapApiToSymptomLabel('palpitations'),
      'Jantung terasa berdebar/tidak teratur',
    );
  });
}
