import 'package:flutter_test/flutter_test.dart';
import 'package:health_trajectory_monitor/core/storage/offline_buffer_service.dart';
import 'package:health_trajectory_monitor/shared/models/models.dart';

void main() {
  group('OfflineBufferService Tests', () {
    late OfflineBufferService service;

    setUp(() {
      service = OfflineBufferService();
    });

    test('should add readings to pending queue', () {
      final reading = SensorReading(
        timestamp: DateTime.now(),
        heartRate: 75,
        rrInterval: 800,
        rmssd: 34.5,
        dfaAlpha1: 1.05,
        signalQuality: 98,
        battery: 85,
        motionState: "Duduk Bekerja",
      );

      expect(service.pendingCount, 0);
      service.addReading(reading);
      expect(service.pendingCount, 1);
      expect(service.pendingQueue.first.reading.heartRate, 75);
    });

    test('should sync pending data successfully and clean up sent items', () async {
      final reading1 = SensorReading(
        timestamp: DateTime.now(),
        heartRate: 75,
        rrInterval: 800,
        rmssd: 34.5,
        dfaAlpha1: 1.05,
        signalQuality: 98,
        battery: 85,
        motionState: "Duduk Bekerja",
      );
      final reading2 = SensorReading(
        timestamp: DateTime.now(),
        heartRate: 80,
        rrInterval: 750,
        rmssd: 32.0,
        dfaAlpha1: 1.01,
        signalQuality: 95,
        battery: 84,
        motionState: "Berjalan",
      );

      service.addReading(reading1);
      service.addReading(reading2);
      expect(service.pendingCount, 2);

      await service.syncPendingData();

      expect(service.pendingCount, 0);
      expect(service.pendingQueue.isEmpty, true);
    });
  });
}
