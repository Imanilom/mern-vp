import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';
import '../../shared/models/models.dart';
import 'notifications/notification_service.dart';

/// MqttService — Koneksi langsung MQTT ke RabbitMQ Broker.
///
/// Alur:
///   Polar H10 → BleService → TelemetryController → MqttService → RabbitMQ
///   → Queue 'Sensor' → logTransport (Node.js) → MongoDB
class MqttService extends ChangeNotifier {
  MqttServerClient? _client;
  bool _isConnecting = false;
  bool isConnected = false;

  // RabbitMQ MQTT Plugin config
  static const String brokerHost = 'rmq230.smartsystem.id';
  static const int    mqttPort   = 1883;
  static const String mqttUser   = '/polar:anomali'; // vhost /polar, user anomali
  static const String mqttPass   = 'anomali123';
  static const String topicName  = 'Sensor';

  // ─── Connect ────────────────────────────────────────────────────────────────

  Future<bool> connect([String? userId]) async {
    // Jika sudah connected, subscribe notif dan langsung return
    if (isConnected &&
        _client != null &&
        _client!.connectionStatus?.state == MqttConnectionState.connected) {
      if (userId != null) _subscribeToNotifications(userId);
      return true;
    }

    // Guard double-connect
    if (_isConnecting) return false;
    _isConnecting = true;

    try {
      final clientId = 'capar_${DateTime.now().millisecondsSinceEpoch}';
      _client = MqttServerClient.withPort(brokerHost, clientId, mqttPort);
      _client!.logging(on: false);
      _client!.keepAlivePeriod = 60;
      _client!.autoReconnect = true;
      _client!.onDisconnected = _onDisconnected;
      _client!.onConnected = _onConnected;
      _client!.onAutoReconnected = () {
        debugPrint('[MQTT] Auto-reconnected to RabbitMQ');
        isConnected = true;
        notifyListeners();
      };

      final connMsg = MqttConnectMessage()
          .withClientIdentifier(clientId)
          .startClean()
          .withWillQos(MqttQos.atLeastOnce);
      _client!.connectionMessage = connMsg;

      debugPrint('[MQTT] Connecting to $brokerHost:$mqttPort ...');
      await _client!.connect(mqttUser, mqttPass);
    } catch (e) {
      debugPrint('[MQTT] Connection exception: $e');
      _cleanupClient();
      return false;
    } finally {
      _isConnecting = false;
    }

    if (_client?.connectionStatus?.state == MqttConnectionState.connected) {
      debugPrint('[MQTT] Connected ✓ → queue: $topicName');
      isConnected = true;
      notifyListeners();
      if (userId != null) _subscribeToNotifications(userId);
      return true;
    } else {
      debugPrint('[MQTT] Connection failed: ${_client?.connectionStatus}');
      _cleanupClient();
      return false;
    }
  }

  // ─── Publish Sensor Readings ─────────────────────────────────────────────────

  Future<bool> publishSensorReadings({
    required String userId,
    required String deviceId,
    required List<SensorReading> readings,
  }) async {
    if (readings.isEmpty) return false;

    // Ensure connected (dengan userId agar subscribe notif benar)
    if (!isConnected) {
      final ok = await connect(userId);
      if (!ok) return false;
    }

    try {
      final payload = {
        'user_id':     userId,
        'source':      'polar_ble_direct_mqtt',
        'device_id':   deviceId,
        'received_at': DateTime.now().toUtc().toIso8601String(),
        'readings': readings.map((r) => {
          // Field yang diexpect oleh logTransport / backend
          'timestamp':    r.timestamp.millisecondsSinceEpoch ~/ 1000,
          'time_created': r.timestamp.toUtc().toIso8601String(),
          'hr':           r.heartRate,
          'heart_rate':   r.heartRate,
          'rr':           r.rrInterval,
          'rr_interval':  r.rrInterval,
          'rrms':         r.rmssd,
          'rmssd':        r.rmssd,
          'dfa_alpha1':   r.dfaAlpha1,
          'activity':     r.motionState,
          'battery':      r.battery,
          'signal_quality': r.signalQuality,
          // Sensor fisik — 0.0 jika tidak ada PMD
          'acc_x':    r.accX,
          'acc_y':    r.accY,
          'acc_z':    r.accZ,
          'ecg':      r.ecg,
          'step_count': r.stepCount,
        }).toList(),
      };

      final jsonStr = jsonEncode(payload);
      final builder = MqttClientPayloadBuilder()..addString(jsonStr);

      _client!.publishMessage(topicName, MqttQos.atLeastOnce, builder.payload!);
      debugPrint('[MQTT → RMQ] Published ${readings.length} readings (userId=$userId, device=$deviceId)');
      return true;
    } catch (e) {
      debugPrint('[MQTT] Publish error: $e');
      // Reset koneksi agar next cycle reconnect
      isConnected = false;
      notifyListeners();
      return false;
    }
  }

  // ─── Notification Subscription ───────────────────────────────────────────────

  void _subscribeToNotifications(String userId) {
    if (_client == null || !isConnected) return;
    final topic = 'notification/$userId';
    _client!.subscribe(topic, MqttQos.atLeastOnce);
    debugPrint('[MQTT] Subscribed to notification topic: $topic');

    _client!.updates?.listen((List<MqttReceivedMessage<MqttMessage>> c) {
      if (c.isEmpty) return;
      final msg = c[0];
      if (msg.topic != topic) return;
      final payload = msg.payload as MqttPublishMessage;
      final pt = MqttPublishPayload.bytesToStringAsString(payload.payload.message);
      try {
        final json = jsonDecode(pt);
        NotificationService().showAlertNotification(
          json['type'] ?? 'INFO',
          json['message'] ?? 'Ada pemberitahuan baru.',
        );
      } catch (e) {
        debugPrint('[MQTT] Notification parse error: $e');
      }
    });
  }

  // ─── Callbacks ───────────────────────────────────────────────────────────────

  void _onConnected() {
    debugPrint('[MQTT Callback] Connected');
    isConnected = true;
    notifyListeners();
  }

  void _onDisconnected() {
    debugPrint('[MQTT Callback] Disconnected');
    isConnected = false;
    notifyListeners();
  }

  void _cleanupClient() {
    _client?.disconnect();
    _client = null;
    isConnected = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _cleanupClient();
    super.dispose();
  }
}

final mqttServiceProvider = ChangeNotifierProvider<MqttService>((ref) {
  return MqttService();
});
