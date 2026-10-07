# Implementasi Koneksi Polar H10 di Vidyamedic

## Ringkasan Perubahan

Implementasi koneksi Polar H10 di vidyamedic telah diperbarui berdasarkan solusi yang sudah berhasil dari capar-mobile.

### File yang Ditambahkan

1. **`lib/services/ble_service.dart`** - Layanan BLE utama yang menangani:
   - Scanning perangkat Polar
   - Koneksi/Disconnect otomatis dengan retry logic
   - Streaming data HR, ECG, dan Acceleration
   - Kalkulasi RMSSD dan DFA
   - Mode simulasi untuk testing
   - Auto-reconnect saat perangkat terputus

2. **`lib/services/background_task.dart`** - Foreground Service untuk:
   - Menjaga koneksi tetap aktif di background
   - Update notifikasi status koneksi
   - Prevent OS dari killing BLE connection

3. **`lib/models/sensor_reading.dart`** - Model data sensor yang unified

### Dependencies yang Ditambahkan

```yaml
flutter_riverpod: 2.5.1          # State management
flutter_local_notifications: 17.2.4  # Notifikasi
flutter_background_service: ^5.1.0   # Background service
socket_io_client: ^3.1.6         # Real-time communication
```

## Arsitektur

### Alur Data Polar H10

```
Perangkat Polar H10
        ↓
┌─────────────────────────────────────────────────────┐
│                   BleService                        │
│  • HR + RR (1Hz via HRS)                           │
│  • ECG (130Hz via PMD)                             │
│  • ACC (50Hz via PMD)                              │
└─────────────────────┬───────────────────────────────┘
        ↓
    readingStream (SensorReading)
        ↓
   UI / Controllers dapat consume stream ini
```

## Fitur Utama

### 1. Auto-Reconnect
- Otomatis mencoba reconnect setiap 3 detik jika perangkat terputus
- Max 15 detik timeout untuk avoid infinite loading
- Dapat di-disable jika user manually disconnect

### 2. Background Service
- Menjaga koneksi tetap aktif 24/7 di background
- Mencegah Android dari killing BLE connection
- Update notifikasi real-time dengan status HR dan battery

### 3. Simulation Mode
- Untuk testing tanpa perangkat fisik
- Menghasilkan data HR yang natural dengan sine wave
- Euler integration untuk ACC dan ECG

### 4. Data Processing
```dart
// RMSSD (Root Mean Square of Successive Differences)
final rmssd = _calculateRmssd();

// DFA Alpha1 (Detrended Fluctuation Analysis)
final dfa = _estimateDfa();
```

## Penggunaan

### Setup di AppState atau Provider

```dart
// Option 1: Menggunakan BleService langsung
final bleService = BleService();

// Option 2: Menggunakan existing wearable_pairing_service
// (kompatibel dengan current implementation)
final wearableBridge = PolarWearablePairingService(...);
```

### Scanning Devices

```dart
await bleService.startScan();

// Listen ke discovered devices
Stream<PolarDeviceInfo> devices = bleService.scanResults;
```

### Koneksi

```dart
// Otomatis simpan device ID untuk reconnect
await bleService.connectToDevice('FC:70:EE:5A:B4:5E');

// Streaming data
bleService.readingStream.listen((SensorReading reading) {
  print('HR: ${reading.heartRate} BPM');
  print('RR: ${reading.rrInterval} ms');
  print('RMSSD: ${reading.rmssd}');
  print('DFA: ${reading.dfaAlpha1}');
});
```

### Disconnect

```dart
await bleService.disconnect();

// Atau gunakan simulation mode untuk testing
bleService.enableSimulationMode();
```

## Troubleshooting

### Koneksi sering terputus
1. Pastikan `flutter_background_service` sudah initialized
2. Cek battery optimization settings di device
3. Verifikasi permissions (Bluetooth, Location, Notification)

### Notifikasi tidak muncul
1. Pastikan Android 13+ notification permission sudah di-grant
2. Cek notification channel id di AndroidManifest.xml
3. Pastikan app memiliki POST_NOTIFICATIONS permission

### Data tidak masuk
1. Verifikasi perangkat support HR, ECG, ACC streaming
2. Cek DartPluginRegistrant di background entry point
3. Pastikan network connectivity untuk upload data

## Migrasi dari Old Implementation

Jika sebelumnya menggunakan `wearable_pairing_service`, Anda bisa:

1. **Keep existing**: Terus gunakan `wearable_pairing_service` dengan improvement
2. **Gradual migration**: Gunakan `BleService` untuk core connection, mapping data ke existing models
3. **Full replacement**: Replace `wearable_pairing_service` dengan `BleService` jika fitur cukup

## Next Steps

1. ✅ Tambahkan dependencies di pubspec.yaml
2. ✅ Implement BleService dengan capar-mobile patterns
3. ✅ Setup Background task service
4. ✅ Create SensorReading model
5. 🔄 Update UI screens untuk menggunakan BleService
6. 🔄 Test dengan perangkat Polar H10 fisik
7. 🔄 Integrate dengan existing data upload flow

## Reference

- Capar-Mobile implementation: `../capar-mobile/lib/services/ble_service.dart`
- Polar SDK docs: https://pub.dev/packages/polar
- Flutter Background Service: https://pub.dev/packages/flutter_background_service
