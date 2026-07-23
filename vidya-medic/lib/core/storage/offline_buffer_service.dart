import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/models.dart';
import '../network/api_client.dart';

import '../ble/mock_ble_service.dart';
import '../providers/activity_provider.dart';

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

class OfflineBufferService extends ChangeNotifier {
  final Ref? _ref;
  final List<PendingDataRecord> _queue = [];
  int _idCounter = 0;

  OfflineBufferService([this._ref]);

  List<PendingDataRecord> get pendingQueue => List.unmodifiable(_queue);

  int get pendingCount => _queue.where((r) => r.status == 'pending').length;

  void addReading(SensorReading reading) {
    _queue.add(PendingDataRecord(
      id: "${DateTime.now().millisecondsSinceEpoch}_${_idCounter++}",
      reading: reading,
      createdAt: DateTime.now(),
    ));
    notifyListeners();
    
    // Auto-sync when 5 readings (5 seconds of data) are accumulated, ensuring near real-time streaming
    if (pendingCount >= 5) {
      syncPendingData();
    }
  }

  Future<void> syncPendingData() async {
    final pendingRecords = _queue.where((r) => r.status == 'pending').toList();
    if (pendingRecords.isEmpty) return;

    final readings = pendingRecords.map((r) => r.reading).toList();
    
    bool success = true;
    final ref = _ref;
    if (ref != null) {
      // Call the actual ApiClient upload method!
      success = await ref.read(apiClientProvider).uploadSensorLogs(readings);
    } else {
      // Simulation fallback for tests
      await Future.delayed(const Duration(milliseconds: 100));
    }

    if (success) {
      // Mark all synced records as 'sent'
      for (final record in pendingRecords) {
        final idx = _queue.indexWhere((r) => r.id == record.id);
        if (idx != -1) {
          _queue[idx] = PendingDataRecord(
            id: record.id,
            reading: record.reading,
            status: 'sent',
            createdAt: record.createdAt,
          );
        }
      }
    } else {
      // Mark all synced records as 'failed'
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

    // Remove successfully sent items
    _queue.removeWhere((r) => r.status == 'sent');
    notifyListeners();
  }
}

final offlineBufferProvider = ChangeNotifierProvider<OfflineBufferService>((ref) {
  final service = OfflineBufferService(ref);
  
  // Listen to currentSensorReadingProvider globally so that data is buffered
  // even if the user navigates away from the monitoring page
  ref.listen<AsyncValue<SensorReading>>(currentSensorReadingProvider, (_, next) {
    next.whenData((reading) {
      final isMonitoringActive = ref.read(isMonitoringActiveProvider);
      if (isMonitoringActive) {
        service.addReading(reading);
      }
    });
  });

  return service;
});
