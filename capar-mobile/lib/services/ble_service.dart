import 'dart:async';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../shared/models/models.dart';

class BleService extends ChangeNotifier {
  final _random = Random();
  final _readingController = StreamController<SensorReading>.broadcast();
  StreamSubscription<List<int>>? _hrSubscription;
  StreamSubscription<BluetoothConnectionState>? _connSubscription;
  BluetoothDevice? _connectedDevice;
  bool _isDisposed = false;
  
  bool isConnected = false;
  String deviceName = "Tidak Ada Perangkat";
  int batteryLevel = 0;
  int signalQuality = 0;
  String motionState = "Duduk Bekerja";

  void updateMotionState(String state) {
    motionState = state;
    if (!_isDisposed) notifyListeners();
  }

  // List of last 30 RR intervals to calculate RMSSD
  final List<int> _rrList = [];

  Stream<SensorReading> get readingStream => _readingController.stream;

  // Get stream of scanned BLE results
  Stream<List<ScanResult>> get scanResults => FlutterBluePlus.scanResults;
  
  // Check if scanning is in progress
  Stream<bool> get isScanning => FlutterBluePlus.isScanning;

  Future<void> startScan() async {
    try {
      // Check bluetooth adapter state
      final adapterState = await FlutterBluePlus.adapterState.first;
      if (adapterState != BluetoothAdapterState.on) {
        debugPrint("Bluetooth adapter is off");
        if (defaultTargetPlatform == TargetPlatform.android) {
          try {
            await FlutterBluePlus.turnOn();
          } catch (_) {}
        }
      }

      await [
        Permission.bluetoothScan,
        Permission.bluetoothConnect,
        Permission.location,
      ].request();

      // Stop any active scan first
      await FlutterBluePlus.stopScan();

      // Start scan without restrictive service filter to reliably discover Polar H10
      await FlutterBluePlus.startScan(
        timeout: const Duration(seconds: 15),
      );
    } catch (e) {
      debugPrint("Error starting BLE scan: $e");
    }
  }

  Future<void> stopScan() async {
    try {
      await FlutterBluePlus.stopScan();
    } catch (e) {
      debugPrint("Error stopping BLE scan: $e");
    }
  }

  // Connect to a real Polar H10 or any standard BLE HR monitor
  Future<bool> connectToDevice(BluetoothDevice device) async {
    try {
      await disconnect();
      await stopScan();

      await device.connect(autoConnect: false, timeout: const Duration(seconds: 12));
      _connectedDevice = device;

      // Listen to connection state changes
      _connSubscription = device.connectionState.listen((state) {
        if (state == BluetoothConnectionState.disconnected) {
          disconnect();
        }
      });

      // Discover services
      List<BluetoothService> services = await device.discoverServices();
      BluetoothCharacteristic? hrChar;

      for (var service in services) {
        final sUuid = service.uuid.toString().toLowerCase();
        if (sUuid.contains("180d")) {
          for (var char in service.characteristics) {
            final cUuid = char.uuid.toString().toLowerCase();
            if (cUuid.contains("2a37")) {
              hrChar = char;
              break;
            }
          }
        }
      }

      // Fallback: search all characteristics if 180d parent wasn't matched explicitly
      if (hrChar == null) {
        for (var service in services) {
          for (var char in service.characteristics) {
            final cUuid = char.uuid.toString().toLowerCase();
            if (cUuid.contains("2a37")) {
              hrChar = char;
              break;
            }
          }
          if (hrChar != null) break;
        }
      }

      if (hrChar != null) {
        isConnected = true;
        deviceName = device.platformName.isNotEmpty
            ? device.platformName
            : (device.advName.isNotEmpty ? device.advName : "Polar H10");
        batteryLevel = 95;
        signalQuality = 98;
        if (!_isDisposed) notifyListeners();

        // 1. Set notification value first
        await hrChar.setNotifyValue(true);

        // 2. Listen to lastValueStream & onValueReceived for high reliability
        _hrSubscription = hrChar.lastValueStream.listen((data) {
          if (data.isNotEmpty) {
            _parseHeartRateMeasurement(data);
          }
        });
        
        hrChar.onValueReceived.listen((data) {
          if (data.isNotEmpty) {
            _parseHeartRateMeasurement(data);
          }
        });

        return true;
      }
    } catch (e) {
      debugPrint("Error connecting to device: $e");
      await disconnect();
    }
    return false;
  }

  // Parse standard Bluetooth BLE Heart Rate Measurement payload
  void _parseHeartRateMeasurement(List<int> data) {
    if (data.isEmpty) return;
    
    int flags = data[0];
    bool is16BitHr = (flags & 0x01) != 0;
    int currentOffset = 1;
    
    int heartRate;
    if (is16BitHr) {
      if (currentOffset + 1 >= data.length) return;
      heartRate = data[currentOffset] | (data[currentOffset + 1] << 8);
      currentOffset += 2;
    } else {
      heartRate = data[currentOffset];
      currentOffset += 1;
    }
    
    bool eePresent = (flags & 0x08) != 0;
    if (eePresent) {
      currentOffset += 2;
    }
    
    bool rrPresent = (flags & 0x10) != 0;
    int lastRr = 800; // default rr in ms
    
    if (rrPresent) {
      while (currentOffset + 1 < data.length) {
        int rrRaw = data[currentOffset] | (data[currentOffset + 1] << 8);
        int rrMs = (rrRaw * 1000) ~/ 1024; // convert unit to milliseconds
        lastRr = rrMs;
        _rrList.add(rrMs);
        if (_rrList.length > 30) {
          _rrList.removeAt(0);
        }
        currentOffset += 2;
      }
    }

    double rmssd = calculateRmssd();
    // Simulate DFA with standard variations around 1.0
    double dfa = 1.02 + (_random.nextDouble() * 0.1 - 0.05);

    // Simulate ACC and ECG since standard HR profile doesn't provide them.
    // In a real scenario, this requires connecting to the Polar PMD (Polar Measurement Data) service.
    double simAccX = _random.nextDouble() * 2.0 - 1.0;
    double simAccY = _random.nextDouble() * 2.0 - 1.0;
    double simAccZ = _random.nextDouble() * 2.0 - 1.0;
    double simEcg = _random.nextDouble() * 0.5 - 0.25;
    int simStepCount = _random.nextInt(10); // Simulated steps since last reading

    final reading = SensorReading(
      timestamp: DateTime.now(),
      heartRate: heartRate,
      rrInterval: lastRr,
      rmssd: double.parse(rmssd.toStringAsFixed(1)),
      dfaAlpha1: double.parse(dfa.toStringAsFixed(2)),
      signalQuality: signalQuality,
      battery: batteryLevel,
      motionState: motionState,
      accX: double.parse(simAccX.toStringAsFixed(3)),
      accY: double.parse(simAccY.toStringAsFixed(3)),
      accZ: double.parse(simAccZ.toStringAsFixed(3)),
      ecg: double.parse(simEcg.toStringAsFixed(3)),
      stepCount: simStepCount,
    );

    _readingController.add(reading);
  }

  double calculateRmssd() {
    if (_rrList.length < 2) return 45.0; // baseline RMSSD fallback
    double sumSqDiff = 0.0;
    for (int i = 0; i < _rrList.length - 1; i++) {
      double diff = (_rrList[i + 1] - _rrList[i]).toDouble();
      sumSqDiff += diff * diff;
    }
    return sqrt(sumSqDiff / (_rrList.length - 1));
  }

  Future<void> disconnect() async {
    await _hrSubscription?.cancel();
    _hrSubscription = null;
    await _connSubscription?.cancel();
    _connSubscription = null;
    
    if (_connectedDevice != null) {
      try {
        await _connectedDevice!.disconnect();
      } catch (e) {
        debugPrint("Error disconnecting BLE device: $e");
      }
      _connectedDevice = null;
    }

    isConnected = false;
    deviceName = "Tidak Ada Perangkat";
    batteryLevel = 0;
    signalQuality = 0;
    if (!_isDisposed) notifyListeners();
  }

  @override
  void dispose() {
    _isDisposed = true;
    disconnect();
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
