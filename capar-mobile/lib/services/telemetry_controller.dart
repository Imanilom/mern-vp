import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../shared/models/models.dart';
import 'mqtt_service.dart';
import 'ble_service.dart';

class PendingDataRecord {
  final String id;
  final SensorReading reading;
  final String status; // 'pending' | 'sent' | 'failed'
  final DateTime createdAt;

  PendingDataRecord({
    required this.id,
    required this.reading,
    this.status = 'pending',
    required this.createdAt,
  });

  PendingDataRecord copyWith({String? status}) => PendingDataRecord(
    id: id,
    reading: reading,
    status: status ?? this.status,
    createdAt: createdAt,
  );
}

class TelemetryController extends ChangeNotifier {
  final Ref ref;
  final List<PendingDataRecord> _queue = [];
  int _idCounter = 0;
  bool _isSyncing = false;
  bool _isStreaming = true;

  /// Auto-flush timer — kirim data setiap 10 detik meskipun buffer < 5
  Timer? _flushTimer;

  TelemetryController(this.ref) {
    _startFlushTimer();
  }

  List<PendingDataRecord> get pendingQueue => List.unmodifiable(_queue);
  int get pendingCount => _queue.where((r) => r.status == 'pending').length;
  bool get isStreaming => _isStreaming;

  // ─── Streaming Control ───────────────────────────────────────────────────────

  void startStreaming() {
    _isStreaming = true;
    _startFlushTimer();
    notifyListeners();
  }

  void stopStreaming() {
    _isStreaming = false;
    _flushTimer?.cancel();
    _flushTimer = null;
    _queue.clear();
    notifyListeners();
  }

  // ─── Auto-flush Timer ────────────────────────────────────────────────────────

  void _startFlushTimer() {
    _flushTimer?.cancel();
    // Kirim data setiap 10 detik, terlepas dari jumlah pending
    _flushTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (_isStreaming && pendingCount > 0) {
        _syncToRabbitMQ();
      }
    });
  }

  // ─── Add Reading ─────────────────────────────────────────────────────────────

  void addReading(SensorReading reading) {
    if (!_isStreaming) return;

    _queue.add(PendingDataRecord(
      id: '${DateTime.now().millisecondsSinceEpoch}_${_idCounter++}',
      reading: reading,
      createdAt: DateTime.now(),
    ));
    notifyListeners();

    // Batch flush saat buffer penuh (≥5 readings ≈ setiap ~5 detik)
    if (pendingCount >= 5) {
      _syncToRabbitMQ();
    }
  }

  // ─── Sync ke RabbitMQ ────────────────────────────────────────────────────────

  Future<void> _syncToRabbitMQ() async {
    if (_isSyncing) return;

    final pendingRecords = _queue.where((r) => r.status == 'pending').toList();
    if (pendingRecords.isEmpty) return;

    _isSyncing = true;

    try {
      final bleService = ref.read(bleServiceProvider);
      final deviceId = bleService.isConnected ? bleService.deviceName : 'POLAR_H10';

      final prefs = await SharedPreferences.getInstance();
      final userId = prefs.getString('user_id') ?? '';

      if (userId.isEmpty) {
        debugPrint('[TelemetryController] userId tidak ditemukan di SharedPreferences, skip sync');
        _isSyncing = false;
        return;
      }

      final mqtt = ref.read(mqttServiceProvider);

      // Pastikan MQTT connect dengan userId yang benar
      if (!mqtt.isConnected) {
        debugPrint('[TelemetryController] MQTT tidak connected, mencoba connect...');
        final ok = await mqtt.connect(userId);
        if (!ok) {
          debugPrint('[TelemetryController] MQTT connect gagal, tandai sebagai failed');
          _markAsFailed(pendingRecords);
          _isSyncing = false;
          notifyListeners();
          return;
        }
      }

      final readings = pendingRecords.map((r) => r.reading).toList();
      final success = await mqtt.publishSensorReadings(
        userId: userId,
        deviceId: deviceId,
        readings: readings,
      );

      if (success) {
        // Hapus yang sudah terkirim dari queue
        _queue.removeWhere((r) => pendingRecords.any((p) => p.id == r.id));
        debugPrint('[TelemetryController] ✓ ${readings.length} readings terkirim ke RMQ');
      } else {
        _markAsFailed(pendingRecords);
        debugPrint('[TelemetryController] ✗ Gagal kirim ke RMQ');
      }
    } catch (e) {
      debugPrint('[TelemetryController] Exception sync: $e');
      _markAsFailed(
        _queue.where((r) => r.status == 'pending').toList(),
      );
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  void _markAsFailed(List<PendingDataRecord> records) {
    for (final record in records) {
      final idx = _queue.indexWhere((r) => r.id == record.id);
      if (idx != -1) {
        _queue[idx] = record.copyWith(status: 'failed');
      }
    }
  }

  /// Dipanggil dari UI untuk paksa flush segera
  Future<void> forceFlush() async {
    await _syncToRabbitMQ();
  }

  /// Retry semua yang failed
  void retryFailed() {
    for (int i = 0; i < _queue.length; i++) {
      if (_queue[i].status == 'failed') {
        _queue[i] = _queue[i].copyWith(status: 'pending');
      }
    }
    notifyListeners();
    _syncToRabbitMQ();
  }

  @override
  void dispose() {
    _flushTimer?.cancel();
    super.dispose();
  }
}

final telemetryControllerProvider =
    ChangeNotifierProvider<TelemetryController>((ref) {
  final controller = TelemetryController(ref);

  // Listen ke BLE stream secara global agar data selalu di-buffer
  ref.listen<AsyncValue<SensorReading>>(
    currentSensorReadingProvider,
    (_, next) {
      next.whenData((reading) => controller.addReading(reading));
    },
  );

  return controller;
});
