import 'dart:async';
import 'dart:math' show sqrt;
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:polar/polar.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../shared/models/models.dart';

/// BleService — menggunakan Official Polar BLE SDK (package: polar)
///
/// Alur data Polar H10:
///   HR + RR (1Hz via HRS)  ──┐
///   ECG (130Hz via PMD)    ──┼──► BleService ──► readingStream ──► TelemetryController
///   ACC (50Hz via PMD)     ──┘
class BleService extends ChangeNotifier {
  final _polar = Polar();
  final _readingController = StreamController<SensorReading>.broadcast();

  // Subscriptions
  StreamSubscription<PolarHrData>? _hrSub;
  StreamSubscription<PolarEcgData>? _ecgSub;
  StreamSubscription<PolarAccData>? _accSub;
  StreamSubscription<PolarDeviceInfo>? _connectSub;
  StreamSubscription<PolarDeviceDisconnectedEvent>? _disconnectSub;

  bool isConnected = false;
  String deviceName = "Tidak Ada Perangkat";
  String _deviceId = '';
  int batteryLevel = 0;
  int signalQuality = 0;
  String motionState = "Duduk Bekerja";

  // Buffered latest PMD samples — merge ke reading saat HR datang
  double _lastAccX = 0.0;
  double _lastAccY = 0.0;
  double _lastAccZ = 0.0;
  double _lastEcg  = 0.0;

  // RR sliding window untuk RMSSD
  final List<int> _rrList = [];

  Stream<SensorReading> get readingStream => _readingController.stream;

  BleService() {
    _initPolarListeners();
  }

  // ─── Init global listeners ───────────────────────────────────────────────────

  void _initPolarListeners() {
    // Device connected event
    _connectSub = _polar.deviceConnected.listen((info) {
      debugPrint('[Polar] Connected: ${info.deviceId} (${info.name})');
      deviceName = info.name.isNotEmpty ? info.name : 'Polar H10';
      _deviceId  = info.deviceId;
      isConnected = true;
      batteryLevel = 95;
      signalQuality = 98;
      if (!_isDisposed) notifyListeners();
    });

    // Device disconnected event
    _disconnectSub = _polar.deviceDisconnected.listen((deviceId) {
      debugPrint('[Polar] Disconnected: $deviceId');
      isConnected = false;
      _deviceId = '';
      _stopStreams();
      if (!_isDisposed) notifyListeners();
    });

    // SDK Feature ready — mulai streaming setelah online streaming ready
    _polar.sdkFeatureReady.listen((e) async {
      if (e.feature != PolarSdkFeature.onlineStreaming) return;
      debugPrint('[Polar] SDK Feature ready: ${e.identifier}');
      await _startPolarStreams(e.identifier);
    });
  }

  bool _isDisposed = false;

  // ─── Scan ────────────────────────────────────────────────────────────────────

  Stream<PolarDeviceInfo> get scanResults => _polar.searchForDevice();

  Future<void> startScan() async {
    await [
      Permission.bluetoothScan,
      Permission.bluetoothConnect,
      Permission.location,
    ].request();
    debugPrint('[Polar] Starting device search...');
  }

  Future<void> stopScan() async {}

  // ─── Connect ─────────────────────────────────────────────────────────────────

  /// Connect to Polar device by deviceId (MAC address / device serial)
  Future<bool> connectToDevice(String deviceId) async {
    try {
      debugPrint('[Polar] Connecting to $deviceId ...');
      _polar.connectToDevice(deviceId);
      // Connection result via _connectSub listener
      return true;
    } catch (e) {
      debugPrint('[Polar] Connect error: $e');
      return false;
    }
  }

  // ─── Start Polar Streams ─────────────────────────────────────────────────────

  Future<void> _startPolarStreams(String identifier) async {
    try {
      final available = await _polar.getAvailableOnlineStreamDataTypes(identifier);
      debugPrint('[Polar] Available stream types: $available');

      // ── HR + RR ──────────────────────────────────────────────────────────────
      if (available.contains(PolarDataType.hr)) {
        _hrSub?.cancel();
        _hrSub = _polar.startHrStreaming(identifier).listen(_onHrData,
          onError: (e) => debugPrint('[Polar] HR stream error: $e'),
        );
        debugPrint('[Polar] HR streaming started');
      }

      // ── ECG (130Hz, µV) ──────────────────────────────────────────────────────
      if (available.contains(PolarDataType.ecg)) {
        _ecgSub?.cancel();
        _ecgSub = _polar.startEcgStreaming(identifier).listen(_onEcgData,
          onError: (e) => debugPrint('[Polar] ECG stream error: $e'),
        );
        debugPrint('[Polar] ECG streaming started (130Hz)');
      } else {
        debugPrint('[Polar] ECG not available on this device');
      }

      // ── ACC (50Hz, mG) ───────────────────────────────────────────────────────
      if (available.contains(PolarDataType.acc)) {
        _accSub?.cancel();
        _accSub = _polar.startAccStreaming(
          identifier,
          settings: PolarSensorSetting({
            PolarSettingType.sampleRate: 50,
            PolarSettingType.range: 8,
            PolarSettingType.resolution: 16,
          }),
        ).listen(_onAccData,
          onError: (e) => debugPrint('[Polar] ACC stream error: $e'),
        );
        debugPrint('[Polar] ACC streaming started (50Hz, ±8G)');
      } else {
        debugPrint('[Polar] ACC not available on this device');
      }
    } catch (e) {
      debugPrint('[Polar] Error starting streams: $e');
    }
  }

  // ─── Data Handlers ───────────────────────────────────────────────────────────

  void _onHrData(PolarHrData data) {
    for (final sample in data.samples) {
      final heartRate = sample.hr;

      // Ambil semua RR interval dari sample ini
      int lastRr = 800;
      for (final rr in sample.rrsMs) {
        lastRr = rr;
        _rrList.add(rr);
        if (_rrList.length > 30) _rrList.removeAt(0);
      }

      final rmssd = _calculateRmssd();
      final dfa   = _estimateDfa();

      final reading = SensorReading(
        timestamp:    DateTime.now(),
        heartRate:    heartRate,
        rrInterval:   lastRr,
        rmssd:        double.parse(rmssd.toStringAsFixed(1)),
        dfaAlpha1:    double.parse(dfa.toStringAsFixed(3)),
        signalQuality: signalQuality,
        battery:      batteryLevel,
        motionState:  motionState,
        // Real sensor data dari PMD (sudah diisi oleh _onAccData/_onEcgData)
        accX: double.parse(_lastAccX.toStringAsFixed(4)),
        accY: double.parse(_lastAccY.toStringAsFixed(4)),
        accZ: double.parse(_lastAccZ.toStringAsFixed(4)),
        ecg:  double.parse(_lastEcg.toStringAsFixed(4)),
        stepCount: 0,
      );

      _readingController.add(reading);
    }
  }

  void _onAccData(PolarAccData data) {
    if (data.samples.isEmpty) return;
    // Ambil sample terakhir, convert dari mG ke G
    final s = data.samples.last;
    _lastAccX = s.x / 1000.0;
    _lastAccY = s.y / 1000.0;
    _lastAccZ = s.z / 1000.0;
  }

  void _onEcgData(PolarEcgData data) {
    if (data.samples.isEmpty) return;
    // Ambil sample terakhir, unit µV → mV
    _lastEcg = data.samples.last.voltage / 1000.0;
  }

  // ─── RMSSD & DFA ─────────────────────────────────────────────────────────────

  double _calculateRmssd() {
    if (_rrList.length < 2) return 45.0;
    double sumSqDiff = 0.0;
    for (int i = 0; i < _rrList.length - 1; i++) {
      final diff = (_rrList[i + 1] - _rrList[i]).toDouble();
      sumSqDiff += diff * diff;
    }
    return sqrt(sumSqDiff / (_rrList.length - 1));
  }

  double _estimateDfa() {
    if (_rrList.length < 8) return 1.0;
    final mean = _rrList.reduce((a, b) => a + b) / _rrList.length;
    double variance = 0.0;
    for (final rr in _rrList) {
      variance += (rr - mean) * (rr - mean);
    }
    variance /= _rrList.length;
    final cv = variance > 0 ? sqrt(variance) / mean : 0.0;
    return (1.0 - cv * 2.0).clamp(0.5, 1.5);
  }

  // ─── Disconnect ───────────────────────────────────────────────────────────────

  void _stopStreams() {
    _hrSub?.cancel();  _hrSub  = null;
    _ecgSub?.cancel(); _ecgSub = null;
    _accSub?.cancel(); _accSub = null;
    _lastAccX = 0.0; _lastAccY = 0.0; _lastAccZ = 0.0;
    _lastEcg  = 0.0;
  }

  Future<void> disconnect() async {
    if (_deviceId.isNotEmpty) {
      try { _polar.disconnectFromDevice(_deviceId); } catch (_) {}
    }
    _stopStreams();
    isConnected = false;
    _deviceId = '';
    deviceName = "Tidak Ada Perangkat";
    batteryLevel = 0;
    signalQuality = 0;
    if (!_isDisposed) notifyListeners();
  }

  void updateMotionState(String state) {
    motionState = state;
    if (!_isDisposed) notifyListeners();
  }

  @override
  void dispose() {
    _isDisposed = true;
    _connectSub?.cancel();
    _disconnectSub?.cancel();
    _stopStreams();
    _readingController.close();
    super.dispose();
  }
}

final bleServiceProvider = ChangeNotifierProvider<BleService>((ref) {
  return BleService();
});

final currentSensorReadingProvider = StreamProvider<SensorReading>((ref) {
  final bleService = ref.watch(bleServiceProvider);
  return bleService.readingStream;
});
