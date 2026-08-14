import 'dart:async';
import 'dart:io';
import 'dart:ui';
import 'package:flutter/foundation.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';

import 'api_service.dart';
import 'ble_service.dart';

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
  final token = prefs.getString('auth_token');
  final userId = prefs.getString('user_id') ?? 'P012';

  if (token == null) {
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
          deviceId: 'dummy_polar_h10', 
          readings: fakeReadings
        );
      } catch (e) {
        print("Dummy Background API Error: $e");
      }
    });
  } else {
    // REAL BLE MODE
    if (BleService.hrCharacteristic != null) {
      await BleService.hrCharacteristic!.setNotifyValue(true);
      
      List<Map<String, dynamic>> readingsBatch = [];
      Timer? flushTimer;
      
      BleService.hrCharacteristic!.lastValueStream.listen((value) {
        if (value.isNotEmpty) {
          final data = BleService.parseHeartRateData(value);
          final rrList = data['rr_list'] as List<int>;
          
          final now = DateTime.now().toIso8601String();
          for (var rr in rrList) {
            readingsBatch.add({
              'rr': rr,
              'time': now,
            });
          }
        }
      });

      // Flush batch to API every 5 seconds
      flushTimer = Timer.periodic(const Duration(seconds: 5), (timer) async {
        if (readingsBatch.isEmpty) return;

        final batchToSend = List<Map<String, dynamic>>.from(readingsBatch);
        readingsBatch.clear();

        if (service is AndroidServiceInstance) {
          if (await service.isForegroundService()) {
            service.setForegroundNotificationInfo(
              title: "CAPAR Active",
              content: "Streaming RR data to backend... (${batchToSend.length} pts)",
            );
          }
        }

        try {
          await ApiService.sendSensorData(
            userId: userId, 
            deviceId: BleService.connectedDevice?.remoteId.toString() ?? 'polar_h10', 
            readings: batchToSend
          );
        } catch (e) {
          print("Background API Error: $e");
          // Re-insert on failure? For now, we drop it to prevent OOM
        }
      });
    } else {
      // Characteristic is null, stop service
      service.stopSelf();
    }
  }
}

class BackgroundTask {
  static Future<void> initializeService() async {
    if (kIsWeb) return;

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
