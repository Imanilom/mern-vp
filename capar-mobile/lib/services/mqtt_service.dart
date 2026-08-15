import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';
import '../../shared/models/models.dart';
import 'notifications/notification_service.dart';

class MqttService extends ChangeNotifier {
  MqttServerClient? _client;
  bool isConnected = false;

  static const String brokerHost = 'rmq230.smartsystem.id';
  static const int mqttPort = 1883; // Port 1883 MQTT / 8883 MQTTS
  static const String mqttUser = '/polar:anomali'; // Vhost /polar + User anomali
  static const String mqttPass = 'anomali123';
  static const String topicName = 'Sensor';

  Future<bool> connect([String? userId]) async {
    if (isConnected && _client != null && _client!.connectionStatus?.state == MqttConnectionState.connected) {
      if (userId != null) {
        _subscribeToNotifications(userId);
      }
      return true;
    }

    final clientIdentifier = 'flutter_sensor_${DateTime.now().millisecondsSinceEpoch}';
    _client = MqttServerClient.withPort(brokerHost, clientIdentifier, mqttPort);
    _client!.logging(on: false);
    _client!.keepAlivePeriod = 60;
    _client!.onDisconnected = _onDisconnected;
    _client!.onConnected = _onConnected;

    final connMessage = MqttConnectMessage()
        .withClientIdentifier(clientIdentifier)
        .startClean()
        .withWillQos(MqttQos.atLeastOnce);
    _client!.connectionMessage = connMessage;

    try {
      debugPrint('[MQTT] Connecting directly to RabbitMQ Broker: $brokerHost:$mqttPort...');
      await _client!.connect(mqttUser, mqttPass);
    } catch (e) {
      debugPrint('[MQTT] Connection exception: $e');
      _disconnect();
      return false;
    }

    if (_client?.connectionStatus?.state == MqttConnectionState.connected) {
      debugPrint('[MQTT] Connected successfully to RabbitMQ Broker!');
      isConnected = true;
      notifyListeners();
      
      if (userId != null) {
        _subscribeToNotifications(userId);
      }
      
      return true;
    } else {
      debugPrint('[MQTT] Connection failed with status: ${_client?.connectionStatus?.state}');
      _disconnect();
      return false;
    }
  }

  Future<bool> publishSensorReadings({
    required String userId,
    required String deviceId,
    required List<SensorReading> readings,
  }) async {
    if (!isConnected) {
      final ok = await connect(userId);
      if (!ok) return false;
    }

    try {
      final payload = {
        'user_id': userId,
        'source': 'polar_ble_direct_mqtt',
        'device_id': deviceId,
        'received_at': DateTime.now().toUtc().toIso8601String(),
        'readings': readings.map((r) => {
          'timestamp': r.timestamp.millisecondsSinceEpoch ~/ 1000,
          'hr': r.heartRate,
          'heart_rate': r.heartRate,
          'rr': r.rrInterval,
          'rr_interval': r.rrInterval,
          'rrms': r.rmssd,
          'rmssd': r.rmssd,
          'activity': r.motionState,
          'battery': r.battery,
          'signal_quality': r.signalQuality,
          'dfa_alpha1': r.dfaAlpha1,
          'acc_x': r.accX,
          'acc_y': r.accY,
          'acc_z': r.accZ,
          'ecg': r.ecg,
          'step_count': r.stepCount,
        }).toList(),
      };

      final jsonStr = jsonEncode(payload);
      final builder = MqttClientPayloadBuilder();
      builder.addString(jsonStr);

      _client!.publishMessage(topicName, MqttQos.atLeastOnce, builder.payload!);
      debugPrint('[MQTT -> RabbitMQ Direct] Successfully published ${readings.length} readings to queue/topic: $topicName');
      return true;
    } catch (e) {
      debugPrint('[MQTT] Error publishing sensor readings: $e');
      return false;
    }
  }

  void _subscribeToNotifications(String userId) {
    if (_client == null) return;
    
    final topic = 'notification/$userId';
    
    // Subscribe to topic
    _client!.subscribe(topic, MqttQos.atLeastOnce);
    debugPrint('[MQTT] Subscribed to topic: $topic');

    // Listen for incoming updates
    _client!.updates!.listen((List<MqttReceivedMessage<MqttMessage>> c) {
      final recMess = c[0].payload as MqttPublishMessage;
      final pt = MqttPublishPayload.bytesToStringAsString(recMess.payload.message);
      
      if (c[0].topic == topic) {
        debugPrint('[MQTT] Notification received on $topic: $pt');
        try {
          final json = jsonDecode(pt);
          final type = json['type'] ?? 'INFO';
          final message = json['message'] ?? 'Ada pemberitahuan baru.';
          
          // Trigger local notification
          NotificationService().showAlertNotification(type, message);
        } catch (e) {
          debugPrint('[MQTT] Error parsing notification: $e');
        }
      }
    });
  }

  void _onConnected() {
    debugPrint('[MQTT Callback] Connected to RabbitMQ');
    isConnected = true;
    notifyListeners();
  }

  void _onDisconnected() {
    debugPrint('[MQTT Callback] Disconnected from RabbitMQ');
    isConnected = false;
    notifyListeners();
  }

  void _disconnect() {
    _client?.disconnect();
    _client = null;
    isConnected = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _disconnect();
    super.dispose();
  }
}

final mqttServiceProvider = ChangeNotifierProvider<MqttService>((ref) {
  return MqttService();
});
