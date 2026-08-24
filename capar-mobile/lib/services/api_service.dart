import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String baseUrl = 'https://healthtrajectory.cloud/api';

  /// Mengambil userId yang tersimpan dari SharedPreferences.
  /// Jika belum set, default fallback ke User Dokter (675ba1e92b8428e4dd641cd0).
  static Future<String> _getUserId() async {
    final prefs = await SharedPreferences.getInstance();
    final uid = prefs.getString('user_id') ?? '';
    if (uid.isNotEmpty) return uid;
    return '675ba1e92b8428e4dd641cd0';
  }

  /// Menyiapkan header HTTP termasuk Bearer token jika pengguna sudah login.
  static Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token') ?? '';
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    if (token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
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
      final headers = await _getHeaders();
      
      final response = await http
          .get(Uri.parse('$baseUrl/log/mobile-status?user_id=$uid'), headers: headers)
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

  // Fetch episodes / events untuk user (EpisodeAnalysis & AnomalyEvent)
  static Future<List<Map<String, dynamic>>> fetchEpisodes({String? userId}) async {
    try {
      final uid = userId ?? await _getUserId();
      final headers = await _getHeaders();

      // Coba fetch dari endpoint episode-analysis terlebih dahulu
      final epResponse = await http
          .get(Uri.parse('$baseUrl/analysis/episode-analysis/$uid'), headers: headers)
          .timeout(const Duration(seconds: 5));

      if (epResponse.statusCode == 200) {
        final data = json.decode(epResponse.body);
        if (data['success'] == true && data['data'] is List) {
          final list = List<Map<String, dynamic>>.from(data['data']);
          if (list.isNotEmpty) return list;
        }
      }

      // Fallback ke endpoint /analysis/events/$uid dengan limit lebih besar
      final evResponse = await http
          .get(Uri.parse('$baseUrl/analysis/events/$uid?limit=100'), headers: headers)
          .timeout(const Duration(seconds: 8));
      if (evResponse.statusCode == 200) {
        final data = json.decode(evResponse.body);
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
      final headers = await _getHeaders();
      final response = await http
          .get(Uri.parse('$baseUrl/analysis/forecast/$uid'), headers: headers)
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

  // Fetch Markov Transition Model & Horizon prediction
  static Future<Map<String, dynamic>?> fetchMarkovModel({String? userId, int horizon = 3}) async {
    try {
      final uid = userId ?? await _getUserId();
      final headers = await _getHeaders();
      final response = await http
          .get(Uri.parse('$baseUrl/analysis/markov/$uid?horizon=$horizon'), headers: headers)
          .timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['status'] == 'READY' || data['matrix'] != null) {
          return data as Map<String, dynamic>?;
        }
      }
    } catch (e) {
      debugPrint('[ApiService] Fetch markov model error: $e');
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
      final headers = await _getHeaders();
      final payload = {
        'userId': userId,
        'deviceId': deviceId,
        'source': 'polar_ble',
        'readings': readings,
      };

      final response = await http
          .post(
            Uri.parse('$baseUrl/log/transport'),
            headers: headers,
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
      final headers = await _getHeaders();
      final response = await http
          .get(Uri.parse('$baseUrl/analysis/signal-quality/$uid'), headers: headers)
          .timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['data'] != null) {
          return data['data'] as Map<String, dynamic>;
        }
      }
    } catch (e) {
      debugPrint('[ApiService] Fetch signal quality error: $e');
    }
    return null;
  }

  // Fetch user preference values
  static Future<Map<String, dynamic>?> fetchPreferences() async {
    try {
      final uid = await _getUserId();
      final headers = await _getHeaders();
      final response = await http
          .get(Uri.parse('$baseUrl/auth/preferences/$uid'), headers: headers)
          .timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['preferences'] != null) {
          return data['preferences'] as Map<String, dynamic>;
        }
      }
    } catch (e) {
      debugPrint('[ApiService] Fetch preferences error: $e');
    }
    return null;
  }

  // Update user preference values
  static Future<bool> updatePreferences(Map<String, dynamic> prefs) async {
    try {
      final uid = await _getUserId();
      final headers = await _getHeaders();
      final response = await http
          .put(
            Uri.parse('$baseUrl/auth/preferences/$uid'),
            headers: headers,
            body: json.encode({'preferences': prefs}),
          )
          .timeout(const Duration(seconds: 5));
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('[ApiService] Update preferences error: $e');
    }
    return false;
  }

  static Future<bool> updateUserPreferences(Map<String, dynamic> prefs) => updatePreferences(prefs);

  // Fetch baseline readiness & provisional metrics
  static Future<Map<String, dynamic>?> fetchBaselineReadiness({String? userId}) async {
    try {
      final uid = userId ?? await _getUserId();
      final headers = await _getHeaders();

      final response = await http
          .get(Uri.parse('$baseUrl/analysis/baseline/$uid'), headers: headers)
          .timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['data'] != null) {
          List<Map<String, dynamic>> list = [];
          if (data['data'] is List) {
            list = List<Map<String, dynamic>>.from(data['data']);
          } else if (data['data'] is Map<String, dynamic>) {
            list = [data['data'] as Map<String, dynamic>];
          }

          if (list.isNotEmpty) {
            int totalSegs = 0;
            for (final b in list) {
              totalSegs += (b['segment_count'] as int? ?? 0);
            }
            final first = Map<String, dynamic>.from(list.first);
            first['all_baselines'] = list;
            first['total_segment_count'] = totalSegs > 0 ? totalSegs : (first['segment_count'] ?? 0);
            return first;
          }
        }
      }
    } catch (e) {
      debugPrint('[ApiService] Fetch baseline readiness error: $e');
    }
    return null;
  }

  // Fetch RR / Analyzed Segments list for baseline audit
  static Future<List<Map<String, dynamic>>> fetchRRSegments({String? userId, int limit = 50}) async {
    try {
      final uid = userId ?? await _getUserId();
      final headers = await _getHeaders();

      final response = await http
          .get(Uri.parse('$baseUrl/analysis/rr/segments/$uid?limit=$limit'), headers: headers)
          .timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['data'] is List) {
          return List<Map<String, dynamic>>.from(data['data']);
        }
      }
    } catch (e) {
      debugPrint('[ApiService] Fetch RR segments error: $e');
    }
    return [];
  }

  // Submit EMA 1–4 survey response to MongoDB backend
  static Future<bool> submitEma(Map<String, dynamic> payload) async {
    try {
      final uid = await _getUserId();
      final headers = await _getHeaders();
      if (uid.isNotEmpty) {
        payload['user_id'] = uid;
      }
      final response = await http
          .post(
            Uri.parse('$baseUrl/analysis/ema'),
            headers: headers,
            body: json.encode(payload),
          )
          .timeout(const Duration(seconds: 5));
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('[ApiService] Submit EMA error: $e');
    }
    return false;
  }

  // Fetch Baseline Calibration History
  static Future<List<Map<String, dynamic>>> fetchCalibrationHistory({String? userId}) async {
    try {
      final uid = userId ?? await _getUserId();
      final headers = await _getHeaders();

      final response = await http
          .get(Uri.parse('$baseUrl/analysis/calibration-history/$uid'), headers: headers)
          .timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['data'] is List) {
          return List<Map<String, dynamic>>.from(data['data']);
        }
      }
    } catch (e) {
      debugPrint('[ApiService] Fetch calibration history error: $e');
    }
    return [];
  }

  // Fetch Personal Experience Memory & Gamification metrics
  static Future<Map<String, dynamic>?> fetchPersonalExperience({String? userId}) async {
    try {
      final uid = userId ?? await _getUserId();
      final headers = await _getHeaders();
      final target = uid.isNotEmpty ? uid : 'ALL';

      final response = await http
          .get(Uri.parse('$baseUrl/analysis/experience/$target'), headers: headers)
          .timeout(const Duration(seconds: 5));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['data'] != null) {
          return data['data'] as Map<String, dynamic>;
        }
      }
    } catch (e) {
      debugPrint('[ApiService] Fetch personal experience error: $e');
    }
    return null;
  }
}
