import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String baseUrl = 'https://healthtrajectory.cloud/api';

  /// Mengambil userId yang tersimpan dari SharedPreferences.
  /// Mengembalikan string kosong jika belum login.
  static Future<String> _getUserId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('user_id') ?? '';
  }

  static Future<bool> login(String email, String password) async {
    try {
      final response = await http
          .post(
            Uri.parse('$baseUrl/auth/signin'),
            headers: {'Content-Type': 'application/json'},
            body: json.encode({'email': email, 'password': password}),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final userId = data['_id'];
        final token = data['token'];

        if (userId != null) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('user_id', userId.toString());
          if (token != null) {
            await prefs.setString('token', token.toString());
          }
          return true;
        }
      }
    } catch (e) {
      debugPrint('[ApiService] Login error: $e');
    }
    return false;
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

  // Cek status sinkronisasi MongoDB di VPS
  static Future<Map<String, dynamic>?> fetchMobileStatus() async {
    try {
      final uid = await _getUserId();
      if (uid.isEmpty) return null;
      
      final response = await http
          .get(Uri.parse('$baseUrl/log/mobile-status?user_id=$uid'))
          .timeout(const Duration(seconds: 5));
          
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['summary'] != null) {
          final summaryList = data['summary'] as List;
          if (summaryList.isNotEmpty) return summaryList.first;
        }
      }
    } catch (e) {
      debugPrint('[ApiService] Fetch mobile status error: $e');
    }
    return null;
  }

  // Fetch episodes / events untuk user
  static Future<List<Map<String, dynamic>>> fetchEpisodes({String? userId}) async {
    try {
      final uid = userId ?? await _getUserId();
      if (uid.isEmpty) {
        debugPrint('[ApiService] fetchEpisodes: userId kosong, skip request.');
        return [];
      }
      final response = await http
          .get(Uri.parse('$baseUrl/analysis/events/$uid'))
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
  static Future<Map<String, dynamic>?> fetchForecast({String? userId}) async {
    try {
      final uid = userId ?? await _getUserId();
      if (uid.isEmpty) {
        debugPrint('[ApiService] fetchForecast: userId kosong, skip request.');
        return null;
      }
      final response = await http
          .get(Uri.parse('$baseUrl/analysis/forecast/$uid'))
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
  static Future<Map<String, dynamic>?> fetchSignalQuality({String? userId}) async {
    try {
      final uid = userId ?? await _getUserId();
      if (uid.isEmpty) {
        debugPrint('[ApiService] fetchSignalQuality: userId kosong, skip request.');
        return null;
      }
      final response = await http
          .get(Uri.parse('$baseUrl/analysis/signal-quality/$uid'))
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
