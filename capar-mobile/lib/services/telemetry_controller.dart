import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../shared/models/models.dart';
import 'api_service.dart';
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
  bool _isStreaming = false; // false sampai startStreaming() dipanggil dari pairing

  /// Auto-flush timer — kirim data setiap 10 detik meskipun buffer < 5
  Timer? _flushTimer;

  TelemetryController(this.ref);
  // FIXED: tidak panggil _startFlushTimer() dari constructor, tunggu startStreaming()

  List<PendingDataRecord> get pendingQueue => List.unmodifiable(_queue);
  int get pendingCount => _queue.where((r) => r.status == 'pending').length;
  bool get isStreaming => _isStreaming;

  // ─── Streaming Control ───────────────────────────────────────────────────────

  void startStreaming() {
    _isStreaming = true;
    _startFlushTimer();
    debugPrint('[TelemetryController] Streaming dimulai melalui API terautentikasi');
    notifyListeners();
  }

  void stopStreaming() {
    _isStreaming = false;
    _flushTimer?.cancel();
    _flushTimer = null;
    // FIXED: TIDAK clear queue agar data pending tidak hilang saat stream berhenti sementara
    debugPrint('[TelemetryController] ⏹ Streaming dihentikan. Queue dipertahankan: ${_queue.length} items');
    notifyListeners();
  }

  // ─── Auto-flush Timer ────────────────────────────────────────────────────────

  void _startFlushTimer() {
    _flushTimer?.cancel();
    // Kirim data setiap 10 detik, terlepas dari jumlah pending
    _flushTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (_isStreaming && pendingCount > 0) {
        debugPrint('[TelemetryController] Auto-flush: $pendingCount readings pending');
        _syncToApi();
      }
    });
    debugPrint('[TelemetryController] ⏰ Auto-flush timer dimulai (interval 10s)');
  }

  // ─── Add Reading ─────────────────────────────────────────────────────────────

  void addReading(SensorReading reading) {
    if (!_isStreaming) {
      debugPrint('[TelemetryController] ⚠ addReading dipanggil tapi isStreaming=false, skip');
      return;
    }

    _queue.add(PendingDataRecord(
      id: '${DateTime.now().millisecondsSinceEpoch}_${_idCounter++}',
      reading: reading,
      createdAt: DateTime.now(),
    ));
    debugPrint('[TelemetryController] ➕ Reading HR=${reading.heartRate} RR=${reading.rrInterval} | queue pending: $pendingCount');
    notifyListeners();

    // Batch flush saat buffer penuh (≥5 readings ≈ setiap ~5 detik)
    if (pendingCount >= 5) {
      debugPrint('[TelemetryController] Buffer penuh ($pendingCount), trigger flush');
      _syncToApi();
    }
  }

  // ─── Authenticated API upload ────────────────────────────────────────────────

  Future<void> _syncToApi() async {
    if (_isSyncing) {
      debugPrint('[TelemetryController] 🔄 Sync sudah berjalan, skip');
      return;
    }

    final pendingRecords = _queue.where((r) => r.status == 'pending').toList();
    if (pendingRecords.isEmpty) return;

    _isSyncing = true;
    debugPrint('[TelemetryController] Mengirim ${pendingRecords.length} readings ke API...');

    try {
      final bleService = ref.read(bleServiceProvider);
      final prefs = await SharedPreferences.getInstance();
      final savedDeviceId = prefs.getString('device_id') ?? '';
      final deviceId = bleService.isConnected && bleService.deviceId.isNotEmpty
          ? bleService.deviceId
          : savedDeviceId;

      if (bleService.isSimulated) {
        debugPrint('[TelemetryController] Data simulasi tidak akan dikirim ke CAPAR.');
        _markAsFailed(pendingRecords);
        return;
      }
      if (deviceId.isEmpty || !await ApiService.hasAuthenticatedSession()) {
        debugPrint('[TelemetryController] Device ID atau sesi login tidak tersedia.');
        _markAsFailed(pendingRecords);
        return;
      }

      final validRecords = pendingRecords.where((record) {
        final reading = record.reading;
        return reading.sensorContact
            && reading.hasRrInterval
            && reading.hasAccelerationData
            && reading.heartRate >= 20
            && reading.heartRate <= 250
            && reading.rrInterval >= 300
            && reading.rrInterval <= 2000
            && reading.accX >= -16
            && reading.accX <= 16
            && reading.accY >= -16
            && reading.accY <= 16
            && reading.accZ >= -16
            && reading.accZ <= 16;
      }).toList();
      final invalidRecords = pendingRecords
          .where((record) => !validRecords.contains(record))
          .toList();
      if (invalidRecords.isNotEmpty) {
        _markAsFailed(invalidRecords);
      }
      if (validRecords.isEmpty) {
        debugPrint('[TelemetryController] Tidak ada reading dengan kontak dan sensor lengkap.');
        return;
      }

      final byActivity = <String, List<PendingDataRecord>>{};
      for (final record in validRecords) {
        final activity = _mapActivity(record.reading.motionState);
        byActivity.putIfAbsent(activity, () => []).add(record);
      }
      for (final entry in byActivity.entries) {
        for (var offset = 0; offset < entry.value.length; offset += 100) {
          final batch = entry.value.skip(offset).take(100).toList();
          final readings = batch.map((record) {
            final reading = record.reading;
            return <String, dynamic>{
              'recorded_at': reading.timestamp.toUtc().toIso8601String(),
              'heart_rate_bpm': reading.heartRate,
              'rr_interval_ms': reading.rrInterval,
              'acceleration_g': [reading.accX, reading.accY, reading.accZ],
              'sensor_contact': reading.sensorContact,
              'signal_confidence': 1.0,
            };
          }).toList();
          final success = await ApiService.sendSensorData(
            deviceId: deviceId,
            activity: entry.key,
            readings: readings,
          );
          if (success) {
            _queue.removeWhere((record) => batch.contains(record));
            debugPrint(
              '[TelemetryController] ${readings.length} readings diterima API.',
            );
          } else {
            _markAsFailed(batch);
            debugPrint(
              '[TelemetryController] API menolak batch; reading ditandai gagal.',
            );
          }
        }
      }
    } catch (e, stackTrace) {
      debugPrint('[TelemetryController] API upload exception: $e');
      debugPrint('[TelemetryController] StackTrace: $stackTrace');
      _markAsFailed(
        _queue.where((record) => record.status == 'pending').toList(),
      );
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  String _mapActivity(String value) {
    final activity = value.toLowerCase();
    if (activity.contains('tidur')) return 'sleep';
    if (activity.contains('lari')) return 'running';
    if (activity.contains('jalan')) return 'walking';
    if (activity.contains('olahraga') ||
        activity.contains('senam') ||
        activity.contains('yoga') ||
        activity.contains('sepeda') ||
        activity.contains('renang')) {
      return 'exercise';
    }
    if (activity.contains('berdiri')) return 'standing';
    if (activity.contains('duduk')) return 'sitting';
    if (activity.contains('istirahat') || activity.contains('berbaring')) {
      return 'rest';
    }
    return 'other';
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
    await _syncToApi();
  }

  /// Retry semua yang failed
  void retryFailed() {
    for (int i = 0; i < _queue.length; i++) {
      if (_queue[i].status == 'failed') {
        _queue[i] = _queue[i].copyWith(status: 'pending');
      }
    }
    notifyListeners();
    _syncToApi();
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
