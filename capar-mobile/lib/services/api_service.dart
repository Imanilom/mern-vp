import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class ApiService {
  // Gunakan 10.0.2.2 untuk Android Emulator, localhost untuk Desktop/Web/iOS Simulator
  static String get baseUrl {
    if (kIsWeb) return 'http://localhost:3030/api';
    return 'http://10.0.2.2:3030/api';
  }

  static Future<bool> login(String email, String password) async {
    // Dummy login implementation
    await Future.delayed(const Duration(seconds: 1));
    return email.isNotEmpty && password.isNotEmpty;
  }

  // Health check
  static Future<bool> checkHealth() async {
    try {
      final response = await http
          .get(Uri.parse('$baseUrl/health'))
          .timeout(const Duration(seconds: 4));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['success'] == true;
      }
    } catch (e) {
      debugPrint('[ApiService] Health check error: $e');
    }
    return false;
  }

  // Fetch episodes / events untuk user
  static Future<List<Map<String, dynamic>>> fetchEpisodes({String userId = 'P-014'}) async {
    try {
      final response = await http
          .get(Uri.parse('$baseUrl/analysis/events/$userId'))
          .timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['data'] is List) {
          return List<Map<String, dynamic>>.from(data['data']);
        }
      }
    } catch (e) {
      debugPrint('[ApiService] Fetch episodes error: $e');
    }
    return [];
  }

  // Fetch forecast / prediksi state
  static Future<Map<String, dynamic>?> fetchForecast({String userId = 'P-014'}) async {
    try {
      final response = await http
          .get(Uri.parse('$baseUrl/analysis/forecast/$userId'))
          .timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true) {
          return data['data'] as Map<String, dynamic>?;
        }
      }
    } catch (e) {
      debugPrint('[ApiService] Fetch forecast error: $e');
    }
    return null;
  }

  // Send sensor data to backend (RabbitMQ Transport)
  static Future<bool> sendSensorData({
    required String userId,
    required String deviceId,
    required List<Map<String, dynamic>> readings,
  }) async {
    if (readings.isEmpty) return false;

    try {
      final payload = {
        'userId': userId,
        'deviceId': deviceId,
        'source': 'polar_ble',
        'readings': readings,
      };

      final response = await http
          .post(
            Uri.parse('$baseUrl/log/transport'),
            headers: {'Content-Type': 'application/json'},
            body: json.encode(payload),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['success'] == true;
      }
    } catch (e) {
      debugPrint('[ApiService] Send sensor data error: $e');
    }
    return false;
  }

  // Fetch signal quality
  static Future<Map<String, dynamic>?> fetchSignalQuality({String userId = 'P-014'}) async {
    try {
      final response = await http
          .get(Uri.parse('$baseUrl/analysis/signal-quality/$userId'))
          .timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true) {
          return data['data'] as Map<String, dynamic>?;
        }
      }
    } catch (e) {
      debugPrint('[ApiService] Fetch signal quality error: $e');
    }
    return null;
  }

  // Submit EMA Annotation
  static Future<bool> submitEMA(String eventId, String annotation) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/analysis/events/$eventId/annotate'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'text': annotation, 'timestamp': DateTime.now().millisecondsSinceEpoch}),
      ).timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['success'] == true;
      }
    } catch (e) {
      debugPrint('[ApiService] Submit EMA error: $e');
    }
    return false;
  }

  // Sync user notification & prompt preferences to API
  static Future<bool> updateUserPreferences(Map<String, dynamic> preferences) async {
    try {
      final response = await http.patch(
        Uri.parse('$baseUrl/user/preferences'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(preferences),
      ).timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['success'] == true;
      }
    } catch (e) {
      debugPrint('[ApiService] Update preferences error: $e');
    }
    return false;
  }
}
