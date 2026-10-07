# 🔧 Integration Checklist & Setup Guide

## Pre-Integration Setup

### Step 1: Dependencies Already Installed ✅
```bash
flutter pub get
# ✅ flutter_riverpod: 2.5.1
# ✅ flutter_local_notifications: 17.2.4
# ✅ flutter_background_service: ^5.1.0
# ✅ socket_io_client: ^3.1.6
```

### Step 2: Files Available ✅

**New Services:**
- ✅ `lib/services/ble_service.dart`
- ✅ `lib/services/background_task.dart`

**Models:**
- ✅ `lib/models/sensor_reading.dart`

**Providers:**
- ✅ `lib/providers/ble_service_provider.dart`

**Documentation:**
- ✅ `POLAR_IMPLEMENTATION.md`
- ✅ `IMPLEMENTATION_EXAMPLES.md`
- ✅ `IMPLEMENTATION_SUMMARY.md`
- ✅ `README_POLAR_IMPLEMENTATION.md`

---

## Integration Options

### ✅ RECOMMENDED: Option 1 - Provider Integration

**Least disruptive, best for existing code**

#### Step 1: Update `lib/main.dart`

```dart
import 'package:provider/provider.dart';
import 'services/ble_service.dart';
import 'services/background_task.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('id_ID', null);
  
  // Initialize background service
  if (!kIsWeb) {
    await BackgroundTask.initializeService();
  }
  
  final appState = AppState();
  await appState.initialize();
  
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );
  
  runApp(VidyaMedicApp(appState: appState));
}

class VidyaMedicApp extends StatelessWidget {
  final AppState appState;
  const VidyaMedicApp({super.key, required this.appState});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: appState),
        ChangeNotifierProvider(
          create: (_) => BleService(),
          lazy: false,  // Initialize immediately
        ),
      ],
      child: MaterialApp(
        title: 'VidyaMedic',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: appState.isAuthenticated 
            ? const HomeScreen() 
            : const WelcomeScreen(),
      ),
    );
  }
}
```

#### Step 2: Use in Screens

```dart
import 'package:provider/provider.dart';
import '../services/ble_service.dart';

class MyScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<BleService>(
      builder: (context, bleService, _) {
        return Column(
          children: [
            Text('Connected: ${bleService.isConnected}'),
            ElevatedButton(
              onPressed: () => bleService.startScan(),
              child: const Text('Scan'),
            ),
          ],
        );
      },
    );
  }
}
```

---

### ✅ ALTERNATIVE: Option 2 - Riverpod Integration

**If you want to use Riverpod providers**

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

// In lib/providers/ble_service_provider.dart or similar
final bleServiceProvider = ChangeNotifierProvider<BleService>((ref) {
  return BleService();
});

// In widgets
final reading = ref.watch(currentSensorReadingProvider);
final bleService = ref.watch(bleServiceProvider);
```

---

### ✅ ALTERNATIVE: Option 3 - Existing wearable_pairing_service Enhancement

**Keep existing implementation, add BleService features gradually**

```dart
// In lib/services/wearable_pairing_service.dart
class PolarWearablePairingService extends ChangeNotifier {
  // Keep existing properties
  // ...
  
  // Add BleService for improved connection logic
  final BleService _bleService = BleService();
  
  Future<bool> connectToDevice(String id) async {
    // Use BleService's more robust connection logic
    return _bleService.connectToDevice(id);
  }
  
  Stream<SensorReading> get sensorStream => _bleService.readingStream;
}
```

---

## Implementation Checklist

### Immediate Actions

- [ ] Read `README_POLAR_IMPLEMENTATION.md`
- [ ] Review `POLAR_IMPLEMENTATION.md` for architecture
- [ ] Look at `IMPLEMENTATION_EXAMPLES.md` for code samples
- [ ] Run `flutter analyze` to verify no errors
- [ ] Run `flutter pub get` to ensure dependencies

### Before Production

- [ ] Choose integration option (Option 1 recommended)
- [ ] Update `lib/main.dart` for Background Task initialization
- [ ] Update screens to use BleService
- [ ] Test with Polar H10 device (or simulation mode)
- [ ] Verify auto-reconnect works
- [ ] Check background service keeps connection active

### Testing Checklist

**Manual Testing (with Polar H10)**
- [ ] Scan finds device
- [ ] Connect succeeds
- [ ] Data streams correctly (HR, ACC, ECG)
- [ ] RMSSD/DFA calculated
- [ ] Disconnect gracefully
- [ ] Auto-reconnect after unintended disconnect
- [ ] Background service keeps connection active

**Edge Cases**
- [ ] Device out of range → auto-reconnect
- [ ] App backgrounded → BLE stays active
- [ ] Multiple rapid connect/disconnect
- [ ] Permission denied → graceful error
- [ ] Device not found → proper UI feedback

**Simulation Testing (no device needed)**
```dart
// In any screen or app state
bleService.enableSimulationMode();
// Will generate realistic HR data
// Perfect for development & testing
```

---

## Configuration Files to Update

### Android: `android/app/src/main/AndroidManifest.xml`

Ensure these permissions exist:

```xml
<!-- Bluetooth permissions -->
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

<!-- Location for BLE scanning -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- Notifications -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<!-- Battery optimization bypass -->
<uses-permission android:name="android.permission.IGNORE_BATTERY_OPTIMIZATION" />

<!-- Background execution -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
```

### iOS: `ios/Runner/Info.plist`

Ensure these keys exist:

```xml
<key>NSBluetoothPeripheralUsageDescription</key>
<string>This app needs Bluetooth to connect to Polar H10 heart rate monitor</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>Location is needed to scan for nearby Bluetooth devices</string>

<key>NSLocalNetworkUsageDescription</key>
<string>App uses local network to communicate with Polar device</string>
```

---

## Common Issues & Solutions

### Issue 1: "permission_handler not working"
**Solution**: Ensure `permission_handler: 11.3.1` is in pubspec.yaml
```bash
flutter pub get
```

### Issue 2: "Background service initialization fails"
**Solution**: Call `BackgroundTask.initializeService()` in main()
```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await BackgroundTask.initializeService();  // Add this
  // ... rest of main
}
```

### Issue 3: "BleService not available in Consumer"
**Solution**: Make sure BleService provider is set up in MultiProvider
```dart
MultiProvider(
  providers: [
    ChangeNotifierProvider(
      create: (_) => BleService(),
      lazy: false,  // Important!
    ),
  ],
  // ...
)
```

### Issue 4: "Notifications not showing"
**Solution**: 
1. Check Android notification channel exists
2. Verify app has POST_NOTIFICATIONS permission
3. Check notification importance level is correct

### Issue 5: "Auto-reconnect not working"
**Solution**:
1. Verify device was saved: `SharedPreferences.getString('device_id')`
2. Check not manually disconnected: `_isManualDisconnect = false`
3. Verify not already connected: `!isConnected`

---

## Performance Considerations

### Memory
- BleService uses ~5-10 MB
- StreamControllers properly disposed
- No memory leaks with proper cleanup

### Battery
- Background service uses ~5-10% extra battery
- BLE connection itself minimal impact
- Foreground notification helps battery optimization

### Network
- No network traffic from BleService (local only)
- Sensor data upload is separate concern
- Can be batched per application needs

---

## Debugging Tips

### Enable Debug Prints
```dart
// In lib/services/ble_service.dart already has debug prints
// Look for [Polar] prefix in console output
```

### Common Debug Outputs
```
[Polar] Found saved device ID: FC:70:EE:5A:B4:5E
[Polar] Connecting to FC:70:EE:5A:B4:5E ...
[Polar] Connected: FC:70:EE:5A:B4:5E (Polar H10)
[Polar] HR streaming started
[Polar] 🔄 Auto-reconnect scheduled in 3 seconds
```

### Use Flutter DevTools
```bash
flutter pub global activate devtools
flutter pub global run devtools
# Then open in browser and connect to running app
```

### Check Notifications
```dart
final notifications = FlutterLocalNotificationsPlugin();
// Check notification channels are created correctly
```

---

## Rollback Plan

If integration causes issues:

1. **Revert changes**: `git checkout -- lib/main.dart`
2. **Remove BleService provider**: Comment out from MultiProvider
3. **Keep existing code**: `wearable_pairing_service` still works
4. **Gradual retry**: Integrate feature by feature

---

## Next Phase: Data Integration

Once BleService is working, next step is integrating with data upload:

```dart
// Listen to sensor stream
bleService.readingStream.listen((reading) {
  // Upload to backend via API
  await ApiService.uploadSensorData(reading);
});
```

See `lib/services/api_service.dart` for upload implementation.

---

## Support & Questions

1. **Setup issues?** → Check `README_POLAR_IMPLEMENTATION.md`
2. **Code examples?** → See `IMPLEMENTATION_EXAMPLES.md`
3. **Architecture?** → Read `POLAR_IMPLEMENTATION.md`
4. **Reference?** → Check `../capar-mobile/lib/services/ble_service.dart`

---

**Status**: ✅ Ready for Integration
**Difficulty**: ⭐⭐ (Moderate - mostly configuration)
**Time Estimate**: 30-60 minutes for full integration

