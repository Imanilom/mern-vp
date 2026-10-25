import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:nadiku/services/api_service.dart';
import 'package:nadiku/services/wearable_pairing_service.dart';

void main() {
  testWidgets('dummy wearable records explicitly simulated HR, RR, and ACC',
      (tester) async {
    final uploadedSamples = <Map<String, dynamic>>[];
    final publishedBatches = <Map<String, dynamic>>[];
    final bridge = PolarWearablePairingService(
      uploadSample: (sample) async {
        uploadedSamples.add(sample);
        return ApiResponse.success({'sample': sample});
      },
      uploadStream: (batch) async {
        publishedBatches.add(batch);
        return ApiResponse.success({'published': true});
      },
      onSampleStored: () {},
    );
    addTearDown(bridge.dispose);

    expect(await bridge.connectDummyDevice(), isTrue);
    expect(bridge.isDemoDevice, isTrue);
    expect(bridge.deviceName, contains('DEMO'));
    expect(bridge.startStreaming('walking'), isTrue);

    await tester.pump(const Duration(seconds: 60));
    expect(bridge.sessionMinimumHeartRate, isNotNull);
    expect(bridge.sessionMaximumHeartRate, isNotNull);
    expect(
      bridge.sessionMinimumHeartRate,
      lessThanOrEqualTo(bridge.sessionMaximumHeartRate!),
    );
    await bridge.stopStreaming();

    expect(uploadedSamples, hasLength(1));
    expect(uploadedSamples.single['provider'], 'other');
    expect(uploadedSamples.single['is_simulated'], isTrue);
    expect(
      utf8.encode(jsonEncode(uploadedSamples.single)).length,
      lessThan(10 * 1024),
    );
    expect(uploadedSamples.single['heart_rate_bpm'], isA<int>());
    expect(
        uploadedSamples.single['rr_intervals_ms'], hasLength(greaterThan(9)));
    expect(
      uploadedSamples.single['acceleration_g'],
      hasLength(greaterThanOrEqualTo(10)),
    );
    expect(publishedBatches, isNotEmpty);
    expect(
      publishedBatches.every(
        (batch) =>
            batch['provider'] == 'other' && batch['is_simulated'] == true,
      ),
      isTrue,
    );
    final publishedReadings =
        publishedBatches.expand((batch) => batch['readings'] as List).toList();
    expect(publishedReadings, isNotEmpty);
    expect(
      publishedReadings.every((reading) => reading['sensor_contact'] == true),
      isTrue,
    );
    expect(
      publishedReadings.every((reading) => reading['signal_confidence'] == 1.0),
      isTrue,
    );
    expect(
      publishedBatches.every((batch) =>
          (batch['readings'] as List).length <= 20 &&
          utf8.encode(jsonEncode(batch)).length < 10 * 1024),
      isTrue,
    );
  });
}
