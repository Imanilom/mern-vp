import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final notificationServiceProvider = Provider<NotificationService>((ref) {
  final service = NotificationService();
  service.init();
  return service;
});

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();

  bool _isInitialized = false;

  Future<void> init() async {
    if (_isInitialized) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    try {
      await _notificationsPlugin.initialize(
        initSettings,
      );
    } catch (_) {
      // Catch platform-specific initialization errors on unsupported platforms
    }

    _isInitialized = true;
  }

  Future<void> showNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      'htm_channel_id',
      'HTM Trajectory Notifications',
      channelDescription: 'Notifikasi status sensor, QR scan, dan alert kesehatan',
      importance: Importance.high,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    try {
      await _notificationsPlugin.show(id, title, body, details, payload: payload);
    } catch (_) {
      // Fallback for mock environments
    }
  }

  Future<void> showDeviceConnected(String deviceName) async {
    await showNotification(
      id: 101,
      title: "Perangkat Terhubung",
      body: "$deviceName berhasil terhubung. Pemantauan denyut jantung & HRV aktif.",
    );
  }

  Future<void> showDeviceDisconnected(String deviceName) async {
    await showNotification(
      id: 102,
      title: "Perangkat Terputus",
      body: "Koneksi ke $deviceName terputus. Mencoba menghubungkan ulang...",
    );
  }

  Future<void> showQrScanSuccess(String studyCode) async {
    await showNotification(
      id: 201,
      title: "Pendaftaran Studi Berhasil",
      body: "Studi $studyCode berhasil diverifikasi dan terhubung ke sesi Anda.",
    );
  }

  Future<void> showAlertNotification(String alertTitle, String alertBody) async {
    await showNotification(
      id: 301,
      title: "⚠️ $alertTitle",
      body: alertBody,
    );
  }
}
