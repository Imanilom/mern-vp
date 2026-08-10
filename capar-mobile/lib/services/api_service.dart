import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  static const String baseUrl = 'http://10.0.2.2:3030/api'; // Use 10.0.2.2 for Android emulator to host localhost

  static Future<bool> sendSensorData({
    required String userId,
    required String deviceId,
    required List<Map<String, dynamic>> readings,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/log/transport'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'user_id': userId,
          'device_id': deviceId,
          'source': 'polar_ble',
          'received_at': DateTime.now().toIso8601String(),
          'readings': readings,
        }),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return true;
      } else {
        print('Error sending sensor data: ${response.statusCode} - ${response.body}');
        return false;
      }
    } catch (e) {
      print('Exception sending sensor data: $e');
      return false;
    }
  }

  static Future<Map<String, dynamic>?> getDashboardData() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/dashboard'));
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return null;
    } catch (e) {
      print('Exception fetching dashboard: $e');
      return null;
    }
  }

  // --- HELPER METODE ---
  static Future<dynamic> _get(String path) async {
    try {
      final response = await http.get(Uri.parse('$baseUrl$path'));
      if (response.statusCode == 200) return jsonDecode(response.body);
      return null;
    } catch (e) {
      print('GET $path Error: $e');
      return null;
    }
  }

  static Future<dynamic> _post(String path, Map<String, dynamic> body) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl$path'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );
      if (response.statusCode == 200 || response.statusCode == 201) return jsonDecode(response.body);
      return null;
    } catch (e) {
      print('POST $path Error: $e');
      return null;
    }
  }

  static Future<dynamic> _patch(String path, [Map<String, dynamic>? body]) async {
    try {
      final response = await http.patch(
        Uri.parse('$baseUrl$path'),
        headers: {'Content-Type': 'application/json'},
        body: body != null ? jsonEncode(body) : null,
      );
      if (response.statusCode == 200) return jsonDecode(response.body);
      return null;
    } catch (e) {
      print('PATCH $path Error: $e');
      return null;
    }
  }

  static Future<dynamic> _delete(String path) async {
    try {
      final response = await http.delete(Uri.parse('$baseUrl$path'));
      if (response.statusCode == 200) return jsonDecode(response.body);
      return null;
    } catch (e) {
      print('DELETE $path Error: $e');
      return null;
    }
  }

  // --- ACTIVITY ROUTES ---
  static Future<dynamic> getActivity() => _get('/activity/getActivity');
  static Future<dynamic> getActivityForPatient(String patientId) => _get('/activity/getActivity/$patientId');
  static Future<dynamic> getActivityById(String id) => _get('/activity/get/$id');
  static Future<dynamic> createActivity(Map<String, dynamic> data) => _post('/activity/create', data);
  static Future<dynamic> deleteActivity(String id) => _delete('/activity/delete/$id');
  static Future<dynamic> updateActivity(String id, Map<String, dynamic> data) => _post('/activity/update/$id', data);

  // --- AI PIPELINE ROUTES ---
  static Future<dynamic> predictHealthRisk(Map<String, dynamic> data) => _post('/ai/prediction', data);
  static Future<dynamic> detectArtifact(Map<String, dynamic> data) => _post('/ai/artifact/detect', data);
  static Future<dynamic> detectAnomaly(Map<String, dynamic> data) => _post('/ai/anomaly/detect', data);
  static Future<dynamic> analyzeMissingData(Map<String, dynamic> data) => _post('/ai/missing/analyze', data);
  static Future<dynamic> processKalmanFilter(Map<String, dynamic> data) => _post('/ai/kalman/filter', data);
  static Future<dynamic> createActivityContext(Map<String, dynamic> data) => _post('/ai/activity-context', data);
  static Future<dynamic> getActivityContextByUser(String userId) => _get('/ai/activity-context/$userId');

  // --- ANALYSIS ROUTES ---
  static Future<dynamic> getAnalysisReports() => _get('/analysis/reports');
  static Future<dynamic> getAnalyzedSegments(String userId, {int limit = 100}) => _get('/analysis/segments/$userId?limit=$limit');
  static Future<dynamic> getRecentEvents(String userId, {int limit = 20}) => _get('/analysis/events/$userId?limit=$limit');
  static Future<dynamic> getEventDetails(String eventId) => _get('/analysis/events/details/$eventId');
  static Future<dynamic> annotateEvent(String eventId, Map<String, dynamic> metadata) => _post('/analysis/events/$eventId/annotate', metadata);
  static Future<dynamic> updateEventStatus(String eventId, String status) => _patch('/analysis/events/$eventId/status', {'status': status});
  static Future<dynamic> validateEvent(String eventId, String label, String notes) => _patch('/analysis/events/$eventId/validate', {'label': label, 'notes': notes});
  static Future<dynamic> escalateEvent(String eventId, bool escalated) => _patch('/analysis/events/$eventId/escalate', {'escalated': escalated});
  static Future<dynamic> assignReviewer(String eventId) => _patch('/analysis/events/$eventId/assign');
  static Future<dynamic> getUserBaselines(String userId) => _get('/analysis/baseline/$userId');
  static Future<dynamic> freezeBaseline(String baselineId, bool isFrozen) => _patch('/analysis/baseline/$baselineId/freeze', {'is_frozen': isFrozen});
  static Future<dynamic> approveBaseline(String baselineId) => _patch('/analysis/baseline/$baselineId/approve');
  static Future<dynamic> recalculateBaseline(String baselineId) => _post('/analysis/baseline/$baselineId/recalculate', {});
  static Future<dynamic> getFullMetrics(String userId) => _get('/analysis/metrics/$userId');
  static Future<dynamic> getMetricsROC(String userId) => _get('/analysis/metrics/$userId/roc');
  static Future<dynamic> getMetricsH1a(String userId, int interval) => _get('/analysis/metrics/$userId/h1a?interval=$interval');
  static Future<dynamic> getMetricsH2a(String userId) => _get('/analysis/metrics/$userId/h2a');
  static Future<dynamic> getMetricsH3a(String userId) => _get('/analysis/metrics/$userId/h3a');
  static Future<dynamic> getActivityContext(String userId) => _get('/analysis/activity-context/$userId');
  static Future<dynamic> updateSegmentLabel(String segmentId, String label) => _patch('/analysis/segments/$segmentId/label', {'label': label});
  static Future<dynamic> updateEventLabel(String eventId, int actualOnsetTime) => _patch('/analysis/events/$eventId/label', {'actual_onset_time': actualOnsetTime});
  static Future<dynamic> validateSegmentByDoctor(String segmentId, Map<String, dynamic> data) => _patch('/analysis/segments/$segmentId/doctor-validate', data);
  static Future<dynamic> getKalmanTrajectory(String userId) => _get('/analysis/kalman-trajectory/$userId');
  static Future<dynamic> triggerRRAnalysis() => _post('/analysis/rr/trigger', {});
  static Future<dynamic> getRRSegments(String userId, {int limit = 100, String? status}) {
    final statusQuery = status != null ? '&status=$status' : '';
    return _get('/analysis/rr/segments/$userId?limit=$limit$statusQuery');
  }
  static Future<dynamic> getRRBaseline(String userId) => _get('/analysis/rr/baseline/$userId');

  // --- DATA ROUTES ---
  static Future<dynamic> getFilteredAndRawData() => _get('/data/filtered-raw');
  static Future<dynamic> getDailyData() => _get('/data/daily-data');
  static Future<dynamic> getRawPolarData(String userId) => _get('/data/raw/$userId');

  // --- DOCTOR ROUTES ---
  static Future<dynamic> getDoctorPatients() => _get('/doctor/patients');
  static Future<dynamic> getDoctorPatientById(String id) => _get('/doctor/patient/$id');
  static Future<dynamic> getDoctorPatientLive(String id) => _get('/doctor/patient/$id/live');
  static Future<dynamic> getDoctorPatientHistory(String id) => _get('/doctor/patient/$id/history');
  static Future<dynamic> getDoctorPatientPredictions(String id) => _get('/doctor/patient/$id/predictions');
  static Future<dynamic> postDoctorPatientValidation(String id, Map<String, dynamic> data) => _post('/doctor/patient/$id/validation', data);
  static Future<dynamic> getDoctorPatientConfidence(String id) => _get('/doctor/patient/$id/confidence');

  // --- REPORT ROUTES ---
  static Future<dynamic> generateReport() => _get('/reports/generate');
  static Future<dynamic> getReportsList(String userId) => _get('/reports/list/$userId');
}
