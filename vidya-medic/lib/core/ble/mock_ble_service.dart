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
      if (await Permission.bluetoothScan.request().isGranted &&
          await Permission.bluetoothConnect.request().isGranted &&
          await Permission.location.request().isGranted) {
        
        await FlutterBluePlus.startScan(
          withServices: [Guid("180d")], // Standard Heart Rate Service UUID
          timeout: const Duration(seconds: 15),
        );
      } else {
        debugPrint("Bluetooth permissions denied");
      }
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
      
      await device.connect(autoConnect: false);
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
        if (service.uuid.toString().toLowerCase() == "180d") {
          for (var char in service.characteristics) {
            if (char.uuid.toString().toLowerCase() == "2a37") {
              hrChar = char;
              break;
            }
          }
        }
      }

      if (hrChar != null) {
        isConnected = true;
        deviceName = device.platformName.isNotEmpty ? device.platformName : "Polar H10";
        batteryLevel = 92; 
        signalQuality = 98;
        if (!_isDisposed) notifyListeners();

        // Enable notifications/indications on characteristic
        await hrChar.setNotifyValue(true);
        _hrSubscription = hrChar.lastValueStream.listen((data) {
          _parseHeartRateMeasurement(data);
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

    final reading = SensorReading(
      timestamp: DateTime.now(),
      heartRate: heartRate,
      rrInterval: lastRr,
      rmssd: double.parse(rmssd.toStringAsFixed(1)),
      dfaAlpha1: double.parse(dfa.toStringAsFixed(2)),
      signalQuality: signalQuality,
      battery: batteryLevel,
      motionState: motionState,
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
