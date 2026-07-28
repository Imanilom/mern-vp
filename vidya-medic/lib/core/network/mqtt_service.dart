import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';
import '../../shared/models/models.dart';

/**
 * MqttService — Layanan koneksi langsung MQTT ke RabbitMQ Broker.
 * 
 * Alur:
 * Sensor (Polar H10) -> Flutter App -> MqttService -> RabbitMQ Broker (Port 1883/8883)
 * -> Queue 'Sensor' -> Data Ingestion Worker (Node.js) -> MongoDB (Raw Data)
 */
class MqttService extends ChangeNotifier {
  MqttServerClient? _client;
  bool isConnected = false;

  static const String brokerHost = 'rmq230.smartsystem.id';
  static const int mqttPort = 1883; // Port 1883 MQTT / 8883 MQTTS
  static const String mqttUser = '/polar:anomali'; // Vhost /polar + User anomali
  static const String mqttPass = 'anomali123';
  static const String topicName = 'Sensor';

  Future<bool> connect() async {
    if (isConnected && _client != null && _client!.connectionStatus?.state == MqttConnectionState.connected) {
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
      final ok = await connect();
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
          'heart_rate': r.heartRate,
          'rr_interval': r.rrInterval,
          'activity': r.motionState,
          'battery': r.battery,
          'signal_quality': r.signalQuality,
          'rmssd': r.rmssd,
          'dfa_alpha1': r.dfaAlpha1,
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
