import 'dart:async';
import 'dart:io';
import 'dart:ui';
import 'package:flutter/foundation.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:permission_handler/permission_handler.dart';

import 'api_service.dart';

// Global background entry point
@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();
  
  if (service is AndroidServiceInstance) {
    service.on('setAsForeground').listen((event) {
      service.setAsForegroundService();
    });

    service.on('setAsBackground').listen((event) {
      service.setAsBackgroundService();
    });
  }

  service.on('stopService').listen((event) {
    service.stopSelf();
  });

  // Fetch token and user ID
  final prefs = await SharedPreferences.getInstance();
  final token = prefs.getString('token');
  final userId = prefs.getString('user_id') ?? '';
  final deviceId = prefs.getString('device_id') ?? 'polar_h10';

  if (token == null || userId.isEmpty) {
    debugPrint('[BackgroundTask] Token atau userId tidak ditemukan, service dihentikan.');
    service.stopSelf();
    return;
  }

  bool isDummyMode = prefs.getBool('dummy_mode') ?? false;

  if (isDummyMode) {
    // DUMMY MODE for Emulator Testing
    Timer.periodic(const Duration(seconds: 5), (timer) async {
      if (service is AndroidServiceInstance) {
        if (await service.isForegroundService()) {
          service.setForegroundNotificationInfo(
            title: "CAPAR Active (Dummy Mode)",
            content: "Sending simulated RR data to backend...",
          );
        }
      }

      // Generate fake RR around 800ms
      final fakeReadings = [
        {
          "rr": 790 + (DateTime.now().millisecond % 20),
          "time": DateTime.now().toIso8601String()
        }
      ];

      try {
        await ApiService.sendSensorData(
          userId: userId, 
          deviceId: deviceId, 
          readings: fakeReadings
        );
      } catch (e) {
        debugPrint("Dummy Background API Error: $e");
      }
    });
  } else {
    // REAL BLE MODE is now handled in the main isolate via Riverpod's BleService.
    // This background service simply keeps the app alive in the foreground to prevent OS from killing it during background execution.
    Timer.periodic(const Duration(seconds: 15), (timer) async {
      if (service is AndroidServiceInstance) {
        if (await service.isForegroundService()) {
          service.setForegroundNotificationInfo(
            title: "CAPAR Active",
            content: "Monitoring heart rate in background...",
          );
        }
      }
    });
  }
}

class BackgroundTask {
  static Future<void> initializeService() async {
    if (kIsWeb) return;
    
    // Request notification permission for Android 13+
    await Permission.notification.request();

    if (Platform.isAndroid) {
      final apiMatch = RegExp(r'API (\d+)').firstMatch(Platform.operatingSystemVersion);
      final apiLevel = apiMatch != null ? int.tryParse(apiMatch.group(1) ?? '') : null;
      if (apiLevel != null && apiLevel >= 34) {
        debugPrint('Skipping background service init on Android 14+ because the current flutter_background_service plugin crashes with MissingForegroundServiceTypeException.');
        return;
      }
    }
    
    final service = FlutterBackgroundService();

    const AndroidNotificationChannel channel = AndroidNotificationChannel(
      'capar_foreground',
      'CAPAR Background Stream',
      description: 'Digunakan untuk menjaga koneksi Polar H10 tetap berjalan.',
      importance: Importance.low,
    );

    final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin = FlutterLocalNotificationsPlugin();

    await flutterLocalNotificationsPlugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    await service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: onStart,
        autoStart: false,
        isForegroundMode: true,
        notificationChannelId: 'capar_foreground',
        initialNotificationTitle: 'CAPAR Sensor',
        initialNotificationContent: 'Menunggu koneksi...',
        foregroundServiceNotificationId: 888,
      ),
      iosConfiguration: IosConfiguration(
        autoStart: false,
        onForeground: onStart,
        onBackground: onIosBackground,
      ),
    );
  }

  @pragma('vm:entry-point')
  static Future<bool> onIosBackground(ServiceInstance service) async {
    return true;
  }
}
