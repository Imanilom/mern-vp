import 'dart:convert';
import 'package:http/http.dart' as http;
import 'env_config.dart';
import 'auth_service.dart';

class ApiService {
  static String get baseUrl => EnvConfig.apiBaseUrl;

  static Future<Map<String, String>> _getHeaders() async {
    final token = await AuthService.getToken();
    return {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  /// Ambil segments terbaru untuk user
  static Future<List<dynamic>> getSegments(String userId, {int limit = 15}) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/analysis/segments/$userId?limit=$limit'),
        headers: await _getHeaders(),
      );
      if (response.statusCode == 200) {
        final res = json.decode(response.body);
        if (res['success'] == true) return res['data'] ?? [];
      }
      return [];
    } catch (e) {
      print('getSegments error: $e');
      return [];
    }
  }

  /// Ambil riwayat anomali events
  static Future<List<dynamic>> getEvents(String userId, {int limit = 20}) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/analysis/events/$userId?limit=$limit'),
        headers: await _getHeaders(),
      );
      if (response.statusCode == 200) {
        final res = json.decode(response.body);
        if (res['success'] == true) return res['data'] ?? [];
      }
      return [];
    } catch (e) {
      print('getEvents error: $e');
      return [];
    }
  }

  /// Tambahkan anotasi gejala pada event
  static Future<bool> annotateEvent(String eventId, String text) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/analysis/events/$eventId/annotate'),
        headers: await _getHeaders(),
        body: json.encode({
          'text': text,
          'timestamp': DateTime.now().millisecondsSinceEpoch,
        }),
      );
      if (response.statusCode == 200) {
        final res = json.decode(response.body);
        return res['success'] == true;
      }
      return false;
    } catch (e) {
      print('annotateEvent error: $e');
      return false;
    }
  }
}
