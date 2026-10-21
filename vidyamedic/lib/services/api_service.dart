import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'api_config.dart';

class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? message;
  final int statusCode;

  ApiResponse({
    required this.success,
    this.data,
    this.message,
    required this.statusCode,
  });

  factory ApiResponse.success(T data, {int statusCode = 200}) {
    return ApiResponse(
      success: true,
      data: data,
      statusCode: statusCode,
    );
  }

  factory ApiResponse.error(String message, {int statusCode = 400}) {
    return ApiResponse(
      success: false,
      message: message,
      statusCode: statusCode,
    );
  }
}

class ApiService {
  static const String _keyToken = 'auth_token';
  static const String _keyUserData = 'user_data';

  static String? _token;
  static Map<String, dynamic>? _currentUser;

  static String? get token => _token;
  static Map<String, dynamic>? get currentUser => _currentUser;
  static bool get isAuthenticated => _token != null && _token!.isNotEmpty;

  static Future<void> init() async {
    await ApiConfig.init();
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_keyToken);
    final userJson = prefs.getString(_keyUserData);
    if (userJson != null && userJson.isNotEmpty) {
      try {
        _currentUser = jsonDecode(userJson) as Map<String, dynamic>;
      } catch (_) {
        _currentUser = null;
      }
    }
  }

  static Future<void> saveSession(
      String token, Map<String, dynamic> user) async {
    _token = token;
    _currentUser = user;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyToken, token);
    await prefs.setString(_keyUserData, jsonEncode(user));
  }

  static Future<void> clearSession() async {
    _token = null;
    _currentUser = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyToken);
    await prefs.remove(_keyUserData);
  }

  static Map<String, String> _headers({bool withAuth = true}) {
    final headers = <String, String>{
      'Content-Type': 'application/json; charset=UTF-8',
      'Accept': 'application/json',
    };
    if (withAuth && _token != null && _token!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  static ApiResponse<T> _handleResponse<T>(
      http.Response response, T Function(dynamic) parser) {
    dynamic body;
    try {
      body = jsonDecode(utf8.decode(response.bodyBytes));
      if (response.statusCode >= 200 && response.statusCode < 300) {
        if (body is Map<String, dynamic> && body.containsKey('data')) {
          return ApiResponse.success(parser(body['data']),
              statusCode: response.statusCode);
        }
        return ApiResponse.success(parser(body),
            statusCode: response.statusCode);
      } else {
        String msg = 'Terjadi kesalahan (${response.statusCode})';
        if (body is Map<String, dynamic>) {
          msg = body['message']?.toString() ?? body['error']?.toString() ?? msg;
        }
        return ApiResponse.error(msg, statusCode: response.statusCode);
      }
    } catch (e) {
      return ApiResponse.error(
        'Respon server tidak valid: $e',
        statusCode: response.statusCode,
      );
    }
  }

  // ---------------- AUTH ENDPOINTS ----------------

  /// POST /api/patient-app/register
  static Future<ApiResponse<Map<String, dynamic>>> register({
    required String name,
    required String email,
    required String password,
    String? phoneNumber,
  }) async {
    try {
      final url = Uri.parse(ApiConfig.registerEndpoint);
      final body = {
        'name': name.trim(),
        'email': email.trim().toLowerCase(),
        'password': password,
        if (phoneNumber != null && phoneNumber.trim().isNotEmpty)
          'phone_number': phoneNumber.trim(),
      };

      final res = await http
          .post(
            url,
            headers: _headers(withAuth: false),
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 15));

      final parsed = _handleResponse<Map<String, dynamic>>(
          res, (d) => d as Map<String, dynamic>);
      if (parsed.success && parsed.data != null) {
        final token = parsed.data!['token'] as String?;
        final account =
            parsed.data!['account'] as Map<String, dynamic>? ?? parsed.data!;
        if (token != null) {
          await saveSession(token, account);
        }
      }
      return parsed;
    } catch (e) {
      return ApiResponse.error('Koneksi gagal: $e', statusCode: 0);
    }
  }

  /// POST /api/auth/signin
  static Future<ApiResponse<Map<String, dynamic>>> signin({
    required String email,
    required String password,
  }) async {
    try {
      final url = Uri.parse(ApiConfig.signinEndpoint);
      final body = {
        'email': email.trim(),
        'password': password,
      };

      final res = await http
          .post(
            url,
            headers: _headers(withAuth: false),
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 15));

      final parsed = _handleResponse<Map<String, dynamic>>(
          res, (d) => d as Map<String, dynamic>);
      if (parsed.success && parsed.data != null) {
        final token = parsed.data!['token'] as String?;
        if (token != null) {
          await saveSession(token, parsed.data!);
        }
      }
      return parsed;
    } catch (e) {
      return ApiResponse.error('Koneksi gagal: $e', statusCode: 0);
    }
  }

  /// Logout
  static Future<void> logout() async {
    await clearSession();
  }

  // ---------------- PROFILE & PREFERENCES ----------------

  /// GET /api/patient-app/profile
  static Future<ApiResponse<Map<String, dynamic>>> getProfile() async {
    try {
      final url = Uri.parse(ApiConfig.profileEndpoint);
      final res = await http
          .get(url, headers: _headers())
          .timeout(const Duration(seconds: 15));
      return _handleResponse<Map<String, dynamic>>(
          res, (d) => d as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal mengambil profil: $e', statusCode: 0);
    }
  }

  /// PATCH /api/patient-app/profile
  static Future<ApiResponse<Map<String, dynamic>>> updateProfile(
      Map<String, dynamic> data) async {
    try {
      final url = Uri.parse(ApiConfig.profileEndpoint);
      final res = await http
          .patch(
            url,
            headers: _headers(),
            body: jsonEncode(data),
          )
          .timeout(const Duration(seconds: 15));
      return _handleResponse<Map<String, dynamic>>(
          res, (d) => d as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal memperbarui profil: $e', statusCode: 0);
    }
  }

  /// GET /api/patient-app/overview
  static Future<ApiResponse<Map<String, dynamic>>> getOverview() async {
    try {
      final url = Uri.parse(ApiConfig.overviewEndpoint);
      final res = await http
          .get(url, headers: _headers())
          .timeout(const Duration(seconds: 15));
      return _handleResponse<Map<String, dynamic>>(
          res, (d) => d as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal mengambil overview: $e', statusCode: 0);
    }
  }

  // ---------------- DAILY CHECK-INS ----------------

  /// POST /api/patient-app/check-ins
  static Future<ApiResponse<Map<String, dynamic>>> createCheckIn(
      Map<String, dynamic> payload) async {
    try {
      final url = Uri.parse(ApiConfig.checkInsEndpoint);
      final res = await http
          .post(
            url,
            headers: _headers(),
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 15));
      return _handleResponse<Map<String, dynamic>>(
          res, (d) => d as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal mengirim check-in: $e', statusCode: 0);
    }
  }

  /// GET /api/patient-app/check-ins
  static Future<ApiResponse<List<dynamic>>> getCheckIns({
    String? from,
    String? to,
    int limit = 30,
    String? before,
  }) async {
    try {
      final queryParams = <String, String>{
        'limit': limit.toString(),
        if (from != null) 'from': from,
        if (to != null) 'to': to,
        if (before != null) 'before': before,
      };
      final uri = Uri.parse(ApiConfig.checkInsEndpoint)
          .replace(queryParameters: queryParams);
      final res = await http
          .get(uri, headers: _headers())
          .timeout(const Duration(seconds: 15));
      return _handleResponse<List<dynamic>>(res, (d) => d as List<dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal mengambil riwayat check-in: $e',
          statusCode: 0);
    }
  }

  /// GET /api/patient-app/check-ins/:checkInId
  static Future<ApiResponse<Map<String, dynamic>>> getCheckInById(
      String checkInId) async {
    try {
      final url = Uri.parse('${ApiConfig.checkInsEndpoint}/$checkInId');
      final res = await http
          .get(url, headers: _headers())
          .timeout(const Duration(seconds: 15));
      return _handleResponse<Map<String, dynamic>>(
          res, (d) => d as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal mengambil check-in: $e', statusCode: 0);
    }
  }

  /// DELETE /api/patient-app/check-ins/:checkInId
  static Future<ApiResponse<Map<String, dynamic>>> deleteCheckIn(
      String checkInId) async {
    try {
      final url = Uri.parse('${ApiConfig.checkInsEndpoint}/$checkInId');
      final res = await http
          .delete(url, headers: _headers())
          .timeout(const Duration(seconds: 15));
      return _handleResponse<Map<String, dynamic>>(
          res, (d) => d as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal menghapus check-in: $e', statusCode: 0);
    }
  }

  /// GET /api/patient-app/daily-summary?date=YYYY-MM-DD
  static Future<ApiResponse<Map<String, dynamic>>> getDailySummary(
      String yyyyMmDd) async {
    try {
      final uri = Uri.parse(ApiConfig.dailySummaryEndpoint)
          .replace(queryParameters: {'date': yyyyMmDd});
      final res = await http
          .get(uri, headers: _headers())
          .timeout(const Duration(seconds: 15));
      return _handleResponse<Map<String, dynamic>>(
          res, (d) => d as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal mengambil ringkasan harian: $e',
          statusCode: 0);
    }
  }

  // ---------------- EVENT MARKERS ----------------

  /// POST /api/patient-app/events
  static Future<ApiResponse<Map<String, dynamic>>> createEvent(
      Map<String, dynamic> payload) async {
    try {
      final url = Uri.parse(ApiConfig.eventsEndpoint);
      final res = await http
          .post(
            url,
            headers: _headers(),
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 15));
      return _handleResponse<Map<String, dynamic>>(
          res, (d) => d as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal membuat event: $e', statusCode: 0);
    }
  }

  /// GET /api/patient-app/events
  static Future<ApiResponse<List<dynamic>>> getEvents({
    String? from,
    String? to,
    int limit = 30,
    String? before,
  }) async {
    try {
      final queryParams = <String, String>{
        'limit': limit.toString(),
        if (from != null) 'from': from,
        if (to != null) 'to': to,
        if (before != null) 'before': before,
      };
      final uri = Uri.parse(ApiConfig.eventsEndpoint)
          .replace(queryParameters: queryParams);
      final res = await http
          .get(uri, headers: _headers())
          .timeout(const Duration(seconds: 15));
      return _handleResponse<List<dynamic>>(res, (d) => d as List<dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal mengambil riwayat event: $e',
          statusCode: 0);
    }
  }

  /// POST /api/patient-app/actions
  static Future<ApiResponse<Map<String, dynamic>>> createPatientAction(
    Map<String, dynamic> payload,
  ) async {
    try {
      final res = await http
          .post(
            Uri.parse(ApiConfig.actionsEndpoint),
            headers: _headers(),
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 15));
      return _handleResponse<Map<String, dynamic>>(
          res, (data) => data as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal mencatat tindakan: $e', statusCode: 0);
    }
  }

  /// GET patient-app/actions with optional date range and pagination.
  static Future<ApiResponse<List<dynamic>>> getPatientActions({
    String? from,
    String? to,
    int limit = 30,
    String? before,
  }) async {
    try {
      final uri = Uri.parse(ApiConfig.actionsEndpoint).replace(
        queryParameters: {
          'limit': limit.toString(),
          if (from != null) 'from': from,
          if (to != null) 'to': to,
          if (before != null) 'before': before,
        },
      );
      final res = await http
          .get(uri, headers: _headers())
          .timeout(const Duration(seconds: 15));
      return _handleResponse<List<dynamic>>(
          res, (data) => data as List<dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal mengambil riwayat tindakan: $e',
          statusCode: 0);
    }
  }

  /// PATCH /api/patient-app/actions/:id/status
  static Future<ApiResponse<Map<String, dynamic>>> updatePatientActionStatus({
    required String actionId,
    required String status,
  }) async {
    try {
      final res = await http
          .patch(
            Uri.parse('${ApiConfig.actionsEndpoint}/$actionId/status'),
            headers: _headers(),
            body: jsonEncode({'status': status}),
          )
          .timeout(const Duration(seconds: 15));
      return _handleResponse<Map<String, dynamic>>(
          res, (data) => data as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal memperbarui status tindakan: $e',
          statusCode: 0);
    }
  }

  /// GET /api/patient-app/impact-summary
  static Future<ApiResponse<Map<String, dynamic>>> getPatientImpactSummary({
    String? from,
    String? to,
  }) async {
    try {
      final uri = Uri.parse(ApiConfig.impactSummaryEndpoint).replace(
        queryParameters: {
          if (from != null) 'from': from,
          if (to != null) 'to': to,
        },
      );
      final res = await http
          .get(uri, headers: _headers())
          .timeout(const Duration(seconds: 15));
      return _handleResponse<Map<String, dynamic>>(
          res, (data) => data as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal mengambil ringkasan dampak: $e',
          statusCode: 0);
    }
  }

  /// GET /api/patient-app/scenarios
  static Future<ApiResponse<List<dynamic>>> getPatientScenarios() async {
    try {
      final res = await http
          .get(Uri.parse(ApiConfig.scenariosEndpoint), headers: _headers())
          .timeout(const Duration(seconds: 15));
      return _handleResponse<List<dynamic>>(
        res,
        (data) => data as List<dynamic>,
      );
    } catch (e) {
      return ApiResponse.error('Gagal mengambil skenario HCI: $e',
          statusCode: 0);
    }
  }

  /// POST /api/patient-app/scenarios/:scenarioId/sessions
  static Future<ApiResponse<Map<String, dynamic>>> startPatientScenario({
    required String scenarioId,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse('${ApiConfig.scenariosEndpoint}/$scenarioId/sessions'),
            headers: _headers(),
            body: jsonEncode({'consent_given': true}),
          )
          .timeout(const Duration(seconds: 20));
      return _handleResponse<Map<String, dynamic>>(
        res,
        (data) => data as Map<String, dynamic>,
      );
    } catch (e) {
      return ApiResponse.error('Gagal memulai sesi skenario: $e',
          statusCode: 0);
    }
  }

  /// GET /api/patient-app/scenario-sessions
  static Future<ApiResponse<List<dynamic>>> getPatientScenarioSessions() async {
    try {
      final res = await http
          .get(Uri.parse(ApiConfig.scenarioSessionsEndpoint),
              headers: _headers())
          .timeout(const Duration(seconds: 15));
      return _handleResponse<List<dynamic>>(
        res,
        (data) => data as List<dynamic>,
      );
    } catch (e) {
      return ApiResponse.error('Gagal mengambil riwayat skenario: $e',
          statusCode: 0);
    }
  }

  /// GET /api/patient-app/scenario-sessions/:sessionId
  static Future<ApiResponse<Map<String, dynamic>>> getPatientScenarioSession(
      String sessionId) async {
    try {
      final res = await http
          .get(
            Uri.parse('${ApiConfig.scenarioSessionsEndpoint}/$sessionId'),
            headers: _headers(),
          )
          .timeout(const Duration(seconds: 15));
      return _handleResponse<Map<String, dynamic>>(
        res,
        (data) => data as Map<String, dynamic>,
      );
    } catch (e) {
      return ApiResponse.error('Gagal mengambil sesi skenario: $e',
          statusCode: 0);
    }
  }

  /// POST /api/patient-app/scenario-sessions/:sessionId/events
  static Future<ApiResponse<Map<String, dynamic>>> submitPatientScenarioEvent({
    required String sessionId,
    required Map<String, dynamic> payload,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse(
                '${ApiConfig.scenarioSessionsEndpoint}/$sessionId/events'),
            headers: _headers(),
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 20));
      return _handleResponse<Map<String, dynamic>>(
        res,
        (data) => data as Map<String, dynamic>,
      );
    } catch (e) {
      return ApiResponse.error('Gagal mencatat feedback skenario: $e',
          statusCode: 0);
    }
  }

  /// GET /api/patient-app/scenario-sessions/:sessionId/events
  static Future<ApiResponse<List<dynamic>>> getPatientScenarioEvents(
      String sessionId) async {
    try {
      final res = await http
          .get(
            Uri.parse(
                '${ApiConfig.scenarioSessionsEndpoint}/$sessionId/events'),
            headers: _headers(),
          )
          .timeout(const Duration(seconds: 15));
      return _handleResponse<List<dynamic>>(
        res,
        (data) => data as List<dynamic>,
      );
    } catch (e) {
      return ApiResponse.error('Gagal mengambil audit trail skenario: $e',
          statusCode: 0);
    }
  }

  /// GET /api/patient-app/scenario-sessions/:sessionId/questionnaires
  static Future<ApiResponse<List<dynamic>>> getPatientScenarioQuestionnaires(
      String sessionId) async {
    try {
      final res = await http
          .get(
            Uri.parse(
                '${ApiConfig.scenarioSessionsEndpoint}/$sessionId/questionnaires'),
            headers: _headers(),
          )
          .timeout(const Duration(seconds: 15));
      return _handleResponse<List<dynamic>>(
        res,
        (data) => data as List<dynamic>,
      );
    } catch (e) {
      return ApiResponse.error('Gagal mengambil kuesioner skenario: $e',
          statusCode: 0);
    }
  }

  /// POST /api/patient-app/scenario-sessions/:sessionId/questionnaires
  static Future<ApiResponse<Map<String, dynamic>>>
      submitPatientScenarioQuestionnaire({
    required String sessionId,
    required String instrument,
    required Object responses,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse(
                '${ApiConfig.scenarioSessionsEndpoint}/$sessionId/questionnaires'),
            headers: _headers(),
            body: jsonEncode({
              'instrument': instrument,
              'responses': responses,
            }),
          )
          .timeout(const Duration(seconds: 20));
      return _handleResponse<Map<String, dynamic>>(
        res,
        (data) => data as Map<String, dynamic>,
      );
    } catch (e) {
      return ApiResponse.error('Gagal menyimpan kuesioner skenario: $e',
          statusCode: 0);
    }
  }

  /// PATCH /api/patient-app/scenario-sessions/:sessionId/complete
  static Future<ApiResponse<Map<String, dynamic>>> completePatientScenario(
      String sessionId) async {
    try {
      final res = await http
          .patch(
            Uri.parse(
                '${ApiConfig.scenarioSessionsEndpoint}/$sessionId/complete'),
            headers: _headers(),
          )
          .timeout(const Duration(seconds: 15));
      return _handleResponse<Map<String, dynamic>>(
        res,
        (data) => data as Map<String, dynamic>,
      );
    } catch (e) {
      return ApiResponse.error('Gagal menyelesaikan sesi skenario: $e',
          statusCode: 0);
    }
  }

  // ---------------- WEARABLE BRIDGE ----------------

  /// POST /api/patient-app/wearable/samples
  static Future<ApiResponse<Map<String, dynamic>>> createWearableSample(
      Map<String, dynamic> payload) async {
    try {
      final url = Uri.parse(ApiConfig.wearableSamplesEndpoint);
      final res = await http
          .post(
            url,
            headers: _headers(),
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 15));
      return _handleResponse<Map<String, dynamic>>(
          res, (d) => d as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal mengirim sampel wearable: $e',
          statusCode: 0);
    }
  }

  /// POST /api/patient-app/wearable/stream
  static Future<ApiResponse<Map<String, dynamic>>> streamWearableReadings(
    Map<String, dynamic> payload,
  ) async {
    try {
      final url = Uri.parse(ApiConfig.wearableStreamEndpoint);
      final res = await http
          .post(url, headers: _headers(), body: jsonEncode(payload))
          .timeout(const Duration(seconds: 15));
      return _handleResponse<Map<String, dynamic>>(
          res, (d) => d as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal meneruskan streaming wearable: $e',
          statusCode: 0);
    }
  }

  /// POST /api/patient-app/chat/gemini
  static Future<ApiResponse<String>> generatePersonalChatAnswer({
    required String question,
    required List<Map<String, dynamic>> evidence,
    required String localSummary,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse(ApiConfig.personalChatGeminiEndpoint),
            headers: _headers(),
            body: jsonEncode({
              'question': question,
              'evidence': evidence,
              'local_summary': localSummary,
            }),
          )
          .timeout(const Duration(seconds: 30));
      return _handleResponse<String>(
        res,
        (data) {
          if (data is! Map<String, dynamic> ||
              data['answer'] is! String ||
              (data['answer'] as String).trim().isEmpty) {
            throw const FormatException('Jawaban Gemini tidak valid.');
          }
          return (data['answer'] as String).trim();
        },
      );
    } catch (error) {
      return ApiResponse.error(
        'Tidak dapat menghubungi Gemini: $error',
        statusCode: 0,
      );
    }
  }

  /// GET /api/patient-app/wearable/samples
  static Future<ApiResponse<List<dynamic>>> getWearableSamples({
    String? from,
    String? to,
    int limit = 30,
    String? before,
  }) async {
    try {
      final queryParams = <String, String>{
        'limit': limit.toString(),
        if (from != null) 'from': from,
        if (to != null) 'to': to,
        if (before != null) 'before': before,
      };
      final uri = Uri.parse(ApiConfig.wearableSamplesEndpoint)
          .replace(queryParameters: queryParams);
      final res = await http
          .get(uri, headers: _headers())
          .timeout(const Duration(seconds: 15));
      return _handleResponse<List<dynamic>>(res, (d) => d as List<dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal mengambil sampel wearable: $e',
          statusCode: 0);
    }
  }

  static Future<ApiResponse<Map<String, dynamic>>> getGamification() async {
    try {
      final res = await http
          .get(Uri.parse(ApiConfig.gamificationEndpoint), headers: _headers())
          .timeout(const Duration(seconds: 15));
      return _handleResponse<Map<String, dynamic>>(
        res,
        (data) => data as Map<String, dynamic>,
      );
    } catch (e) {
      return ApiResponse.error('Gagal mengambil data gamifikasi: $e',
          statusCode: 0);
    }
  }

  static Future<ApiResponse<Map<String, dynamic>>> updateGamification(
    Map<String, dynamic> settings,
  ) async {
    try {
      final res = await http
          .patch(
            Uri.parse(ApiConfig.gamificationEndpoint),
            headers: _headers(),
            body: jsonEncode(settings),
          )
          .timeout(const Duration(seconds: 15));
      return _handleResponse<Map<String, dynamic>>(
        res,
        (data) => data as Map<String, dynamic>,
      );
    } catch (e) {
      return ApiResponse.error('Gagal menyimpan pengaturan gamifikasi: $e',
          statusCode: 0);
    }
  }

  /// GET /api/patient-app/wearable/history
  static Future<ApiResponse<List<dynamic>>> getWearableHistory({
    required DateTime from,
    required DateTime to,
    int bucketMinutes = 60,
  }) async {
    try {
      final queryParams = <String, String>{
        'from': from.toUtc().toIso8601String(),
        'to': to.toUtc().toIso8601String(),
        'bucket_minutes': bucketMinutes.toString(),
      };
      final uri = Uri.parse(ApiConfig.wearableHistoryEndpoint)
          .replace(queryParameters: queryParams);
      final res = await http
          .get(uri, headers: _headers())
          .timeout(const Duration(seconds: 20));
      return _handleResponse<List<dynamic>>(res, (d) => d as List<dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal mengambil riwayat wearable: $e',
          statusCode: 0);
    }
  }

  // ---------------- CAPAR INSIGHTS & LINKING ----------------

  /// POST /api/patient-app/link-capar-account
  static Future<ApiResponse<Map<String, dynamic>>> linkCaparAccount(
      {required String patientPassword}) async {
    try {
      final url = Uri.parse(ApiConfig.linkCaparAccountEndpoint);
      final res = await http
          .post(
            url,
            headers: _headers(),
            body: jsonEncode({'patient_password': patientPassword}),
          )
          .timeout(const Duration(seconds: 15));
      return _handleResponse<Map<String, dynamic>>(
          res, (d) => d as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal menautkan akun CAPAR: $e', statusCode: 0);
    }
  }

  /// GET /api/patient-app/capar-insights
  static Future<ApiResponse<Map<String, dynamic>>> getCaparInsights() async {
    try {
      final url = Uri.parse(ApiConfig.caparInsightsEndpoint);
      final res = await http
          .get(url, headers: _headers())
          .timeout(const Duration(seconds: 20));
      return _handleResponse<Map<String, dynamic>>(
          res, (d) => d as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal mengambil analisis CAPAR: $e',
          statusCode: 0);
    }
  }

  /// GET /api/patient-app/capar-history
  static Future<ApiResponse<Map<String, dynamic>>> getCaparHistory({
    String category = 'all',
    String? before,
    int limit = 25,
  }) async {
    try {
      final query = <String, String>{
        'category': category,
        'limit': '$limit',
        if (before != null) 'before': before,
      };
      final url = Uri.parse(ApiConfig.caparHistoryEndpoint)
          .replace(queryParameters: query);
      final res = await http
          .get(url, headers: _headers())
          .timeout(const Duration(seconds: 20));
      return _handleResponse<Map<String, dynamic>>(
          res, (data) => data as Map<String, dynamic>);
    } catch (e) {
      return ApiResponse.error('Gagal mengambil histori CAPAR: $e',
          statusCode: 0);
    }
  }
}
