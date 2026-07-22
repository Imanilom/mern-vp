import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb, debugPrint;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../shared/models/models.dart';

class ApiClient {
  late final Dio _dio;
  
  ApiClient() {
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
    ));
    
    // Add interceptor to automatically add token to request headers
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('access_token');
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
    ));
  }

  String get _baseUrl {
    if (kIsWeb) {
      return 'http://localhost:3030/api';
    } else if (Platform.isAndroid) {
      return 'http://10.0.2.2:3030/api';
    } else {
      return 'http://localhost:3030/api';
    }
  }

  // Check if user is logged in
  Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('access_token');
    final userId = prefs.getString('user_id');
    return token != null && token.isNotEmpty && userId != null && userId.isNotEmpty;
  }

  // Get stored user id
  Future<String?> getStoredUserId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('user_id');
  }

  // Sign out / Clear session
  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('user_id');
    await prefs.remove('user_name');
    await prefs.remove('user_email');
  }

  Future<bool> login({
    required String participantId,
    required String password,
    String? studyCode,
    String? pin,
  }) async {
    try {
      final response = await _dio.post('/auth/signin', data: {
        'email': participantId.trim(),
        'password': password,
      });

      if (response.statusCode == 200) {
        final data = response.data;
        final token = data['token'];
        final userId = data['_id'];
        final email = data['email'];
        final name = data['name'];

        if (token != null && userId != null) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('access_token', token);
          await prefs.setString('user_id', userId);
          if (email != null) await prefs.setString('user_email', email);
          if (name != null) await prefs.setString('user_name', name);
          return true;
        }
      }
      return false;
    } catch (e) {
      debugPrint("Login error: $e");
      return false;
    }
  }

  Future<Participant> getParticipantProfile() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final userId = prefs.getString('user_id');
      if (userId == null) {
        throw Exception("User is not authenticated");
      }

      final response = await _dio.get('/user/$userId');
      if (response.statusCode == 200) {
        final data = response.data;
        return Participant(
          id: data['_id'] ?? userId,
          name: data['name'] ?? 'Peserta HTM',
          studyCode: data['current_device'] ?? 'HTM-2026',
          pin: '******',
          birthYear: 1988,
          gender: 'Laki-laki',
          heightCm: 172.0,
          weightKg: 68.5,
          relevantCondition: data['address'] != null && data['address'].isNotEmpty 
              ? data['address'] 
              : 'Pemantauan Trajectory Pasca-Aktivitas',
          staffContact: data['phone_number'] ?? '+62 812-3456-7890 (Dr. Aris)',
        );
      }
    } catch (e) {
      debugPrint("getParticipantProfile error: $e");
    }

    // Return fallback profile using local session values if request fails, so UI doesn't crash
    final prefs = await SharedPreferences.getInstance();
    final cachedId = prefs.getString('user_id') ?? "Offline";
    final cachedName = prefs.getString('user_name') ?? "Peserta (Offline)";
    return Participant(
      id: cachedId,
      name: cachedName,
      studyCode: "HTM-2026",
      pin: "******",
      birthYear: 1990,
      gender: "Laki-laki",
      heightCm: 170.0,
      weightKg: 65.0,
      relevantCondition: "Pemantauan Trajectory Riset HTM",
      staffContact: "+62 812-3456-7890 (Staf Riset)",
    );
  }

  Future<List<ActivityItem>> getActivities() async {
    // Keeps current UI layout for activities selection
    return const [
      ActivityItem(id: "1", name: "Tidur", icon: Icons.bedtime),
      ActivityItem(id: "2", name: "Bangun tidur", icon: Icons.wb_sunny),
      ActivityItem(id: "3", name: "Duduk", icon: Icons.chair),
      ActivityItem(id: "4", name: "Duduk bekerja", icon: Icons.laptop_chromebook),
      ActivityItem(id: "5", name: "Berdiri", icon: Icons.accessibility_new),
      ActivityItem(id: "6", name: "Berjalan", icon: Icons.directions_walk),
      ActivityItem(id: "7", name: "Berkendara", icon: Icons.directions_car),
      ActivityItem(id: "8", name: "Makan", icon: Icons.restaurant),
      ActivityItem(id: "9", name: "Olahraga", icon: Icons.fitness_center),
      ActivityItem(id: "10", name: "Istirahat olahraga", icon: Icons.airline_seat_recline_extra),
      ActivityItem(id: "11", name: "Bekerja", icon: Icons.work),
      ActivityItem(id: "12", name: "Aktivitas mendadak", icon: Icons.warning_amber),
      ActivityItem(id: "13", name: "Aktivitas lainnya", icon: Icons.more_horiz),
    ];
  }

  Future<List<TrajectoryEvent>> getHistoryEvents() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final userId = prefs.getString('user_id');
      if (userId == null) {
        return [];
      }

      final response = await _dio.get('/analysis/events/$userId');
      if (response.statusCode == 200 && response.data != null) {
        final success = response.data['success'];
        final eventList = response.data['data'] as List?;
        if (success == true && eventList != null) {
          return eventList.map((e) {
            final id = e['_id'] ?? '';
            final classification = e['classification'] ?? 'Normal';
            final peakScore = (e['peak_score'] as num?)?.toDouble() ?? 0.0;
            final durationMs = (e['duration_ms'] as num?)?.toInt() ?? 0;
            final onsetTime = (e['onset_time'] as num?)?.toInt() ?? DateTime.now().millisecondsSinceEpoch;
            final activity = e['activity'] ?? 'Aktivitas';
            final reviewStatus = e['review_status'] ?? 'New';
            
            // Map types: Caution -> deviation, Alert -> alert, Normal -> stable
            String type = 'stable';
            if (classification == 'Alert') {
              type = 'alert';
            } else if (classification == 'Caution') {
              type = 'deviation';
            }
            
            String title = 'Deviasi Terdeteksi';
            if (type == 'alert') title = 'Kondisi Kritis Terdeteksi';
            if (type == 'stable') title = 'Kondisi Stabil';

            return TrajectoryEvent(
              id: id,
              type: type,
              title: title,
              description: "Skor Peak Anomali: ${peakScore.toStringAsFixed(2)}. Status review: $reviewStatus",
              magnitude: peakScore,
              durationMinutes: durationMs ~/ 60000,
              recoveryStatus: reviewStatus == 'Closed' ? 'Tercapai' : 'Sedang berjalan',
              timestamp: DateTime.fromMillisecondsSinceEpoch(onsetTime),
              activity: activity,
            );
          }).toList();
        }
      }
    } catch (e) {
      debugPrint("getHistoryEvents error: $e");
    }

    // Return empty list or fallback if request fails
    return [];
  }

  Future<bool> uploadSensorLogs(List<SensorReading> readings) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final userId = prefs.getString('user_id');
      if (userId == null) {
        throw Exception("User is not logged in");
      }

      final payload = {
        'user_id': userId,
        'source': 'polar_ble',
        'device_id': 'mobile-app',
        'received_at': DateTime.now().toUtc().toIso8601String(),
        'readings': readings.map((r) => {
          'timestamp': r.timestamp.millisecondsSinceEpoch ~/ 1000,
          'heart_rate': r.heartRate,
          'rr_interval': r.rrInterval,
          'activity': r.motionState,
          'battery': r.battery,
          'signal_quality': r.signalQuality,
          'rmssd': r.rmssd,
          'dfa_alpha1': r.dfaAlpha1,
        }).toList(),
      };

      final transportResponse = await _dio.post('/log/transport', data: payload);
      if (transportResponse.statusCode == 200 || transportResponse.statusCode == 201) {
        final data = transportResponse.data;
        if (data != null && data['success'] == true) {
          debugPrint("Transport upload success: ${data['published']}");
          return true;
        }
      }

      // Fallback to the existing CSV upload flow if the transport endpoint is unavailable.
      final buffer = StringBuffer();
      buffer.writeln("user_id,timestamp,hr,rr,activity");

      for (final r in readings) {
        final ts = r.timestamp.millisecondsSinceEpoch ~/ 1000;
        final activity = r.motionState;
        buffer.writeln("$userId,$ts,${r.heartRate},${r.rrInterval},$activity");
      }

      final csvString = buffer.toString();
      final csvBytes = utf8.encode(csvString);

      final formData = FormData.fromMap({
        'file': MultipartFile.fromBytes(
          csvBytes,
          filename: 'logs_${DateTime.now().millisecondsSinceEpoch}.csv',
        ),
      });

      final response = await _dio.post('/log/logs', data: formData);
      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;
        if (data != null && data['success'] == true) {
          debugPrint("Upload success: ${data['insertedCount']} logs inserted.");
          return true;
        }
      }
      return false;
    } catch (e) {
      debugPrint("uploadSensorLogs error: $e");
      return false;
    }
  }
}

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient();
});

final profileProvider = FutureProvider<Participant>((ref) async {
  return ref.watch(apiClientProvider).getParticipantProfile();
});
