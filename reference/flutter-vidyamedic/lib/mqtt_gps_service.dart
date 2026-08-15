import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:geolocator/geolocator.dart';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MqttGpsService {
  static final MqttGpsService _instance = MqttGpsService._internal();
  factory MqttGpsService() => _instance;
  MqttGpsService._internal();

  // Configuration (RabbitMQ MQTT parameters)
  static const String brokerHost = '100.96.0.14';
  static const int brokerPort = 1883;
  static const String mqttUsername = 'anomali:/polar';
  static const String mqttPassword = 'anomali123';
  static const String clientId = '7e4fc270-1ea3-44e5-9a16-c538215338d61784169649026';
  static const String topic = 'polar/data';

  MqttServerClient? _client;
  StreamSubscription<Position>? _positionSubscription;
  Position? _lastKnownPosition;
  bool _isConnected = false;
  bool _isConnecting = false;
  int _pendingQueueCount = 0;

  // UI status update callback
  Function(bool isConnected, String? lastSent, int pendingCount)? onStatusChanged;

  bool get isConnected => _isConnected;
  Position? get lastKnownPosition => _lastKnownPosition;
  int get pendingQueueCount => _pendingQueueCount;

  // Start GPS tracking stream
  void startGpsTracking() async {
    _positionSubscription?.cancel();
    
    // Check permission (just in case)
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        print('[MqttGpsService] Location services are disabled.');
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        print('[MqttGpsService] Location permissions are denied: $permission');
        return;
      }

      print('[MqttGpsService] Starting GPS stream tracking...');
      _positionSubscription = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 1, // update every 1 meter
        ),
      ).listen((Position position) {
        _lastKnownPosition = position;
        print('[MqttGpsService] GPS Location updated: ${position.latitude}, ${position.longitude}');
        _updateStatusInPrefs();
      }, onError: (e) {
        print('[MqttGpsService] GPS Stream Error: $e');
      });
    } catch (e) {
      print('[MqttGpsService] Error starting GPS tracking: $e');
    }
  }

  void stopGpsTracking() {
    _positionSubscription?.cancel();
    _positionSubscription = null;
    _lastKnownPosition = null;
    print('[MqttGpsService] Stopped GPS tracking.');
  }

  // Connect to RabbitMQ via MQTT client
  Future<void> connectMqtt() async {
    if (_isConnected || _isConnecting) return;
    _isConnecting = true;

    _client = MqttServerClient.withPort(brokerHost, clientId, brokerPort);
    _client!.logging(on: false);
    _client!.keepAlivePeriod = 20;
    _client!.autoReconnect = true;
    _client!.onDisconnected = _onDisconnected;
    _client!.onConnected = _onConnected;
    _client!.onAutoReconnected = _onAutoReconnected;

    final connMessage = MqttConnectMessage()
        .withClientIdentifier(clientId)
        .authenticateAs(mqttUsername, mqttPassword)
        .startClean()
        .withWillQos(MqttQos.atLeastOnce);
    _client!.connectionMessage = connMessage;

    try {
      print('[MqttGpsService] Connecting to RabbitMQ at $brokerHost:$brokerPort...');
      await _client!.connect();
    } catch (e) {
      print('[MqttGpsService] MQTT Connection failed: $e');
      _onDisconnected();
    } finally {
      _isConnecting = false;
    }
  }

  void disconnectMqtt() {
    _client?.disconnect();
    _onDisconnected();
  }

  void _onConnected() {
    _isConnected = true;
    _isConnecting = false;
    print('[MqttGpsService] Connected to RabbitMQ!');
    _updateStatusInPrefs();
    _processOfflineQueue();
  }

  void _onDisconnected() {
    _isConnected = false;
    _isConnecting = false;
    print('[MqttGpsService] Disconnected from RabbitMQ.');
    _updateStatusInPrefs();
  }

  void _onAutoReconnected() {
    _isConnected = true;
    _isConnecting = false;
    print('[MqttGpsService] Auto-reconnected to RabbitMQ!');
    _updateStatusInPrefs();
    _processOfflineQueue();
  }

  Future<void> _updateStatusInPrefs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.reload(); // Sync with disk cache (vital for multi-isolate communication)
      await prefs.setBool('mqtt_connected', _isConnected);
      await prefs.setInt('mqtt_pending_count', _pendingQueueCount);
      if (_lastKnownPosition != null) {
        await prefs.setDouble('gps_latitude', _lastKnownPosition!.latitude);
        await prefs.setDouble('gps_longitude', _lastKnownPosition!.longitude);
      }
      
      final lastSent = prefs.getString('mqtt_last_sent');
      onStatusChanged?.call(_isConnected, lastSent, _pendingQueueCount);
    } catch (e) {
      print('[MqttGpsService] Error updating prefs: $e');
    }
  }

  // Publish telemetry data
  Future<bool> publishTelemetry(Map<String, dynamic> payload) async {
    // Inject coordinates if not already present
    if (payload['latitude'] == null && _lastKnownPosition != null) {
      payload['latitude'] = _lastKnownPosition!.latitude;
      payload['longitude'] = _lastKnownPosition!.longitude;
    }

    if (!_isConnected) {
      print('[MqttGpsService] MQTT not connected. Buffering to offline queue.');
      await _addToOfflineQueue(payload);
      return false;
    }

    try {
      final builder = MqttClientPayloadBuilder();
      builder.addString(jsonEncode(payload));
      _client!.publishMessage(topic, MqttQos.atLeastOnce, builder.payload!);
      
      final now = DateTime.now();
      final lastSentStr = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')} ${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}:${now.second.toString().padLeft(2, '0')}';
      
      final prefs = await SharedPreferences.getInstance();
      await prefs.reload();
      await prefs.setString('mqtt_last_sent', lastSentStr);
      
      print('[MqttGpsService] Published telemetry to $topic');
      _updateStatusInPrefs();
      return true;
    } catch (e) {
      print('[MqttGpsService] Failed to publish message: $e. Buffering to offline queue.');
      await _addToOfflineQueue(payload);
      return false;
    }
  }

  // Offline queue file management
  Future<File> get _queueFile async {
    final directory = await getApplicationDocumentsDirectory();
    return File('${directory.path}/unsent_mqtt.json');
  }

  Future<List<Map<String, dynamic>>> _readOfflineQueue() async {
    try {
      final file = await _queueFile;
      if (await file.exists()) {
        final content = await file.readAsString();
        if (content.isNotEmpty) {
          final List<dynamic> decoded = jsonDecode(content);
          return decoded.cast<Map<String, dynamic>>();
        }
      }
    } catch (e) {
      print('[MqttGpsService] Error reading offline queue: $e');
    }
    return [];
  }

  Future<void> _writeOfflineQueue(List<Map<String, dynamic>> queue) async {
    try {
      final file = await _queueFile;
      await file.writeAsString(jsonEncode(queue), flush: true);
      _pendingQueueCount = queue.length;
      await _updateStatusInPrefs();
    } catch (e) {
      print('[MqttGpsService] Error writing offline queue: $e');
    }
  }

  Future<void> _addToOfflineQueue(Map<String, dynamic> payload) async {
    final queue = await _readOfflineQueue();
    queue.add(payload);
    await _writeOfflineQueue(queue);
  }

  Future<void> _processOfflineQueue() async {
    if (!_isConnected) return;
    final queue = await _readOfflineQueue();
    if (queue.isEmpty) {
      _pendingQueueCount = 0;
      await _updateStatusInPrefs();
      return;
    }

    print('[MqttGpsService] Processing ${queue.length} offline messages...');
    final remainingQueue = List<Map<String, dynamic>>.from(queue);
    
    for (final item in queue) {
      if (!_isConnected) break;
      try {
        final builder = MqttClientPayloadBuilder();
        builder.addString(jsonEncode(item));
        _client!.publishMessage(topic, MqttQos.atLeastOnce, builder.payload!);
        
        remainingQueue.remove(item);
        print('[MqttGpsService] Successfully published queued offline message.');
      } catch (e) {
        print('[MqttGpsService] Failed to publish queued offline message: $e');
        break; // Stop loop on failure
      }
    }

    await _writeOfflineQueue(remainingQueue);
    print('[MqttGpsService] Offline queue processing finished. Remaining: ${remainingQueue.length}');
  }

  Future<void> updatePendingQueueCount() async {
    final queue = await _readOfflineQueue();
    _pendingQueueCount = queue.length;
    await _updateStatusInPrefs();
  }
}
