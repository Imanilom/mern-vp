import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../shared/models/models.dart';

// Ganti URL berikut sesuai environment:
// Development: URL ngrok atau localhost
// Production VPS: 'http://YOUR_VPS_IP:3031/api' atau domain Anda 'https://domainanda.com/api'
// const String BASE_URL = 'https://healthtrajectory.cloud/api';
const String BASE_URL = 'https://72c9-2001-448a-a010-3a86-754c-9e22-6ae6-9006.ngrok-free.app/api';

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
        // Skip ngrok warning
        options.headers['ngrok-skip-browser-warning'] = 'true';
        return handler.next(options);
      },
    ));
  }

  String get _baseUrl {
    // Change the URL in the BASE_URL constant above
    return BASE_URL;
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

        // Simpan nama & email ke local cache untuk digunakan saat offline
        final name = data['name'] as String? ?? 'Peserta HTM';
        final email = data['email'] as String? ?? '';
        await prefs.setString('user_name', name);
        if (email.isNotEmpty) await prefs.setString('user_email', email);

        // Baca field opsional yang mungkin ada di profil backend
        // birth_year, gender, height_cm, weight_kg adalah field opsional
        final birthYear = (data['birth_year'] as num?)?.toInt()
            ?? (data['birthYear'] as num?)?.toInt()
            ?? 0; // 0 = tidak diketahui / belum diisi
        final gender = data['gender'] as String?
            ?? data['sex'] as String?
            ?? '';
        final heightCm = (data['height_cm'] as num?)?.toDouble()
            ?? (data['height'] as num?)?.toDouble()
            ?? 0.0;
        final weightKg = (data['weight_kg'] as num?)?.toDouble()
            ?? (data['weight'] as num?)?.toDouble()
            ?? 0.0;

        return Participant(
          id: data['_id'] ?? userId,
          name: name,
          studyCode: data['current_device'] ?? data['study_code'] ?? 'HTM-2026',
          pin: '******',
          birthYear: birthYear,
          gender: gender,
          heightCm: heightCm,
          weightKg: weightKg,
          relevantCondition: data['address'] != null && (data['address'] as String).isNotEmpty
              ? data['address'] as String
              : data['condition'] as String? ?? 'Pemantauan Trajectory Pasca-Aktivitas',
          staffContact: data['phone_number'] as String? ?? '',
        );
      }
    } catch (e) {
      debugPrint("getParticipantProfile error: $e");
    }

    // Fallback: gunakan data session lokal, tanpa data dummy palsu
    final prefs = await SharedPreferences.getInstance();
    final cachedId = prefs.getString('user_id') ?? "Offline";
    final cachedName = prefs.getString('user_name') ?? "Peserta (Offline)";
    return Participant(
      id: cachedId,
      name: cachedName,
      studyCode: "HTM-2026",
      pin: "******",
      birthYear: 0,   // 0 = tidak diketahui
      gender: "",
      heightCm: 0.0,
      weightKg: 0.0,
      relevantCondition: "Pemantauan Trajectory Riset HTM",
      staffContact: "",
    );
  }

  Future<List<ActivityItem>> getActivities() async {
    try {
      final response = await _dio.get('/activity/getActivity');
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        List? list;
        if (data is List) {
          list = data;
        } else if (data is Map && data['Activity'] is List) {
          list = data['Activity'] as List;
        } else if (data is Map && data['data'] is List) {
          list = data['data'] as List;
        }

        if (list != null && list.isNotEmpty) {
          return list.map((item) {
            return ActivityItem(
              id: item['_id']?.toString() ?? item['id']?.toString() ?? UniqueKey().toString(),
              name: item['name'] ?? item['aktivitas'] ?? item['activity'] ?? 'Aktivitas',
              icon: Icons.directions_walk,
            );
          }).toList();
        }
      }
    } catch (e) {
      debugPrint("getActivities API call error: $e");
    }

    // Default activity list fallback
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

  Future<bool> pushActivity({required String activityName, String? notes}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final userId = prefs.getString('user_id');
      final now = DateTime.now();
      final nowStr = "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";
      final timeStr = "${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}";

      final response = await _dio.post('/activity/create', data: {
        'userRef': userId,
        'tanggal': nowStr,
        'awal': timeStr,
        'akhir': timeStr,
        'aktivitas': activityName,
      });
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      debugPrint("pushActivity error: $e");
      return false;
    }
  }

  Future<bool> reportSymptom({
    required List<String> symptoms,
    required double intensity,
    String? notes,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final userId = prefs.getString('user_id');
      final now = DateTime.now();
      final nowStr = "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";
      final timeStr = "${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}";

      final symptomListStr = symptoms.join(", ");
      final notesStr = (notes != null && notes.isNotEmpty) ? ". Catatan: $notes" : "";
      final fullDesc = "Gejala: $symptomListStr (Intensitas ${intensity.toInt()}/10)$notesStr";

      final response = await _dio.post('/activity/create', data: {
        'userRef': userId,
        'tanggal': nowStr,
        'awal': timeStr,
        'akhir': timeStr,
        'aktivitas': fullDesc,
      });
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      debugPrint("reportSymptom error: $e");
      return false;
    }
  }

  Future<List<Map<String, dynamic>>> getAnalysisSegments() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final userId = prefs.getString('user_id');
      if (userId == null) return [];

      final response = await _dio.get('/analysis/segments/$userId');
      if (response.statusCode == 200 && response.data != null) {
        final success = response.data['success'];
        final data = response.data['data'] as List?;
        if (success == true && data != null) {
          return data.cast<Map<String, dynamic>>();
        }
      }
    } catch (e) {
      debugPrint("getAnalysisSegments error: $e");
    }
    return [];
  }

  Future<bool> updateEventStatus(String eventId, String status) async {
    try {
      final response = await _dio.patch('/analysis/events/$eventId/status', data: {
        'status': status,
      });
      return response.statusCode == 200;
    } catch (e) {
      debugPrint("updateEventStatus error: $e");
      return false;
    }
  }

  Future<bool> validateEvent(String eventId, bool isValid) async {
    try {
      final response = await _dio.patch('/analysis/events/$eventId/validate', data: {
        'isValid': isValid,
      });
      return response.statusCode == 200;
    } catch (e) {
      debugPrint("validateEvent error: $e");
      return false;
    }
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

  // deviceName: nama perangkat BLE yang terhubung (misal: 'Polar H10 C7F2')
  // Jika null, akan menggunakan fallback 'POLAR_BLE'
  Future<bool> uploadSensorLogs(List<SensorReading> readings, {String? deviceName}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final userId = prefs.getString('user_id');
      if (userId == null) {
        throw Exception("User is not logged in");
      }

      final payload = {
        'user_id': userId,
        'source': 'polar_ble',
        // Gunakan nama perangkat BLE asli, bukan hardcoded
        'device_id': deviceName?.isNotEmpty == true ? deviceName! : 'POLAR_BLE',
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
  Future<Map<String, dynamic>> sendTransportSimulation() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final userId = prefs.getString('user_id') ?? 'DEMO_USER_001';
      final now = DateTime.now();

      final payload = {
        'user_id': userId,
        'source': 'polar_ble_simulation',
        'device_id': 'POLAR_H10_SIM',
        'received_at': now.toIso8601String(),
        'readings': [
          {
            'timestamp': now.millisecondsSinceEpoch ~/ 1000,
            'heart_rate': 78,
            'rr_interval': 815,
            'activity': 'Duduk bekerja',
            'battery': 95,
            'signal_quality': 100,
            'rmssd': 42.5,
            'dfa_alpha1': 1.05,
          },
          {
            'timestamp': (now.millisecondsSinceEpoch ~/ 1000) + 1,
            'heart_rate': 82,
            'rr_interval': 790,
            'activity': 'Duduk bekerja',
            'battery': 95,
            'signal_quality': 100,
            'rmssd': 39.1,
            'dfa_alpha1': 1.02,
          }
        ],
      };

      final response = await _dio.post('/log/transport', data: payload);
      if (response.statusCode == 200 || response.statusCode == 201) {
        return {
          'success': true,
          'published': response.data?['published'] ?? false,
          'data': response.data,
        };
      }
      return {'success': false, 'message': 'HTTP ${response.statusCode}'};
    } catch (e) {
      debugPrint("sendTransportSimulation error: $e");
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<List<Map<String, dynamic>>> getFilteredRawData() async {
    try {
      final response = await _dio.get('/data/filtered-raw');
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data is List) {
          return data.cast<Map<String, dynamic>>();
        } else if (data['data'] is List) {
          return (data['data'] as List).cast<Map<String, dynamic>>();
        }
      }
    } catch (e) {
      debugPrint("getFilteredRawData error: $e");
    }
    return [];
  }
}

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient();
});

final profileProvider = FutureProvider<Participant>((ref) async {
  return ref.watch(apiClientProvider).getParticipantProfile();
});

final eventsProvider = FutureProvider<List<TrajectoryEvent>>((ref) async {
  return ref.watch(apiClientProvider).getHistoryEvents();
});

final trajectorySegmentsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  return ref.watch(apiClientProvider).getAnalysisSegments();
});

final filteredRawDataProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  return ref.watch(apiClientProvider).getFilteredRawData();
});
