import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'env_config.dart';

class AuthService {
  static String get baseUrl => EnvConfig.apiBaseUrl;

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('authToken');

    if (token != null) {
      try {
        // Call server logout endpoint
        await http.get(
          Uri.parse('$baseUrl/auth/signout'),
          headers: {
            'Authorization': 'Bearer $token',
            'ngrok-skip-browser-warning': 'true',
          },
        );
      } catch (e) {
        // Ignore errors during logout
      }
    }

    // Clear local storage
    await prefs.remove('isLoggedIn');
    await prefs.remove('authToken');
    await prefs.remove('username');
    await prefs.remove('userEmail');
    await prefs.remove('userId');
    await prefs.remove('loginTime');
  }

  static Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    final isLoggedIn = prefs.getBool('isLoggedIn') ?? false;
    final userId = prefs.getString('userId');

    return isLoggedIn && userId != null && userId.isNotEmpty;
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('authToken');
  }

  static Future<String?> getUsername() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('username');
  }

  /// Mengembalikan MongoDB ObjectId user yang sedang login.
  /// Digunakan untuk disertakan sebagai kolom user_id di CSV upload.
  static Future<String?> getUserId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('userId');
  }

  /// Menyimpan data session user setelah login berhasil.
  static Future<void> saveSession({
    required String userId,
    required String username,
    required String email,
    String? token,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('isLoggedIn', true);
    await prefs.setString('userId', userId);
    await prefs.setString('username', username);
    await prefs.setString('userEmail', email);
    if (token != null) {
      await prefs.setString('authToken', token);
    }
    await prefs.setInt('loginTime', DateTime.now().millisecondsSinceEpoch);
  }
}