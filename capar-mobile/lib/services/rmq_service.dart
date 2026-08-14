import 'dart:convert';
import 'package:dart_amqp/dart_amqp.dart';
import 'package:flutter/foundation.dart';

class RmqService {
  static Client? _client;
  static Channel? _channel;
  static Queue? _queue;

  // Sesuaikan dengan konfigurasi RabbitMQ Anda.
  // Gunakan 10.0.2.2 untuk emulator, atau IP server remote.
  static final ConnectionSettings _settings = ConnectionSettings(
    host: '10.0.2.2',
    port: 5672,
    authProvider: const PlainAuthenticator('guest', 'guest'),
  );

  static const String _queueName = 'Sensor';

  static Future<void> _connect() async {
    if (_client != null && _channel != null && _queue != null) return;

    try {
      _client = Client(settings: _settings);
      _channel = await _client!.channel();
      
      // Pastikan queue exist dan persistent
      _queue = await _channel!.queue(_queueName, durable: true);
      debugPrint('[RmqService] Connected to RabbitMQ on ${_settings.host}');
    } catch (e) {
      debugPrint('[RmqService] Connection error: $e');
      _client?.close();
      _client = null;
      _channel = null;
      _queue = null;
      rethrow;
    }
  }

  static Future<bool> publishSensorData({
    required String userId,
    required String deviceId,
    required List<Map<String, dynamic>> readings,
  }) async {
    if (readings.isEmpty) return false;

    try {
      await _connect();

      final payload = {
        'user_id': userId,
        'device_id': deviceId,
        'source': 'polar_ble',
        'readings': readings,
      };

      final messageStr = json.encode(payload);
      
      // Publish message secara persistent
      _queue?.publish(messageStr, properties: MessageProperties()
        ..deliveryMode = 2 // Persistent delivery mode
      );

      debugPrint('[RmqService] Published ${readings.length} readings to RMQ');
      return true;
    } catch (e) {
      debugPrint('[RmqService] Publish error: $e');
      return false;
    }
  }

  static Future<void> disconnect() async {
    await _channel?.close();
    await _client?.close();
    _channel = null;
    _client = null;
    _queue = null;
    debugPrint('[RmqService] Disconnected from RabbitMQ');
  }
}
