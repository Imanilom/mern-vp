import 'dart:async';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:permission_handler/permission_handler.dart';

class BleService {
  static BluetoothDevice? connectedDevice;
  static BluetoothCharacteristic? hrCharacteristic;
  static BluetoothCharacteristic? rrCharacteristic; // Standard Heart Rate Profile (0x2A37) contains both

  static Future<bool> requestPermissions() async {
    Map<Permission, PermissionStatus> statuses = await [
      Permission.bluetoothScan,
      Permission.bluetoothConnect,
      Permission.location,
    ].request();

    return statuses.values.every((status) => status.isGranted);
  }

  static Stream<List<ScanResult>> scanForPolar() {
    FlutterBluePlus.startScan(timeout: const Duration(seconds: 10));
    return FlutterBluePlus.scanResults.map((results) {
      return results.where((r) => r.device.platformName.toLowerCase().contains('polar')).toList();
    });
  }

  static void stopScan() {
    FlutterBluePlus.stopScan();
  }

  static Future<bool> connectToDevice(BluetoothDevice device) async {
    try {
      await device.connect(autoConnect: false);
      connectedDevice = device;

      // Discover services
      List<BluetoothService> services = await device.discoverServices();
      for (BluetoothService service in services) {
        // Heart Rate Service UUID
        if (service.uuid.toString().toUpperCase() == "0000180D-0000-1000-8000-00805F9B34FB") {
          for (BluetoothCharacteristic c in service.characteristics) {
            if (c.uuid.toString().toUpperCase() == "00002A37-0000-1000-8000-00805F9B34FB") {
              hrCharacteristic = c;
            }
          }
        }
      }

      if (hrCharacteristic != null) {
        return true;
      } else {
        await disconnect();
        return false;
      }
    } catch (e) {
      print("BLE Connection Error: $e");
      return false;
    }
  }

  static Future<void> disconnect() async {
    if (connectedDevice != null) {
      await connectedDevice!.disconnect();
      connectedDevice = null;
      hrCharacteristic = null;
    }
  }

  // Parse Heart Rate Measurement characteristic
  static Map<String, dynamic> parseHeartRateData(List<int> value) {
    if (value.isEmpty) return {};

    int flags = value[0];
    bool is16Bit = (flags & 0x01) != 0;
    bool hasRr = (flags & 0x10) != 0;

    int hrValue = 0;
    int index = 1;

    if (is16Bit) {
      if (value.length >= 3) {
        hrValue = value[1] | (value[2] << 8);
        index += 2;
      }
    } else {
      if (value.length >= 2) {
        hrValue = value[1];
        index += 1;
      }
    }

    // Skip Energy Expended if present
    bool hasEE = (flags & 0x08) != 0;
    if (hasEE) index += 2;

    List<int> rrIntervals = [];
    if (hasRr) {
      while (index + 1 < value.length) {
        int rrRaw = value[index] | (value[index + 1] << 8);
        // Resolution is 1/1024 second. Convert to ms.
        int rrMs = (rrRaw * 1000 / 1024).round();
        rrIntervals.add(rrMs);
        index += 2;
      }
    }

    return {
      'hr': hrValue,
      'rr': rrIntervals.isNotEmpty ? rrIntervals.last : 800, // Just take the last RR for simple representation, or send all.
      'rr_list': rrIntervals, // We will use this in the background task
    };
  }
}
