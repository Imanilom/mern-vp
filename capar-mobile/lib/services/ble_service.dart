import 'dart:async';
import 'dart:math' show sqrt, sin, Random;
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:polar/polar.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
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
  bool isConnecting = false;
  String connectingDeviceId = '';
  String deviceName = "Tidak Ada Perangkat";
  String _deviceId = '';
  String get deviceId => _deviceId;
  int batteryLevel = 0;
  int signalQuality = 0;
  String motionState = "Duduk Bekerja";

  // Buffered latest PMD samples — merge ke reading saat HR datang
  double _lastAccX = 0.0;
  double _lastAccY = 0.0;
  double _lastAccZ = 0.0;
  double _lastEcg  = 0.0;

  // Auto-Reconnect State
  bool isReconnecting = false;
  bool _isManualDisconnect = false;
  Timer? _autoReconnectTimer;
  String _savedDeviceId = '';

  // RR sliding window untuk RMSSD
  final List<int> _rrList = [];

  Stream<SensorReading> get readingStream => _readingController.stream;

  BleService() {
    _initPolarListeners();
    _restoreSavedDeviceAndAutoConnect();
  }

  void _restoreSavedDeviceAndAutoConnect() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedId = prefs.getString('device_id') ?? '';
      if (savedId.isNotEmpty) {
        _savedDeviceId = savedId;
        debugPrint('[Polar] Found saved device ID: $savedId');
      }
    } catch (e) {
      debugPrint('[Polar] Error loading saved device ID: $e');
    }
  }

  void _scheduleAutoReconnect(String targetDeviceId) {
    if (_isManualDisconnect || isConnected || _isDisposed || targetDeviceId.isEmpty) return;
    _autoReconnectTimer?.cancel();
    isReconnecting = true;
    if (!_isDisposed) notifyListeners();

    debugPrint('[Polar] 🔄 Auto-reconnect scheduled in 3 seconds for $targetDeviceId...');
    _autoReconnectTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
      if (isConnected || _isManualDisconnect || _isDisposed) {
        timer.cancel();
        isReconnecting = false;
        if (!_isDisposed) notifyListeners();
        return;
      }
      debugPrint('[Polar] 🔄 Retrying connection to $targetDeviceId...');
      connectToDevice(targetDeviceId);
    });
  }

  // ─── Init global listeners ───────────────────────────────────────────────────

  void _initPolarListeners() {
    // Device connecting event
    _polar.deviceConnecting.listen((info) {
      debugPrint('[Polar] Connecting to: ${info.deviceId}');
      isConnecting = true;
      connectingDeviceId = info.deviceId;
      if (!_isDisposed) notifyListeners();
    });

    // Device connected event
    _connectSub = _polar.deviceConnected.listen((info) {
      debugPrint('[Polar] Connected: ${info.deviceId} (${info.name})');
      deviceName = info.name.isNotEmpty ? info.name : 'Polar H10';
      _deviceId  = info.deviceId;
      _savedDeviceId = info.deviceId;
      _isManualDisconnect = false;
      isReconnecting = false;
      isConnecting = false;
      connectingDeviceId = '';
      _autoReconnectTimer?.cancel();
      SharedPreferences.getInstance().then((prefs) {
        prefs.setString('device_id', info.deviceId);
      });
      isConnected = true;
      batteryLevel = 95;
      signalQuality = 98;
      if (!_isDisposed) notifyListeners();
    });

    // Device disconnected event
    _disconnectSub = _polar.deviceDisconnected.listen((deviceId) {
      debugPrint('[Polar] Disconnected: $deviceId');
      isConnected = false;
      isConnecting = false;
      connectingDeviceId = '';
      _stopStreams();
      if (!_isDisposed) notifyListeners();

      if (!_isManualDisconnect && _savedDeviceId.isNotEmpty && !_isDisposed) {
        _scheduleAutoReconnect(_savedDeviceId);
      }
    });

    // SDK Feature ready — mulai streaming setelah online streaming ready
    _polar.sdkFeatureReady.listen((e) async {
      if (e.feature != PolarSdkFeature.onlineStreaming) return;
      debugPrint('[Polar] SDK Feature ready: ${e.identifier}');
      await _startPolarStreams(e.identifier);
    });
  }

  bool _isDisposed = false;

  // ─── Scan State ──────────────────────────────────────────────────────────────

  final List<PolarDeviceInfo> _discoveredDevices = [];
  List<PolarDeviceInfo> get discoveredDevices => List.unmodifiable(_discoveredDevices);
  StreamSubscription<PolarDeviceInfo>? _scanSub;
  bool isScanning = false;

  Stream<PolarDeviceInfo> get scanResults => _polar.searchForDevice();

  Future<void> startScan() async {
    try {
      if (Platform.isAndroid) {
        try {
          if (await FlutterBluePlus.adapterState.first != BluetoothAdapterState.on) {
            await FlutterBluePlus.turnOn();
          }
        } catch (_) {}
      }

      final statuses = await [
        Permission.bluetooth,
        Permission.bluetoothScan,
        Permission.bluetoothConnect,
        Permission.location,
      ].request();
      debugPrint('[Polar] Permissions requested: $statuses');

      _discoveredDevices.clear();
      isScanning = true;
      if (!_isDisposed) notifyListeners();

      await _scanSub?.cancel();
      debugPrint('[Polar] Starting device search...');

      _scanSub = _polar.searchForDevice().listen((device) {
        if (!_discoveredDevices.any((d) => d.deviceId == device.deviceId)) {
          _discoveredDevices.add(device);
          debugPrint('[Polar] Discovered: ${device.name} (${device.deviceId})');
          if (!_isDisposed) notifyListeners();
        }
      }, onError: (e) {
        debugPrint('[Polar] Scan error: $e');
        isScanning = false;
        if (!_isDisposed) notifyListeners();
      }, onDone: () {
        isScanning = false;
        if (!_isDisposed) notifyListeners();
      });
    } catch (e) {
      debugPrint('[Polar] startScan exception: $e');
      isScanning = false;
      if (!_isDisposed) notifyListeners();
    }
  }

  Future<void> stopScan() async {
    await _scanSub?.cancel();
    isScanning = false;
    if (!_isDisposed) notifyListeners();
  }

  // ─── Connect ─────────────────────────────────────────────────────────────────

  /// Connect to Polar device by deviceId (MAC address / device serial)
  Future<bool> connectToDevice(String rawDeviceId) async {
    try {
      final cleanId = rawDeviceId.trim().toUpperCase();
      if (cleanId.isEmpty) return false;

      if (Platform.isAndroid) {
        try {
          if (await FlutterBluePlus.adapterState.first != BluetoothAdapterState.on) {
            await FlutterBluePlus.turnOn();
          }
        } catch (_) {}
      }

      await [
        Permission.bluetooth,
        Permission.bluetoothScan,
        Permission.bluetoothConnect,
        Permission.location,
      ].request();

      _isManualDisconnect = false;
      _savedDeviceId = cleanId;
      isConnecting = true;
      connectingDeviceId = cleanId;
      if (!_isDisposed) notifyListeners();

      await stopScan();

      debugPrint('[Polar] Connecting to $cleanId ...');
      await _polar.connectToDevice(cleanId);
      return true;
    } catch (e) {
      debugPrint('[Polar] Connect error: $e');
      isConnecting = false;
      connectingDeviceId = '';
      if (!_isDisposed) notifyListeners();
      return false;
    }
  }

  // ─── Start Polar Streams ─────────────────────────────────────────────────────

  Future<void> _startPolarStreams(String identifier) async {
    try {
      final available = await _polar.getAvailableOnlineStreamDataTypes(identifier);
      debugPrint('[Polar] Available stream types: $available');

      // ── HR + RR (Critical Stream) ─────────────────────────────────────────────
      if (available.contains(PolarDataType.hr)) {
        _hrSub?.cancel();
        _hrSub = _polar.startHrStreaming(identifier).listen(_onHrData,
          onError: (e) => debugPrint('[Polar] HR stream error: $e'),
        );
        debugPrint('[Polar] HR streaming started');
      }

      // ── ECG (130Hz, µV) — Error isolated ──────────────────────────────────────
      if (available.contains(PolarDataType.ecg)) {
        _ecgSub?.cancel();
        _ecgSub = _polar.startEcgStreaming(identifier).listen(_onEcgData,
          onError: (e) => debugPrint('[Polar] ECG stream error isolated: $e'),
          cancelOnError: false,
        );
        debugPrint('[Polar] ECG streaming started (130Hz)');
      } else {
        debugPrint('[Polar] ECG not available on this device');
      }

      // ── ACC (50Hz, mG) — Error isolated ───────────────────────────────────────
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
          onError: (e) => debugPrint('[Polar] ACC stream error isolated: $e'),
          cancelOnError: false,
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

  Timer? _simulatedTimer;
  bool isSimulated = false;

  void enableSimulationMode() {
    _stopStreams();
    _simulatedTimer?.cancel();

    isSimulated = true;
    isConnected = true;
    deviceName = "Polar H10 (Emulator Simulation)";
    _deviceId = "EMULATOR-POLAR-H10";
    batteryLevel = 95;
    signalQuality = 98;

    SharedPreferences.getInstance().then((prefs) {
      prefs.setString('device_id', _deviceId);
    });

    const double hrBase = 72.0;
    int tickCount = 0;
    final random = Random();

    _simulatedTimer = Timer.periodic(const Duration(milliseconds: 1000), (timer) {
      tickCount++;
      // Sine wave oscillation for subtle natural heart rate variability & riak naik turun
      final hrDelta = (3.5 * sin(tickCount * 0.25)) + ((random.nextDouble() - 0.5) * 1.5);
      final currentHr = (hrBase + hrDelta).round().clamp(55, 130);
      final currentRr = (60000.0 / currentHr + ((random.nextDouble() - 0.5) * 20)).round();

      _rrList.add(currentRr);
      if (_rrList.length > 30) _rrList.removeAt(0);

      final rmssd = _calculateRmssd();
      final dfa = _estimateDfa();

      _lastAccX = (random.nextDouble() * 0.05).clamp(0.0, 0.1);
      _lastAccY = (random.nextDouble() * 0.05).clamp(0.0, 0.1);
      _lastAccZ = 0.98 + (random.nextDouble() * 0.04 - 0.02);
      _lastEcg = 0.05 + (sin(tickCount * 1.0) * 0.15);

      final reading = SensorReading(
        timestamp: DateTime.now(),
        heartRate: currentHr,
        rrInterval: currentRr,
        rmssd: double.parse(rmssd.toStringAsFixed(1)),
        dfaAlpha1: double.parse(dfa.toStringAsFixed(3)),
        signalQuality: signalQuality,
        battery: batteryLevel,
        motionState: motionState,
        accX: double.parse(_lastAccX.toStringAsFixed(4)),
        accY: double.parse(_lastAccY.toStringAsFixed(4)),
        accZ: double.parse(_lastAccZ.toStringAsFixed(4)),
        ecg: double.parse(_lastEcg.toStringAsFixed(4)),
        stepCount: tickCount * 2,
      );

      _readingController.add(reading);
    });

    if (!_isDisposed) notifyListeners();
  }

  void disableSimulationMode() {
    _simulatedTimer?.cancel();
    _simulatedTimer = null;
    isSimulated = false;
    disconnect();
  }

  void _stopStreams() {
    _simulatedTimer?.cancel();
    _simulatedTimer = null;
    _hrSub?.cancel();  _hrSub  = null;
    _ecgSub?.cancel(); _ecgSub = null;
    _accSub?.cancel(); _accSub = null;
    _lastAccX = 0.0; _lastAccY = 0.0; _lastAccZ = 0.0;
    _lastEcg  = 0.0;
  }

  Future<void> disconnect() async {
    _isManualDisconnect = true;
    _autoReconnectTimer?.cancel();
    isReconnecting = false;
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
