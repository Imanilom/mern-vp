import 'dart:convert';
import 'package:dart_amqp/dart_amqp.dart';
import 'package:flutter/foundation.dart';

/// RmqService — Transport AMQP native menggunakan dart_amqp.
///
/// ⚠️  CATATAN: Service ini adalah alternatif AMQP dan saat ini TIDAK aktif digunakan.
///     Transport utama sensor data menggunakan [MqttService] (MQTT over RabbitMQ).
///     File ini dipertahankan sebagai fallback jika koneksi MQTT tidak tersedia.
///
/// Alur (bila diaktifkan):
///   Polar H10 → BleService → TelemetryController → RmqService → RabbitMQ
///   → Queue 'Sensor' → logTransport (Node.js) → MongoDB
class RmqService {
  static Client? _client;
  static Channel? _channel;
  static Queue? _queue;

  /// Konfigurasi koneksi ke broker RabbitMQ produksi.
  /// Menggunakan AMQP port 5672 dengan vhost /polar.
  static final ConnectionSettings _settings = ConnectionSettings(
    host: 'rmq230.smartsystem.id',
    port: 5672,
    virtualHost: '/polar',
    authProvider: const PlainAuthenticator('anomali', 'anomali123'),
  );

  static const String _queueName = 'Sensor';

  static Future<void> _connect() async {
    if (_client != null && _channel != null && _queue != null) return;

    try {
      _client = Client(settings: _settings);
      _channel = await _client!.channel();

      // Pastikan queue exist dan persistent (mirroring dengan konfigurasi MQTT broker)
      _queue = await _channel!.queue(_queueName, durable: true);
      debugPrint('[RmqService] Connected to RabbitMQ AMQP on ${_settings.host}');
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
        'source': 'polar_ble_amqp',
        'readings': readings,
      };

      final messageStr = json.encode(payload);

      // Publish message secara persistent agar tidak hilang jika broker restart
      _queue?.publish(
        messageStr,
        properties: MessageProperties()..deliveryMode = 2,
      );

      debugPrint('[RmqService] Published ${readings.length} readings via AMQP');
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
    debugPrint('[RmqService] Disconnected from RabbitMQ AMQP');
  }
}
