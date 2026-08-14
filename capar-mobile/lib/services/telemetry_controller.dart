import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../shared/models/models.dart';
import 'mqtt_service.dart';
import 'ble_service.dart';

class TelemetryController {
  final Ref ref;
  Timer? _flushTimer;
  final List<SensorReading> _buffer = [];
  bool _isStreaming = false;
  ProviderSubscription? _subscription;

  TelemetryController(this.ref);

  bool get isStreaming => _isStreaming;

  void startStreaming(String userId, String deviceId) {
    if (_isStreaming) return;
    _isStreaming = true;
    _buffer.clear();

    debugPrint('[TelemetryController] Memulai streaming ke MQTT untuk user $userId...');

    // Start timer to flush data every 5 seconds
    _flushTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      _flushBuffer(userId, deviceId);
    });

    // Listen to incoming sensor readings
    _subscription = ref.listen<AsyncValue<SensorReading>>(
      currentSensorReadingProvider,
      (previous, next) {
        if (next.hasValue && next.value != null && _isStreaming) {
          _buffer.add(next.value!);
        }
      },
      fireImmediately: false,
    );
  }

  void stopStreaming() {
    debugPrint('[TelemetryController] Menghentikan streaming...');
    _isStreaming = false;
    _flushTimer?.cancel();
    _subscription?.close();
    _buffer.clear();
  }

  Future<void> _flushBuffer(String userId, String deviceId) async {
    if (_buffer.isEmpty) return;
    final readingsToPublish = List<SensorReading>.from(_buffer);
    _buffer.clear();

    final mqtt = ref.read(mqttServiceProvider);
    await mqtt.publishSensorReadings(
      userId: userId,
      deviceId: deviceId,
      readings: readingsToPublish,
    );
  }
}

final telemetryControllerProvider = Provider<TelemetryController>((ref) {
  return TelemetryController(ref);
});
