import 'package:flutter_dotenv/flutter_dotenv.dart';

class EnvConfig {
  static String get baseUrl => dotenv.env['BASE_URL'] ?? 'https://c0d4-182-253-124-110.ngrok-free.app';
  static String get apiBaseUrl => '$baseUrl/api';
  static String get uploadUrl => '$baseUrl/api/log/logs';
}
