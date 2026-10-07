// ============================================================================
// CONTOH IMPLEMENTASI BLE SERVICE DI VIDYAMEDIC
// ============================================================================

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/ble_service.dart';
import '../models/sensor_reading.dart';

/// OPSI 1: Menggunakan BleService sebagai replacement untuk wearable_pairing_service
/// 
/// Update di app_state.dart:
/// ```dart
/// import '../services/ble_service.dart';
/// 
/// class AppState extends ChangeNotifier {
///   late BleService bleService;
///   
///   Future<void> initialize() async {
///     // ... existing init code ...
///     bleService = BleService();
///     addListener(() {
///       notifyListeners();
///     });
///   }
/// }
/// ```

/// OPSI 2: Screen example untuk menggunakan BleService
class DevicePairingWithBleService extends StatefulWidget {
  const DevicePairingWithBleService({super.key});

  @override
  State<DevicePairingWithBleService> createState() =>
      _DevicePairingWithBleServiceState();
}

class _DevicePairingWithBleServiceState
    extends State<DevicePairingWithBleService> {
  late BleService _bleService;

  @override
  void initState() {
    super.initState();
    _bleService = BleService();

    // Listen ke sensor readings
    _bleService.readingStream.listen((SensorReading reading) {
      debugPrint('📊 HR: ${reading.heartRate} BPM, RR: ${reading.rrInterval} ms');
      debugPrint('📈 RMSSD: ${reading.rmssd}, DFA: ${reading.dfaAlpha1}');
    });
  }

  @override
  void dispose() {
    _bleService.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Polar Device Pairing')),
      body: Column(
        children: [
          // ─── Scan Section ───────────────────────────────────────────────
          if (!_bleService.isConnected)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ElevatedButton(
                    onPressed: _bleService.isScanning
                        ? null
                        : () => _bleService.startScan(),
                    child: Text(_bleService.isScanning
                        ? 'Scanning...'
                        : 'Start Scan'),
                  ),
                  if (_bleService.isScanning)
                    const Padding(
                      padding: EdgeInsets.only(top: 16),
                      child: CircularProgressIndicator(),
                    ),
                ],
              ),
            ),

          // ─── Device List ────────────────────────────────────────────────
          if (_bleService.isScanning)
            Expanded(
              child: ListenableBuilder(
                listenable: _bleService,
                builder: (context, _) => ListView.builder(
                  itemCount: _bleService.discoveredDevices.length,
                  itemBuilder: (context, index) {
                    final device = _bleService.discoveredDevices[index];
                    return ListTile(
                      title: Text(device.name.isEmpty
                          ? 'Unknown Device'
                          : device.name),
                      subtitle: Text(device.deviceId),
                      trailing: _bleService.isConnecting &&
                              _bleService.connectingDeviceId == device.deviceId
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                              ),
                            )
                          : null,
                      onTap: () async {
                        await _bleService.connectToDevice(device.deviceId);
                      },
                    );
                  },
                ),
              ),
            ),

          // ─── Connected Status ───────────────────────────────────────────
          if (_bleService.isConnected)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.green[100],
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Connected to ${_bleService.deviceName}',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text('Battery: ${_bleService.batteryLevel}%'),
                        Text('Signal: ${_bleService.signalQuality}%'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => _bleService.disconnect(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red,
                    ),
                    child: const Text(
                      'Disconnect',
                      style: TextStyle(color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),

          // ─── Simulation Mode Toggle ─────────────────────────────────────
          Padding(
            padding: const EdgeInsets.all(16),
            child: SwitchListTile(
              title: const Text('Simulation Mode (for testing)'),
              value: _bleService.isSimulated,
              onChanged: (value) {
                if (value) {
                  _bleService.enableSimulationMode();
                } else {
                  _bleService.disableSimulationMode();
                }
                setState(() {});
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// OPSI 3: Integration dengan existing wearable_pairing_service
/// 
/// Jika ingin keep existing wearable_pairing_service tapi improve dengan BleService logic:
/// 
/// ```dart
/// class PolarWearablePairingService extends ChangeNotifier {
///   final BleService _bleService = BleService();
///   
///   Future<bool> connectToDevice(String id) async {
///     // Gunakan BleService untuk connection logic
///     return _bleService.connectToDevice(id);
///   }
///   
///   Stream<SensorReading> get sensorStream => _bleService.readingStream;
/// }
/// ```

/// OPSI 4: Provider integration example
/// 
/// Di main.dart:
/// ```dart
/// void main() async {
///   WidgetsFlutterBinding.ensureInitialized();
///   
///   final bleService = BleService();
///   
///   runApp(
///     MultiProvider(
///       providers: [
///         ChangeNotifierProvider.value(value: bleService),
///         // ... other providers
///       ],
///       child: const MyApp(),
///     ),
///   );
/// }
/// ```
/// 
/// Di screen:
/// ```dart
/// class MyScreen extends StatelessWidget {
///   @override
///   Widget build(BuildContext context) {
///     return Consumer<BleService>(
///       builder: (context, bleService, _) {
///         return Text('Connected: ${bleService.isConnected}');
///       },
///     );
///   }
/// }
/// ```

// ============================================================================
// KEY DIFFERENCES DARI CAPAR-MOBILE
// ============================================================================
/*

BleService dari capar-mobile (yang sudah diimplementasikan di vidyamedic):

1. ✅ Auto-reconnect dengan retry logic (3 detik interval)
2. ✅ Timeout protection (15 detik max)
3. ✅ Background foreground service integration
4. ✅ Simulation mode untuk testing tanpa device
5. ✅ RMSSD & DFA calculation
6. ✅ Error isolation untuk ECG dan ACC streams
7. ✅ Persistent device ID storage
8. ✅ Better permission handling dengan FlutterBluePlus

vs Old wearable_pairing_service:
- ❌ Tidak ada auto-reconnect
- ❌ Tidak ada background service
- ❌ Lebih kompleks dengan sample/stream batching
- ❌ Tidak ada simulation mode

*/

