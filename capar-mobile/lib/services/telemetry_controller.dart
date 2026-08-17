import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../shared/models/models.dart';
import 'mqtt_service.dart';
import 'ble_service.dart';

class PendingDataRecord {
  final String id;
  final SensorReading reading;
  final String status; // 'pending', 'sent', 'failed'
  final DateTime createdAt;

  PendingDataRecord({
    required this.id,
    required this.reading,
    this.status = 'pending',
    required this.createdAt,
  });
}

class TelemetryController extends ChangeNotifier {
  final Ref ref;
  final List<PendingDataRecord> _queue = [];
  int _idCounter = 0;
  bool _isSyncing = false;
  bool _isStreaming = true; // Auto-started by default

  TelemetryController(this.ref);

  List<PendingDataRecord> get pendingQueue => List.unmodifiable(_queue);

  int get pendingCount => _queue.where((r) => r.status == 'pending').length;

  bool get isStreaming => _isStreaming;

  void startStreaming() {
    _isStreaming = true;
    notifyListeners();
  }

  void stopStreaming() {
    _isStreaming = false;
    _queue.clear();
    notifyListeners();
  }

  void addReading(SensorReading reading) {
    if (!_isStreaming) return;

    _queue.add(PendingDataRecord(
      id: "${DateTime.now().millisecondsSinceEpoch}_${_idCounter++}",
      reading: reading,
      createdAt: DateTime.now(),
    ));
    notifyListeners();

    // Auto-sync ke RMQ tiap 5 data (approx 5 detik)
    if (pendingCount >= 5) {
      _syncToRabbitMQ();
    }
  }

  Future<void> _syncToRabbitMQ() async {
    if (_isSyncing) return;
    final pendingRecords = _queue.where((r) => r.status == 'pending').toList();
    if (pendingRecords.isEmpty) return;

    _isSyncing = true;
    final readings = pendingRecords.map((r) => r.reading).toList();
    
    bool success = false;
    try {
      final bleService = ref.read(bleServiceProvider);
      final deviceName = bleService.isConnected ? bleService.deviceName : 'POLAR_H10';
      
      final prefs = await SharedPreferences.getInstance();
      final userId = prefs.getString('user_id') ?? 'P012';

      final mqtt = ref.read(mqttServiceProvider);
      
      // Kirim data langsung ke RabbitMQ (tanpa lewat logtransport API)
      success = await mqtt.publishSensorReadings(
        userId: userId,
        deviceId: deviceName,
        readings: readings,
      );
    } catch (e) {
      debugPrint('[TelemetryController] Gagal kirim ke RMQ: $e');
      success = false;
    } finally {
      _isSyncing = false;
    }

    if (success) {
      // Hapus yang berhasil terkirim
      _queue.removeWhere((r) => pendingRecords.any((p) => p.id == r.id));
    } else {
      // Tandai gagal
      for (final record in pendingRecords) {
        final idx = _queue.indexWhere((r) => r.id == record.id);
        if (idx != -1) {
          _queue[idx] = PendingDataRecord(
            id: record.id,
            reading: record.reading,
            status: 'failed',
            createdAt: record.createdAt,
          );
        }
      }
    }
    notifyListeners();
  }
  
  // Method untuk dipanggil jika butuh sinkronisasi paksa dari UI
  Future<void> forceFlush() async {
    await _syncToRabbitMQ();
  }
}

final telemetryControllerProvider = ChangeNotifierProvider<TelemetryController>((ref) {
  final controller = TelemetryController(ref);

  // Otomatis listen ke BleService secara global, agar data selalu di-buffer & dikirim
  ref.listen<AsyncValue<SensorReading>>(currentSensorReadingProvider, (_, next) {
    next.whenData((reading) {
      controller.addReading(reading);
    });
  });

  return controller;
});
