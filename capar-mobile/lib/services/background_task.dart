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

    service.on('updateNotification').listen((event) {
      final title = event?['title']?.toString() ?? 'CAPAR Sensor Active';
      final content = event?['content']?.toString() ?? 'Monitoring Polar H10 in background...';
      service.setForegroundNotificationInfo(title: title, content: content);
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
            content: "Mengirim data simulasi RR ke backend...",
          );
        }
      }

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
    // REAL BLE MODE: Keeps app alive in foreground to prevent OS from killing it
    Timer.periodic(const Duration(seconds: 10), (timer) async {
      if (service is AndroidServiceInstance) {
        if (await service.isForegroundService()) {
          final isConn = prefs.getBool('polar_is_connected') ?? false;
          final lastHr = prefs.getInt('polar_last_hr') ?? 0;
          final devName = prefs.getString('device_name') ?? 'Polar H10';
          
          if (isConn && lastHr > 0) {
            service.setForegroundNotificationInfo(
              title: "$devName Terhubung ($lastHr BPM)",
              content: "Telemetri latar belakang aktif • CAPAR Digital Twin",
            );
          } else if (isConn) {
            service.setForegroundNotificationInfo(
              title: "$devName Terhubung",
              content: "Menerima aliran telemetri sensor kontinu...",
            );
          } else {
            service.setForegroundNotificationInfo(
              title: "CAPAR Background Active",
              content: "Menunggu koneksi sensor Polar H10...",
            );
          }
        }
      }
    });
  }
}

class BackgroundTask {
  static bool _isInitialized = false;

  static Future<void> initializeService() async {
    if (kIsWeb || _isInitialized) return;
    
    try {
      // Request notification permission for Android 13+
      await Permission.notification.request();

      // Request ignore battery optimizations so Android won't kill background BLE
      if (Platform.isAndroid) {
        if (!await Permission.ignoreBatteryOptimizations.isGranted) {
          await Permission.ignoreBatteryOptimizations.request();
        }
      }
      
      final service = FlutterBackgroundService();

      const AndroidNotificationChannel channel = AndroidNotificationChannel(
        'capar_foreground',
        'CAPAR Background Stream',
        description: 'Digunakan untuk menjaga koneksi Polar H10 tetap berjalan di latar belakang.',
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
          initialNotificationTitle: 'CAPAR Polar Monitor',
          initialNotificationContent: 'Menjaga koneksi Polar H10 di latar belakang...',
          foregroundServiceNotificationId: 888,
        ),
        iosConfiguration: IosConfiguration(
          autoStart: false,
          onForeground: onStart,
          onBackground: onIosBackground,
        ),
      );

      _isInitialized = true;
      debugPrint('[BackgroundTask] Initialized successfully.');
    } catch (e) {
      debugPrint('[BackgroundTask] Init error: $e');
    }
  }

  /// Start Foreground Service to prevent Android from killing BLE connection
  static Future<void> startForegroundService({String? title, String? content}) async {
    if (kIsWeb) return;
    try {
      if (!_isInitialized) {
        await initializeService();
      }
      final service = FlutterBackgroundService();
      final isRunning = await service.isRunning();
      if (!isRunning) {
        await service.startService();
      }
      if (title != null || content != null) {
        service.invoke('updateNotification', {
          'title': title ?? 'CAPAR Sensor Active',
          'content': content ?? 'Monitoring Polar H10 in background...'
        });
      }
    } catch (e) {
      debugPrint('[BackgroundTask] startForegroundService error: $e');
    }
  }

  /// Stop Foreground Service when user manually disconnects
  static Future<void> stopForegroundService() async {
    if (kIsWeb) return;
    try {
      final service = FlutterBackgroundService();
      final isRunning = await service.isRunning();
      if (isRunning) {
        service.invoke('stopService');
      }
    } catch (e) {
      debugPrint('[BackgroundTask] stopForegroundService error: $e');
    }
  }

  /// Update notification status dynamically
  static void updateNotification(String title, String content) {
    if (kIsWeb) return;
    try {
      final service = FlutterBackgroundService();
      service.invoke('updateNotification', {
        'title': title,
        'content': content,
      });
    } catch (_) {}
  }

  @pragma('vm:entry-point')
  static Future<bool> onIosBackground(ServiceInstance service) async {
    return true;
  }
}
