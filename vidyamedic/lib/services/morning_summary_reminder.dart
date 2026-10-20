import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

class MorningSummaryReminder {
  MorningSummaryReminder._();

  static const int _notificationId = 4108;
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  static bool _initialized = false;
  static bool _timeZonesInitialized = false;
  static VoidCallback? _onReminderTap;

  static void setOnReminderTap(VoidCallback callback) {
    _onReminderTap = callback;
  }

  static Future<bool> initialize({
    required VoidCallback onReminderTap,
  }) async {
    setOnReminderTap(onReminderTap);
    await _initialize();
    final launchDetails = await _plugin.getNotificationAppLaunchDetails();
    return launchDetails?.didNotificationLaunchApp ?? false;
  }

  static Future<void> sync({
    required bool enabled,
    required TimeOfDay time,
    required String timeZone,
  }) async {
    await _initialize();
    if (!enabled) {
      await _plugin.cancel(_notificationId);
      return;
    }

    final android = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    final androidGranted = await android?.requestNotificationsPermission();
    final ios = _plugin.resolvePlatformSpecificImplementation<
        IOSFlutterLocalNotificationsPlugin>();
    final iosGranted =
        await ios?.requestPermissions(alert: true, badge: true, sound: true);
    if (androidGranted == false || iosGranted == false) {
      throw StateError(
        'Izin notifikasi ditolak. Aktifkan notifikasi VidyaMedic di pengaturan perangkat.',
      );
    }

    if (!_timeZonesInitialized) {
      tz_data.initializeTimeZones();
      _timeZonesInitialized = true;
    }
    final location = tz.getLocation(
      timeZone.trim().isEmpty ? 'Asia/Jakarta' : timeZone.trim(),
    );
    final now = tz.TZDateTime.now(location);
    var next = tz.TZDateTime(
      location,
      now.year,
      now.month,
      now.day,
      time.hour,
      time.minute,
    );
    if (!next.isAfter(now)) {
      next = tz.TZDateTime(
        location,
        now.year,
        now.month,
        now.day + 1,
        time.hour,
        time.minute,
      );
    }
    await _plugin.zonedSchedule(
      _notificationId,
      'Ringkasan pagi Anda',
      'Luangkan waktu sejenak untuk mencatat tidur dan kondisi hari ini.',
      next,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'vidyamedic_morning_summary',
          'Ringkasan pagi',
          channelDescription:
              'Pengingat untuk membuka ringkasan kesehatan harian.',
          importance: Importance.defaultImportance,
          priority: Priority.defaultPriority,
        ),
        iOS: DarwinNotificationDetails(),
      ),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
      matchDateTimeComponents: DateTimeComponents.time,
      payload: 'daily_summary',
    );
  }

  static Future<void> _initialize() async {
    if (_initialized) return;
    const settings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(
        requestAlertPermission: false,
        requestBadgePermission: false,
        requestSoundPermission: false,
      ),
    );
    await _plugin.initialize(
      settings,
      onDidReceiveNotificationResponse: (_) => _onReminderTap?.call(),
    );
    _initialized = true;
  }
}
