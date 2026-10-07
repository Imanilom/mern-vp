import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiConfig {
  static const String _keyCustomBaseUrl = 'vidyamedic_api_base_url';
  static const String _legacyCustomBaseUrlKey =
      'https://healthtrajectory.cloud/api';
  static const String _productionBaseUrl = 'https://healthtrajectory.cloud/api';

  // Default base URLs depending on runtime environment
  static String get defaultBaseUrl {
    if (kIsWeb) {
      return _productionBaseUrl;
    }
    try {
      if (Platform.isAndroid) {
        return _productionBaseUrl;
      }
    } catch (_) {}
    return 'http://localhost:3030/api';
  }

  static String _baseUrl = '';

  static String get baseUrl {
    if (_baseUrl.isNotEmpty) return _baseUrl;
    return defaultBaseUrl;
  }

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final customUrl = prefs.getString(_keyCustomBaseUrl) ??
        prefs.getString(_legacyCustomBaseUrlKey);
    if (customUrl != null &&
        customUrl.trim().isNotEmpty &&
        !_isAndroidLoopbackUrl(customUrl)) {
      _baseUrl = _normalizeBaseUrl(customUrl);
      await prefs.setString(_keyCustomBaseUrl, _baseUrl);
      await prefs.remove(_legacyCustomBaseUrlKey);
    } else {
      _baseUrl = defaultBaseUrl;
      if (_isAndroidPlatform) {
        await prefs.remove(_keyCustomBaseUrl);
        await prefs.remove(_legacyCustomBaseUrlKey);
      }
    }
  }

  static Future<void> setBaseUrl(String newUrl) async {
    final prefs = await SharedPreferences.getInstance();
    _baseUrl = _normalizeBaseUrl(newUrl);
    await prefs.setString(_keyCustomBaseUrl, _baseUrl);
    await prefs.remove(_legacyCustomBaseUrlKey);
  }

  static Future<void> resetBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyCustomBaseUrl);
    await prefs.remove(_legacyCustomBaseUrlKey);
    _baseUrl = defaultBaseUrl;
  }

  static String _normalizeBaseUrl(String value) {
    var cleanUrl = value.trim();
    while (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.substring(0, cleanUrl.length - 1);
    }
    if (cleanUrl.isEmpty) {
      throw const FormatException('URL backend tidak boleh kosong.');
    }
    return cleanUrl.endsWith('/api') ? cleanUrl : '$cleanUrl/api';
  }

  static bool get _isAndroidPlatform {
    if (kIsWeb) return false;
    try {
      return Platform.isAndroid;
    } catch (_) {
      return false;
    }
  }

  static bool _isAndroidLoopbackUrl(String value) {
    if (!_isAndroidPlatform) return false;
    final uri = Uri.tryParse(value.trim());
    return uri != null &&
        (uri.host == 'localhost' ||
            uri.host == '127.0.0.1' ||
            uri.host == '10.0.2.2');
  }

  // Endpoints as specified in patient-app-api.md
  static String get registerEndpoint => '$baseUrl/patient-app/register';
  static String get signinEndpoint => '$baseUrl/auth/signin';
  static String get profileEndpoint => '$baseUrl/patient-app/profile';
  static String get overviewEndpoint => '$baseUrl/patient-app/overview';
  static String get dailySummaryEndpoint =>
      '$baseUrl/patient-app/daily-summary';
  static String get caparInsightsEndpoint =>
      '$baseUrl/patient-app/capar-insights';
  static String get linkCaparAccountEndpoint =>
      '$baseUrl/patient-app/link-capar-account';
  static String get checkInsEndpoint => '$baseUrl/patient-app/check-ins';
  static String get eventsEndpoint => '$baseUrl/patient-app/events';
  static String get wearableSamplesEndpoint =>
      '$baseUrl/patient-app/wearable/samples';
  static String get wearableHistoryEndpoint =>
      '$baseUrl/patient-app/wearable/history';
  static String get wearableStreamEndpoint =>
      '$baseUrl/patient-app/wearable/stream';
}
