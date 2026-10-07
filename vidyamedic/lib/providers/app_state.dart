import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/health_models.dart';
import '../services/api_service.dart';
import '../services/wearable_pairing_service.dart';
import '../theme/app_theme.dart';

class AppState extends ChangeNotifier {
  AppState() {
    wearableBridge = PolarWearablePairingService(
      uploadSample: ApiService.createWearableSample,
      uploadStream: ApiService.streamWearableReadings,
      onSampleStored: _refreshWearableData,
    )..addListener(_notifyWearableChange);
  }

  List<List<double>> _parseAcceleration(dynamic source) {
    if (source is! List) return [];
    return source
        .map((sample) {
          if (sample is Map) {
            final x = sample['x'];
            final y = sample['y'];
            final z = sample['z'];
            if (x is! num || y is! num || z is! num) {
              return <double>[];
            }
            return [x.toDouble(), y.toDouble(), z.toDouble()];
          }
          if (sample is List) {
            return sample.whereType<num>().map((n) => n.toDouble()).toList();
          }
          return <double>[];
        })
        .where((sample) => sample.length == 3)
        .toList();
  }

  void _maybePromptForMovement([Map<String, dynamic>? latestSample]) {
    if (!confirmedDailySections.contains('activity') ||
        !['Duduk', 'Istirahat'].contains(activity) ||
        wearable.recentAcceleration.length < 10 ||
        wearable.motionIntensity < 0.12) {
      return;
    }
    final recordedAt = DateTime.tryParse(
      latestSample?['recorded_at']?.toString() ??
          wearable.lastSync?.toIso8601String() ??
          '',
    );
    final sampleAge =
        recordedAt == null ? null : DateTime.now().difference(recordedAt);
    if (sampleAge == null ||
        sampleAge > const Duration(minutes: 10) ||
        sampleAge < const Duration(minutes: -10)) {
      return;
    }
    final lastPrompt = _lastMovementPromptAt;
    if (lastPrompt != null &&
        DateTime.now().difference(lastPrompt) < _movementPromptCooldown) {
      return;
    }
    _lastMovementPromptAt = DateTime.now();
    suggestedActivity = 'Berjalan';
    showActivityMovementPrompt = true;
    notifyListeners();
  }

  late final PolarWearablePairingService wearableBridge;

  void _notifyWearableChange() {
    notifyListeners();
  }

  void _refreshWearableData() {
    unawaited(Future.wait(
        [fetchWearableSamples(), fetchCaparInsights(), fetchOverview()]));
  }

  @override
  void dispose() {
    wearableBridge.removeListener(_notifyWearableChange);
    wearableBridge.dispose();
    super.dispose();
  }

  // ---------------- Authentication State ----------------
  bool _isLoading = false;
  String? _authError;
  int? _authErrorStatusCode;
  bool _isAuthenticated = false;
  Map<String, dynamic>? _currentAccount;

  bool get isLoading => _isLoading;
  String? get authError => _authError;
  int? get authErrorStatusCode => _authErrorStatusCode;
  bool get isAuthenticated => _isAuthenticated || ApiService.isAuthenticated;
  Map<String, dynamic>? get currentAccount =>
      _currentAccount ?? ApiService.currentUser;

  Future<void> initialize() async {
    await ApiService.init();
    if (ApiService.isAuthenticated) {
      final profile = await ApiService.getProfile();
      if (!profile.success) {
        await ApiService.clearSession();
        _authError =
            profile.message ?? 'Sesi tidak dapat divalidasi oleh server.';
        return;
      }
      _isAuthenticated = true;
      _currentAccount = ApiService.currentUser;
      notifyListeners();
      await refreshAllData();
    }
  }

  Future<bool> register({
    required String name,
    required String email,
    required String password,
    String? phoneNumber,
  }) async {
    _isLoading = true;
    _authError = null;
    _authErrorStatusCode = null;
    notifyListeners();

    final res = await ApiService.register(
      name: name,
      email: email,
      password: password,
      phoneNumber: phoneNumber,
    );

    _isLoading = false;
    if (res.success) {
      _isAuthenticated = true;
      _currentAccount = ApiService.currentUser;
      userProfile.name = name;
      notifyListeners();
      await refreshAllData();
      return true;
    } else {
      _authError = res.message ?? 'Pendaftaran gagal';
      _authErrorStatusCode = res.statusCode;
      notifyListeners();
      return false;
    }
  }

  Future<bool> signin({
    required String email,
    required String password,
  }) async {
    _isLoading = true;
    _authError = null;
    _authErrorStatusCode = null;
    notifyListeners();

    final res = await ApiService.signin(
      email: email,
      password: password,
    );

    _isLoading = false;
    if (res.success) {
      _isAuthenticated = true;
      _currentAccount = ApiService.currentUser;
      if (_currentAccount != null && _currentAccount!['name'] != null) {
        userProfile.name = _currentAccount!['name'].toString();
      }
      notifyListeners();
      await refreshAllData();
      return true;
    } else {
      _authError = res.message ?? 'Gagal masuk akun';
      _authErrorStatusCode = res.statusCode;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await wearableBridge.disconnect();
    await ApiService.logout();
    _isAuthenticated = false;
    _currentAccount = null;
    notifyListeners();
  }

  // ---------------- Backend Data & Status ----------------
  bool isCaparLoading = false;
  bool isRefreshing = false;
  String? dataError;
  Map<String, dynamic>? rawCaparInsights;
  Map<String, dynamic>? overviewData;
  Map<String, dynamic>? dailySummaryData;
  List<Map<String, dynamic>> wearableSamples = [];
  Map<String, dynamic>? get reasoningPipeline {
    final capar = rawCaparInsights?['capar'];
    final pipeline = capar is Map ? capar['reasoning_pipeline'] : null;
    return pipeline is Map ? Map<String, dynamic>.from(pipeline) : null;
  }

  final Set<String> confirmedDailySections = {};
  bool isDailyDraftDirty = false;
  List<ScientificCitation> scientificCitations = [];
  List<ScientificCitation> recoveryScientificCitations = [];
  CaparFollowUpPrompt followUpPrompt = const CaparFollowUpPrompt();
  String? _followUpPromptShownSegmentId;
  Map<String, bool> inputReadiness = {};

  Future<void> refreshAllData() async {
    if (!isAuthenticated) return;
    isRefreshing = true;
    dataError = null;
    notifyListeners();
    await Future.wait([
      fetchProfile(),
      fetchOverview(),
      fetchCaparInsights(),
      fetchDailySummary(),
      fetchRecentEvents(),
      fetchWearableSamples(),
    ]);
    isRefreshing = false;
    notifyListeners();
  }

  Future<void> fetchProfile() async {
    final res = await ApiService.getProfile();
    if (res.success && res.data != null) {
      final pData = res.data!['profile'] as Map<String, dynamic>?;
      final aData = res.data!['account'] as Map<String, dynamic>?;
      if (pData != null) {
        final accName = aData?['name']?.toString() ?? '';
        userProfile = UserProfile.fromJson(pData, defaultName: accName);
        allergies = userProfile.allergies;
        medicalConditions = List.from(userProfile.conditions);
        routineMedications = List.from(userProfile.medications);
        wearable.provider = userProfile.wearableProvider;
        notifDailySummary = userProfile.notifMorningSummary;
        notifCriticalAlerts = userProfile.notifImportantAlerts;
        notifHealthEducation = userProfile.notifHealthEducation;
        allowDataSharing =
            userProfile.clinicianSharing || userProfile.familySharing;
        notifyListeners();
      }
    } else {
      dataError = res.message ?? 'Gagal memuat profil dari server.';
    }
  }

  Future<bool> saveProfileToServer() async {
    userProfile.conditions = List.from(medicalConditions);
    userProfile.allergies = allergies;
    userProfile.medications = List.from(routineMedications);
    userProfile.notifMorningSummary = notifDailySummary;
    userProfile.notifImportantAlerts = notifCriticalAlerts;
    userProfile.notifHealthEducation = notifHealthEducation;
    userProfile.clinicianSharing = allowDataSharing;
    final patch = userProfile.toPatchJson();

    final res = await ApiService.updateProfile(patch);
    if (res.success) {
      await fetchProfile();
      await fetchOverview();
      return true;
    }
    dataError = res.message ?? 'Profil tidak tersimpan di server.';
    notifyListeners();
    return false;
  }

  Future<void> fetchOverview() async {
    final res = await ApiService.getOverview();
    if (res.success && res.data != null) {
      overviewData = res.data!['overview'] as Map<String, dynamic>?;
      final readiness =
          overviewData?['input_readiness'] as Map<String, dynamic>?;
      inputReadiness =
          readiness?.map((key, value) => MapEntry(key, value == true)) ?? {};
      notifyListeners();
    } else {
      dataError = res.message ?? 'Gagal memuat ringkasan akun dari server.';
    }
  }

  Future<void> fetchCaparInsights() async {
    isCaparLoading = true;
    notifyListeners();

    final res = await ApiService.getCaparInsights();
    isCaparLoading = false;
    if (res.success && res.data != null) {
      rawCaparInsights = res.data;
      _applyLegacyCaparWearableReading();

      // Parse scientific citations
      final evidence = res.data!['scientific_evidence'];
      final citationItems = evidence is List
          ? evidence
          : evidence is Map && evidence['items'] is List
              ? evidence['items'] as List
              : const <dynamic>[];
      scientificCitations = citationItems
          .whereType<Map>()
          .map((citation) =>
              ScientificCitation.fromJson(Map<String, dynamic>.from(citation)))
          .toList();

      // Parse follow up prompt
      final capar = res.data!['capar'] as Map<String, dynamic>?;
      final recovery = capar?['recovery'];
      final recoveryEvidence =
          recovery is Map ? recovery['scientific_evidence'] : null;
      recoveryScientificCitations = recoveryEvidence is List
          ? recoveryEvidence
              .whereType<Map>()
              .map((citation) => ScientificCitation.fromJson(
                  Map<String, dynamic>.from(citation)))
              .toList()
          : [];
      final ped = capar?['pedagogy'] as Map<String, dynamic>?;
      if (ped != null && ped['follow_up'] != null) {
        followUpPrompt = CaparFollowUpPrompt.fromJson(
            ped['follow_up'] as Map<String, dynamic>);
      }

      notifyListeners();
    } else {
      dataError = res.message ?? 'Gagal memuat analisis CAPAR dari server.';
    }
  }

  void _applyLegacyCaparWearableReading() {
    if (wearableSamples.isNotEmpty) return;
    final capar = rawCaparInsights?['capar'];
    final readings = capar is Map ? capar['polar_data'] : null;
    if (readings is! List || readings.isEmpty || readings.first is! Map) return;

    final latest = Map<String, dynamic>.from(readings.first as Map);
    final acceleration = readings
        .whereType<Map>()
        .map((reading) => [
              (reading['acc_x'] as num?)?.toDouble() ?? 0,
              (reading['acc_y'] as num?)?.toDouble() ?? 0,
              (reading['acc_z'] as num?)?.toDouble() ?? 0,
            ])
        .toList();
    final serverSteps = (latest['step_count'] as num?)?.round() ?? 0;
    wearable = WearableData(
      hasServerSamples: true,
      deviceName: latest['device_id']?.toString() ?? 'Polar H10',
      provider: 'CAPAR PolarData',
      lastSync: DateTime.tryParse(latest['recorded_at']?.toString() ?? ''),
      heartRate: (latest['hr'] as num?)?.round() ?? 0,
      hrvRmssd: (latest['rrms'] as num?)?.round() ?? 0,
      steps: serverSteps > 0
          ? serverSteps
          : WearableData.calculateStepsFromAcc(acceleration),
      stepsEstimatedFromAcc: serverSteps <= 0,
      recentAcceleration: acceleration,
    );
    _maybePromptForMovement();
    notifyListeners();
  }

  Future<void> fetchDailySummary([DateTime? date]) async {
    final targetDate = date ?? logDate;
    final yyyyMmDd = DateFormat('yyyy-MM-dd').format(targetDate);
    final res = await ApiService.getDailySummary(yyyyMmDd);
    if (res.success && res.data != null) {
      dailySummaryData = res.data;
      final checkIns = dailySummaryData!['check_ins'];
      stress = null;
      if (checkIns is List && checkIns.isNotEmpty && checkIns.last is Map) {
        final latest = Map<String, dynamic>.from(checkIns.last as Map);
        final sleep = latest['sleep'] is Map
            ? Map<String, dynamic>.from(latest['sleep'] as Map)
            : <String, dynamic>{};
        final lifestyle = latest['lifestyle'] is Map
            ? Map<String, dynamic>.from(latest['lifestyle'] as Map)
            : <String, dynamic>{};
        final measurementsData = latest['measurements'] is Map
            ? Map<String, dynamic>.from(latest['measurements'] as Map)
            : <String, dynamic>{};
        logDate = DateTime.tryParse(latest['recorded_at']?.toString() ?? '') ??
            logDate;
        mood = MoodRating.fromApiValue(latest['feeling']?.toString());
        activity = mapApiToActivity(latest['activity']?.toString() ?? '');
        symptoms = (latest['symptoms'] as List?)
                ?.map((e) => mapApiToSymptomLabel(e.toString()))
                .toList() ??
            [];
        final stressValue = latest['stress_level'];
        stress = StressLevel.fromApiValue(stressValue is num
            ? stressValue
            : num.tryParse(stressValue?.toString() ?? ''));
        sleepMinutes = (sleep['duration_minutes'] as num?)?.round() ?? 0;
        sleepQuality = SleepQuality.fromApiValue(sleep['quality']?.toString());
        habitMeal = lifestyle['meal'] == true;
        habitCaffeine = lifestyle['caffeine'] == true;
        habitAlcohol = lifestyle['alcohol'] == true;
        habitSmoking = lifestyle['smoking'] == true;
        habitMedication = latest['medication_taken'] == true;
        note = latest['note']?.toString() ?? '';
        confirmedDailySections
          ..clear()
          ..addAll([
            if (latest.containsKey('feeling') || latest.containsKey('symptoms'))
              'symptoms',
            if (latest.containsKey('activity') ||
                latest.containsKey('lifestyle'))
              'activity',
            if (latest.containsKey('sleep')) 'sleep',
            if (latest.containsKey('measurements')) 'measurements',
            if (latest.containsKey('note')) 'note',
          ]);
        isDailyDraftDirty = false;
        _maybePromptForMovement();
        final systolic = measurementsData['systolic_bp'];
        final diastolic = measurementsData['diastolic_bp'];
        measurement('bp').value = systolic == null || diastolic == null
            ? null
            : '$systolic/$diastolic';
        measurement('temp').value =
            measurementsData['temperature_c']?.toString();
        measurement('weight').value = measurementsData['weight_kg']?.toString();
        measurement('spo2').value = measurementsData['spo2_pct']?.toString();
        measurement('glucose').value =
            measurementsData['glucose_mg_dl']?.toString();
        final additionalMeasurements = measurementsData['additional'];
        if (additionalMeasurements is List) {
          for (final item in additionalMeasurements.whereType<Map>()) {
            final measurementData = Map<String, dynamic>.from(item);
            final key = 'custom_${measurementData['name']}';
            final existing = measurements.where((entry) => entry.key == key);
            if (existing.isEmpty) {
              measurements.add(MeasurementEntry(
                key: key,
                label: measurementData['name']?.toString() ?? '',
                unit: measurementData['unit']?.toString() ?? '',
                icon: Icons.science_outlined,
                color: AppTheme.primary,
                value: measurementData['value']?.toString(),
              ));
            }
          }
        }
      }
      notifyListeners();
    } else {
      dataError = res.message ?? 'Gagal memuat ringkasan harian dari server.';
    }
  }

  Future<void> fetchRecentEvents() async {
    final res = await ApiService.getEvents(limit: 20);
    if (res.success && res.data != null) {
      events = res.data!
          .whereType<Map>()
          .map((e) => EventItem.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      notifyListeners();
    } else {
      dataError = res.message ?? 'Gagal memuat event dari server.';
    }
  }

  Future<bool> fetchWearableSamples() async {
    final res = await ApiService.getWearableSamples(limit: 20);
    if (res.success && res.data != null) {
      dataError = null;
      wearableSamples = res.data!
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      if (wearableSamples.isNotEmpty) {
        final latest = wearableSamples.first;
        final acceleration = _parseAcceleration(latest['acceleration_g']);
        final serverSteps = (latest['steps'] as num?)?.round() ?? 0;
        wearable = WearableData(
          hasServerSamples: true,
          deviceName: latest['device_id']?.toString() ?? '',
          provider: latest['provider']?.toString() ?? '',
          lastSync: DateTime.tryParse(latest['recorded_at']?.toString() ?? ''),
          heartRate: (latest['heart_rate_bpm'] as num?)?.round() ?? 0,
          baselineHr: (latest['baseline_hr_bpm'] as num?)?.round() ?? 0,
          hrvRmssd: (latest['rmssd_ms'] as num?)?.round() ?? 0,
          steps: serverSteps > 0
              ? serverSteps
              : WearableData.calculateStepsFromAcc(acceleration),
          stepsEstimatedFromAcc: serverSteps <= 0,
          spO2: (latest['spo2_pct'] as num?)?.round() ?? 0,
          skinTemp: (latest['skin_temperature_c'] as num?)?.toDouble() ?? 0,
          recentAcceleration: acceleration,
        );
        _maybePromptForMovement(latest);
      } else {
        wearable = WearableData(provider: userProfile.wearableProvider);
      }
      notifyListeners();
      return true;
    } else {
      dataError = res.message ?? 'Gagal memuat data wearable dari server.';
      notifyListeners();
      return false;
    }
  }

  Future<bool> linkLegacyCaparAccount(String password) async {
    final res = await ApiService.linkCaparAccount(patientPassword: password);
    if (res.success) {
      await refreshAllData();
      return true;
    }
    return false;
  }

  // ---------------- Profile & Preferences State ----------------
  UserProfile userProfile = UserProfile(name: '');

  final List<String> conditionOptions = const [
    'Hipertensi',
    'Diabetes',
    'Penyakit jantung',
    'Asma',
    'Gangguan tidur',
    'Lainnya',
  ];
  List<String> medicalConditions = [];
  String otherCondition = '';
  String allergies = '';
  List<Medication> routineMedications = [];

  WearableData wearable = WearableData();
  List<Map<String, dynamic>> get liveStreamReadings =>
      wearableBridge.recentStreamReadings;

  final List<String> goalOptions = const [
    'Memantau kesehatan sehari-hari',
    'Mencegah kondisi gawat darurat',
    'Meningkatkan kebugaran',
    'Lainnya',
  ];
  String primaryGoal = 'Memantau kesehatan sehari-hari';
  bool notifDailySummary = true;
  TimeOfDay notifDailyTime = const TimeOfDay(hour: 7, minute: 0);
  bool notifCriticalAlerts = true;
  bool notifHealthEducation = true;
  bool allowDataSharing = true;

  // ---------------- Input harian ----------------
  DateTime logDate = DateTime.now();

  // 1. Gejala & perasaan
  MoodRating mood = MoodRating.baik;
  List<String> symptoms = [kNoSymptom];
  double symptomLevel = 1.0; // 0 = Ringan, 1 = Sedang, 2 = Berat

  // 2. Aktivitas & gaya hidup
  String activity = 'Istirahat';
  StressLevel? stress;
  bool habitMeal = true;
  bool habitCaffeine = false;
  bool habitAlcohol = false;
  bool habitSmoking = false;
  bool habitMedication = true;

  // 3. Tidur
  int sleepMinutes = 0;
  SleepQuality sleepQuality = SleepQuality.baik;
  TimeOfDay bedTime = const TimeOfDay(hour: 22, minute: 30);
  TimeOfDay wakeTime = const TimeOfDay(hour: 5, minute: 30);
  bool sleepWakeOften = false;
  bool sleepHardToSleep = false;
  bool sleepNightmare = false;

  // 4. Pengukuran manual
  final List<MeasurementEntry> measurements = [
    MeasurementEntry(
        key: 'bp',
        label: 'Tekanan Darah',
        unit: 'mmHg',
        icon: Icons.speed,
        color: const Color(0xFF2F80ED)),
    MeasurementEntry(
        key: 'temp',
        label: 'Suhu Tubuh',
        unit: '°C',
        icon: Icons.thermostat,
        color: const Color(0xFFEB5757)),
    MeasurementEntry(
        key: 'weight',
        label: 'Berat Badan',
        unit: 'kg',
        icon: Icons.monitor_weight_outlined,
        color: AppTheme.primary),
    MeasurementEntry(
        key: 'spo2',
        label: 'SpO₂ (jika tidak otomatis)',
        unit: '%',
        icon: Icons.water_drop_outlined,
        color: const Color(0xFF2F80ED)),
    MeasurementEntry(
        key: 'glucose',
        label: 'Glukosa Darah (opsional)',
        unit: 'mg/dL',
        icon: Icons.bloodtype_outlined,
        color: const Color(0xFF7C5CDB)),
  ];

  // 5. Event marker
  List<EventItem> events = [];

  // 6. Catatan
  String note = '';

  // 7. Deteksi Gerakan ACC & Konfirmasi Aktivitas
  bool showActivityMovementPrompt = false;
  String suggestedActivity = 'Berjalan';
  DateTime? _lastMovementPromptAt;
  static const _movementPromptCooldown = Duration(minutes: 10);

  // Status sinkronisasi
  DateTime? lastSubmitted;

  // ---------------- Activity Baseline & Mahalanobis Model ----------------
  ({
    double muHr,
    double sigmaHr,
    double muHrv,
    double sigmaHrv
  }) get currentActivityBaseline => (
        muHr: _numberAt(['capar', 'baseline', 'heart_rate', 'mean_bpm']),
        sigmaHr: _numberAt(['capar', 'baseline', 'heart_rate', 'stddev_bpm']),
        muHrv: _numberAt(['capar', 'baseline', 'rmssd', 'mean_ms']),
        sigmaHrv: _numberAt(['capar', 'baseline', 'rmssd', 'stddev_ms']),
      );

  double get mahalanobisDistance =>
      _numberAt(['capar', 'deviation', 'mahalanobis_distance']);

  double _numberAt(List<String> path) {
    dynamic value = rawCaparInsights;
    for (final key in path) {
      if (value is! Map) return 0;
      value = value[key];
    }
    return value is num ? value.toDouble() : 0;
  }

  // ---------------- Derived ----------------
  bool get hasSymptoms =>
      symptoms.isNotEmpty &&
      !(symptoms.length == 1 && symptoms.first == kNoSymptom);

  String get symptomLevelLabel => symptomLevel < 0.67
      ? 'Ringan'
      : (symptomLevel < 1.34 ? 'Sedang' : 'Berat');

  bool get hasRedFlagSymptom =>
      kSymptoms.where((s) => s.redFlag).any((s) => symptoms.contains(s.label));

  int get hrDeviation =>
      _numberAt(['capar', 'deviation', 'heart_rate_delta_bpm']).round();

  bool markFollowUpPromptShown(String segmentId) {
    if (_followUpPromptShownSegmentId == segmentId) return false;
    _followUpPromptShownSegmentId = segmentId;
    return true;
  }

  bool get dataValid =>
      wearable.hasServerSamples &&
      wearable.lastSync != null &&
      DateTime.now().difference(wearable.lastSync!).inHours < 6;

  MeasurementEntry measurement(String key) =>
      measurements.firstWhere((m) => m.key == key);

  String get sleepDurationLabel {
    final h = sleepMinutes ~/ 60, m = sleepMinutes % 60;
    return m == 0 ? '$h jam' : '$h jam $m menit';
  }

  String get sleepShortLabel {
    final h = sleepMinutes ~/ 60, m = sleepMinutes % 60;
    return m == 0 ? '${h}j' : '${h}j ${m}m';
  }

  ActionTriageLevel get triageLevel {
    final capar = rawCaparInsights?['capar'] as Map<String, dynamic>?;
    final action = capar?['pedagogy']?['action'];
    if (action is Map && action['level'] != null) {
      return ActionTriageLevel.fromString(action['level'].toString());
    }
    return ActionTriageLevel.unknown;
  }

  Map<String, dynamic>? get serverAction {
    final capar = rawCaparInsights?['capar'] as Map<String, dynamic>?;
    final action = capar?['pedagogy']?['action'];
    return action is Map ? Map<String, dynamic>.from(action) : null;
  }

  Map<String, dynamic>? get latestCaparMahalanobis {
    final capar = rawCaparInsights?['capar'] as Map<String, dynamic>?;
    final list = capar?['mahalanobis'];
    if (list is List && list.isNotEmpty && list.first is Map) {
      return Map<String, dynamic>.from(list.first as Map);
    }
    return null;
  }

  bool get hasCaparMetrics => latestCaparMahalanobis?['available'] == true;

  bool get hasCaparRecords {
    final inventory = (rawCaparInsights?['capar']
        as Map<String, dynamic>?)?['data_inventory'];
    return inventory is Map &&
        inventory.values.any(
          (count) => count is num && count > 0,
        );
  }

  double? get recoveryProgress {
    final recovery =
        (rawCaparInsights?['capar'] as Map<String, dynamic>?)?['recovery'];
    return recovery is Map && recovery['recovery_progress_pct'] is num
        ? (recovery['recovery_progress_pct'] as num).toDouble()
        : null;
  }

  /// Enam Pertanyaan Panduan Memahami Tubuh (Pedagogy) dengan Bahasa Ramah Pengguna
  List<PedagogyAnswer> get pedagogyAnswers {
    // If we have live server CAPAR pedagogy response, map with humanized text
    final capar = rawCaparInsights?['capar'] as Map<String, dynamic>?;
    final ped = capar?['pedagogy'] as Map<String, dynamic>?;
    if (ped != null && ped.isNotEmpty) return _serverPedagogy(ped);
    if (ped == null || ped.isEmpty) {
      return List.generate(
        6,
        (i) => PedagogyAnswer(
          number: i + 1,
          question: const [
            'Di mana kondisi saya sekarang?',
            'Apa yang berubah hari ini?',
            'Mengapa hal itu terjadi?',
            'Berapa lama perubahan berlangsung?',
            'Apakah tubuh saya sedang pulih?',
            'Apa yang harus saya lakukan?',
          ][i],
          algorithm: '',
          summary: 'Belum tersedia dari backend.',
          detail: 'Data ini akan ditampilkan setelah tersedia di API.',
          status: 'Belum tersedia',
          statusColor: AppTheme.textMuted,
        ),
      );
    }

    if (ped.isNotEmpty) {
      final whereAmI = ped['where_am_i'] as Map<String, dynamic>?;
      final whatChanged = ped['what_changed'] as Map<String, dynamic>?;
      final why = ped['why'] as Map<String, dynamic>?;
      final howLong = ped['how_long'] as Map<String, dynamic>?;
      final recovery = ped['recovery'] as Map<String, dynamic>?;
      final action = ped['action'] as Map<String, dynamic>?;

      return [
        PedagogyAnswer(
          number: 1,
          question: 'Di mana kondisi saya sekarang?',
          algorithm:
              'Membandingkan denyut jantung dan ritme tubuh saat ini dengan pola normal Anda sehari-hari.',
          summary:
              whereAmI?['state']?.toString() ?? 'Belum tersedia dari backend.',
          detail: whereAmI?['meaning']?.toString() ??
              'Belum tersedia dari backend.',
          status:
              whereAmI?['baseline_relation']?.toString() ?? 'Belum tersedia',
          statusColor:
              whereAmI?['baseline_relation'] == 'within_personal_region'
                  ? AppTheme.statusGreen
                  : AppTheme.statusYellow,
        ),
        PedagogyAnswer(
          number: 2,
          question: 'Apa yang berubah hari ini?',
          algorithm:
              'Melihat selisih detak jantung, variasi ritme (HRV), dan aktivitas fisik Anda dibanding biasanya.',
          summary: whatChanged?['current_state']?.toString() ??
              'Belum tersedia dari backend.',
          detail: _factorSummary(
              whatChanged?['main_factors'] ?? whatChanged?['factors']),
          status: whatChanged?['score_trend']?.toString() ?? 'Belum tersedia',
          statusColor: AppTheme.statusYellow,
        ),
        PedagogyAnswer(
          number: 3,
          question: 'Mengapa hal itu terjadi?',
          algorithm:
              'Menghubungkan catatan pola tidur, tingkat stres, konsumsi, dan obat yang Anda minum.',
          summary: _factorSummary(why?['physiological_contributors']),
          detail: _factorSummary(why?['candidate_context_contributors']),
          status: why?['explanation_status']?.toString() ?? 'Belum tersedia',
          statusColor: AppTheme.primary,
        ),
        PedagogyAnswer(
          number: 4,
          question: 'Berapa lama perubahan berlangsung?',
          algorithm:
              'Memantau apakah perubahan ritme hanya terjadi sesaat atau berlangsung lama.',
          summary: howLong == null
              ? 'Belum ada episode yang tersedia dari backend.'
              : howLong.toString(),
          detail: howLong == null
              ? 'Durasi perubahan belum tersedia.'
              : _episodeSummary(howLong),
          status: howLong?['state']?.toString() ?? 'Belum tersedia',
          statusColor: AppTheme.statusYellow,
        ),
        PedagogyAnswer(
          number: 5,
          question: 'Apakah tubuh saya sedang pulih?',
          algorithm:
              'Melihat kecepatan tubuh Anda kembali tenang dan rileks setelah lelah atau beraktivitas.',
          summary:
              recovery?['state']?.toString() ?? 'Belum tersedia dari backend.',
          detail: recovery == null
              ? 'Data pemulihan belum tersedia.'
              : _recoverySummary(recovery),
          status: recovery?['relapse_detected'] == true
              ? 'Relapse terdeteksi'
              : recovery?['state']?.toString() ?? 'Belum tersedia',
          statusColor: recovery?['relapse_detected'] == true
              ? AppTheme.statusOrange
              : AppTheme.statusYellow,
        ),
        PedagogyAnswer(
          number: 6,
          question: 'Apa yang harus saya lakukan?',
          algorithm:
              'Rekomendasi langkah perawatan mandiri dan anjuran keselamatan untuk Anda.',
          summary:
              action?['title']?.toString() ?? 'Belum tersedia dari backend.',
          detail: action?['message']?.toString() ??
              'Rekomendasi tindakan belum tersedia.',
          status:
              action?['level']?.toString().toUpperCase() ?? 'Belum tersedia',
          statusColor: action?['level'] == null
              ? AppTheme.textMuted
              : ActionTriageLevel.fromString(action!['level'].toString()).color,
        ),
      ];
    }

    // Default friendly computation fallback
    final dev = hrDeviation;
    final devText = dev == 0
        ? 'sama dengan'
        : (dev > 0
            ? '+$dev bpm lebih tinggi dari'
            : '$dev bpm lebih rendah dari');
    final level = triageLevel;
    return [
      PedagogyAnswer(
        number: 1,
        question: 'Di mana kondisi saya sekarang?',
        algorithm:
            'Membandingkan detak jantung saat ini dengan kebiasaan normal tubuh Anda.',
        summary: dev.abs() < 10
            ? 'Kondisi Anda berada dalam rentang normal harian.'
            : 'Detak jantung Anda sedikit berbeda dari kebiasaan normal.',
        detail:
            'Detak jantung Anda ${wearable.heartRate} bpm saat $activity, $devText rata-rata normal Anda (${wearable.baselineHr} bpm).',
        status: dev.abs() < 10 ? 'Normal Harian' : 'Perlu Diamati',
        statusColor:
            dev.abs() < 10 ? AppTheme.statusGreen : AppTheme.statusYellow,
      ),
      PedagogyAnswer(
        number: 2,
        question: 'Apa yang berubah hari ini?',
        algorithm:
            'Menghitung perbedaan ritme detak jantung, pemulihan (HRV), dan pergerakan fisik.',
        summary: dev.abs() < 10
            ? 'Tidak ada perubahan mencolok dibanding hari biasanya.'
            : 'Detak jantung Anda berubah $devText biasanya.',
        detail:
            'Pemulihan jantung (HRV) ${wearable.hrvRmssd} ms, langkah ${wearable.steps}, oksigen ${wearable.spO2}%. Dihitung khusus berdasarkan pola tubuh Anda.',
        status: dev.abs() < 10 ? 'Stabil' : 'Ada Perubahan',
        statusColor:
            dev.abs() < 10 ? AppTheme.statusGreen : AppTheme.statusYellow,
      ),
      PedagogyAnswer(
        number: 3,
        question: 'Mengapa hal itu terjadi?',
        algorithm:
            'Mencari kemungkinan penyebab dari gaya hidup, kualitas tidur, dan rasa stres.',
        summary:
            'Konteks yang tercatat: aktivitas $activity, stres ${stress?.label.toLowerCase() ?? 'belum dicatat'}, dan tidur ${sleepQuality.label.toLowerCase()}.',
        detail: [
          if (habitCaffeine)
            'Minum kopi/teh berkafein bisa sedikit menaikkan detak jantung.',
          if (habitSmoking)
            'Merokok dapat memengaruhi ritme jantung dan kebugaran.',
          if (habitAlcohol)
            'Konsumsi alkohol dapat memengaruhi kualitas tidur semalam.',
          if (habitMedication) 'Obat rutin Anda tercatat sudah diminum.',
          if (!habitMedication) 'Obat rutin belum tercatat diminum.',
        ].join(' '),
        status: 'Faktor Terkait',
        statusColor: AppTheme.primary,
      ),
      PedagogyAnswer(
        number: 4,
        question: 'Berapa lama perubahan berlangsung?',
        algorithm:
            'Memastikan apakah perubahan ini hanya sesaat atau menetap dalam beberapa jam.',
        summary: hasSymptoms
            ? 'Keluhan baru dicatat hari ini — umumnya bersifat sementara.'
            : 'Tidak ada perubahan menetap yang mengkhawatirkan.',
        detail:
            'Perubahan dipantau secara berulang dalam kurun waktu tertentu, bukan hanya dari satu kali pengukuran.',
        status: hasSymptoms ? 'Sementara' : 'Stabil',
        statusColor: hasSymptoms ? AppTheme.statusYellow : AppTheme.statusGreen,
      ),
      PedagogyAnswer(
        number: 5,
        question: 'Apakah tubuh saya sedang pulih?',
        algorithm:
            'Melihat seberapa cepat tubuh Anda kembali rileks setelah beraktivitas atau tidur.',
        summary: sleepQuality == SleepQuality.buruk
            ? 'Pemulihan belum optimal karena tidur semalam kurang nyenyak.'
            : 'Tubuh Anda pulih dengan baik setelah tidur selama $sleepShortLabel.',
        detail:
            'Aplikasi memantau apakah ritme tubuh Anda perlahan kembali tenang ke rentang normal.',
        status:
            sleepQuality == SleepQuality.buruk ? 'Belum Optimal' : 'Pulih Baik',
        statusColor: sleepQuality == SleepQuality.buruk
            ? AppTheme.statusYellow
            : AppTheme.statusGreen,
      ),
      PedagogyAnswer(
        number: 6,
        question: 'Apa yang harus saya lakukan?',
        algorithm:
            'Anjuran tindakan mandiri dan keselamatan sesuai kondisi tubuh saat ini.',
        summary: '${level.code} – ${level.title}',
        detail:
            '${level.description}${dataValid ? '' : ' Pastikan sensor wearable tetap terpasang untuk pemantauan optimal.'}',
        status: level.code,
        statusColor: level.color,
      ),
    ];
  }

  String _factorSummary(dynamic value) {
    if (value is! List || value.isEmpty) return 'Belum tersedia dari backend.';
    return value.map((item) {
      if (item is Map) {
        final label = item['label'] ??
            item['feature'] ??
            item['name'] ??
            item['key'] ??
            'Faktor';
        final contribution =
            item['contribution'] ?? item['contribution_pct'] ?? item['value'];
        return contribution == null
            ? label.toString()
            : '$label: $contribution';
      }
      return item.toString();
    }).join(', ');
  }

  String _episodeSummary(Map<String, dynamic> episode) {
    final values = <String>[
      if (episode['elapsed_minutes'] != null)
        'Durasi: ${episode['elapsed_minutes']} menit',
      if (episode['persistent_dwell_minutes'] != null)
        'Persistensi: ${episode['persistent_dwell_minutes']} menit',
      if (episode['onset_time'] != null) 'Mulai: ${episode['onset_time']}',
      if (episode['peak_time'] != null) 'Puncak: ${episode['peak_time']}',
      if (episode['recovered_at'] != null) 'Pulih: ${episode['recovered_at']}',
    ];
    return values.isEmpty
        ? 'Rincian durasi belum tersedia dari backend.'
        : values.join(' • ');
  }

  String _recoverySummary(Map<String, dynamic> recovery) {
    final values = <String>[
      if (recovery['distance_trend'] != null)
        'Tren deviasi: ${recovery['distance_trend']}',
      if (recovery['distance_derivative_per_minute'] != null)
        'Perubahan per menit: ${recovery['distance_derivative_per_minute']}',
      if (recovery['recovery_progress_pct'] != null)
        'Progres pemulihan: ${recovery['recovery_progress_pct']}%',
      if (recovery['time_to_recovery_minutes'] != null)
        'Waktu pemulihan: ${recovery['time_to_recovery_minutes']} menit',
    ];
    return values.isEmpty
        ? 'Rincian pemulihan belum tersedia dari backend.'
        : values.join(' • ');
  }

  List<PedagogyAnswer> _serverPedagogy(Map<String, dynamic> pedagogy) {
    Map<String, dynamic>? section(String key) {
      final value = pedagogy[key];
      return value is Map ? Map<String, dynamic>.from(value) : null;
    }

    final where = section('where_am_i');
    final changed = section('what_changed');
    final why = section('why');
    final duration = section('how_long');
    final recovery = section('recovery');
    final action = section('action');
    final whyUncertainty = why?['reasoning_uncertainty'] is Map
        ? Map<String, dynamic>.from(why!['reasoning_uncertainty'] as Map)
        : null;
    final level = action?['level']?.toString();
    return [
      PedagogyAnswer(
        number: 1,
        question: 'Di mana kondisi saya sekarang?',
        algorithm: 'State CAPAR dibandingkan dengan baseline personal.',
        summary: where?['state']?.toString() ?? 'Belum tersedia dari backend.',
        detail: where?['meaning']?.toString() ?? 'Belum tersedia dari backend.',
        status: where?['baseline_relation']?.toString() ?? 'Belum tersedia',
        statusColor: where?['baseline_relation'] == 'within_personal_region'
            ? AppTheme.statusGreen
            : where?['baseline_relation'] == 'insufficient_data' ||
                    where?['baseline_relation'] == null
                ? AppTheme.textMuted
                : AppTheme.statusYellow,
      ),
      PedagogyAnswer(
        number: 2,
        question: 'Apa yang berubah hari ini?',
        algorithm: 'Perubahan fitur dan tren deviasi yang dihitung CAPAR.',
        summary: changed?['current_state']?.toString() ??
            'Belum tersedia dari backend.',
        detail: _factorSummary(changed?['main_factors'] ?? changed?['factors']),
        status: changed?['score_trend']?.toString() ?? 'Belum tersedia',
        statusColor: AppTheme.statusYellow,
      ),
      PedagogyAnswer(
        number: 3,
        question: 'Mengapa hal itu terjadi?',
        algorithm:
            'Kontribusi fisiologis dan kandidat konteks dari analisis CAPAR.',
        summary: _factorSummary(why?['physiological_contributors']),
        detail: [
          _factorSummary(why?['candidate_context_contributors']),
          if (whyUncertainty?['interpretation'] != null)
            whyUncertainty!['interpretation'].toString(),
        ].join(' • '),
        status: whyUncertainty?['evidence_status']?.toString() ??
            why?['explanation_status']?.toString() ??
            'Belum tersedia',
        statusColor:
            whyUncertainty?['evidence_status'] == 'conflicting_evidence'
                ? AppTheme.statusOrange
                : whyUncertainty?['evidence_status'] == 'limited_evidence' ||
                        whyUncertainty?['evidence_status'] ==
                            'insufficient_evidence'
                    ? AppTheme.statusYellow
                    : AppTheme.primary,
      ),
      PedagogyAnswer(
        number: 4,
        question: 'Berapa lama perubahan berlangsung?',
        algorithm:
            'Persistensi dan dwell time dari episode yang dianalisis CAPAR.',
        summary: duration?['state']?.toString() ??
            'Episode belum tersedia dari backend.',
        detail: duration == null
            ? 'Durasi belum tersedia.'
            : _episodeSummary(duration),
        status: duration?['persistent']?.toString() ?? 'Belum tersedia',
        statusColor: AppTheme.statusYellow,
      ),
      PedagogyAnswer(
        number: 5,
        question: 'Apakah tubuh saya sedang pulih?',
        algorithm: 'Tren jarak deviasi, pemulihan, waktu kembali, dan relapse.',
        summary:
            recovery?['state']?.toString() ?? 'Belum tersedia dari backend.',
        detail: recovery == null
            ? 'Data pemulihan belum tersedia.'
            : _recoverySummary(recovery),
        status: recovery?['relapse_detected'] == true
            ? 'Relapse terdeteksi'
            : 'Belum tersedia',
        statusColor: recovery?['relapse_detected'] == true
            ? AppTheme.statusOrange
            : AppTheme.statusYellow,
      ),
      PedagogyAnswer(
        number: 6,
        question: 'Apa yang harus saya lakukan?',
        algorithm: 'Tindakan berdasarkan action engine server.',
        summary: action?['title']?.toString() ?? 'Belum tersedia dari backend.',
        detail: action?['message']?.toString() ??
            'Rekomendasi tindakan belum tersedia.',
        status: level?.toUpperCase() ?? 'Belum tersedia',
        statusColor: level == null
            ? AppTheme.textMuted
            : ActionTriageLevel.fromString(level).color,
      ),
    ];
  }

  // ---------------- Mutations & API Operations ----------------
  void update(VoidCallback fn) {
    fn();
    notifyListeners();
  }

  bool hasDailySection(String section) =>
      confirmedDailySections.contains(section);

  void confirmDailySection(String section) {
    confirmedDailySections.add(section);
    isDailyDraftDirty = true;
  }

  void toggleCondition(String c) => update(() {
        medicalConditions.contains(c)
            ? medicalConditions.remove(c)
            : medicalConditions.add(c);
      });

  void addMedication(Medication m) => update(() => routineMedications.add(m));
  void removeMedication(int i) => update(() => routineMedications.removeAt(i));

  Future<bool> connectWearable(String device) async {
    String prov = 'other';
    if (device.toLowerCase().contains('apple')) prov = 'apple_watch';
    if (device.toLowerCase().contains('polar')) prov = 'polar_h10';
    if (device.toLowerCase().contains('garmin')) prov = 'garmin';
    if (device.toLowerCase().contains('fitbit')) prov = 'fitbit';
    if (!isAuthenticated) {
      dataError = 'Silakan masuk kembali sebelum menghubungkan wearable.';
      notifyListeners();
      return false;
    }
    dataError = null;
    final res = await ApiService.updateProfile({'wearable_provider': prov});
    if (!res.success) {
      dataError = res.message ?? 'Preferensi wearable tidak tersimpan.';
      notifyListeners();
      return false;
    }
    userProfile.wearableProvider = prov;
    wearable.provider = prov;
    await fetchProfile();
    await fetchWearableSamples();
    return true;
  }

  Future<bool> syncWearable() async {
    final loaded = await fetchWearableSamples();
    await Future.wait([fetchCaparInsights(), fetchOverview()]);
    return loaded && dataError == null;
  }

  Future<bool> confirmActivityTransition(String newActivity) async {
    final activityCode = mapActivityToApi(newActivity);
    activity = newActivity;
    showActivityMovementPrompt = false;
    wearableBridge.setActivity(activityCode);
    notifyListeners();

    if (!isAuthenticated) {
      dataError = 'Silakan masuk kembali untuk menyimpan konfirmasi aktivitas.';
      notifyListeners();
      return false;
    }
    final res = await ApiService.createCheckIn({
      'recorded_at': DateTime.now().toUtc().toIso8601String(),
      'activity': activityCode,
      'posture': activityCode == 'sitting'
          ? 'sitting'
          : activityCode == 'standing'
              ? 'standing'
              : 'unknown',
      'sleep': <String, dynamic>{},
      'symptoms': <String>[],
      'note': 'Aktivitas dikonfirmasi setelah deteksi gerak accelerometer.',
    });
    if (!res.success) {
      dataError = res.message ?? 'Konfirmasi aktivitas gagal disimpan.';
      notifyListeners();
      return false;
    }
    confirmedDailySections.add('activity');
    dataError = null;
    await Future.wait([fetchDailySummary(), fetchCaparInsights()]);
    return true;
  }

  void dismissActivityMovementPrompt() {
    update(() {
      showActivityMovementPrompt = false;
    });
  }

  Future<bool> submitFollowUpResponse({
    required List<String> symptomCodes,
    required List<String> factors,
    required String symptomOnset,
    required String notes,
    String actionTaken = '',
    String responseAfterAction = '',
    String? contextActivity,
  }) async {
    final segmentId = followUpPrompt.segmentId;
    if (!isAuthenticated ||
        segmentId == null ||
        followUpPrompt.status != 'requested') {
      dataError = 'Pertanyaan lanjutan tidak tersedia dari backend.';
      notifyListeners();
      return false;
    }
    final payload = <String, dynamic>{
      'recorded_at': DateTime.now().toIso8601String(),
      'sleep': <String, dynamic>{},
      'symptoms': symptomCodes,
      if (contextActivity != null) 'activity': contextActivity,
      'deviation_follow_up': {
        'segment_id': segmentId,
        'perceived_factors': factors,
        if (symptomOnset.isNotEmpty) 'symptom_onset': symptomOnset,
        if (notes.trim().isNotEmpty) 'note': notes.trim(),
        if (actionTaken.trim().isNotEmpty) 'action_taken': actionTaken.trim(),
        if (responseAfterAction.trim().isNotEmpty)
          'response_after_action': responseAfterAction.trim(),
      },
    };
    final res = await ApiService.createCheckIn(payload);
    if (res.success) {
      followUpPrompt = const CaparFollowUpPrompt(status: 'already_answered');
      notifyListeners();
      await fetchCaparInsights();
      await fetchDailySummary();
      return true;
    }
    dataError = res.message ?? 'Jawaban tindak lanjut gagal disimpan.';
    notifyListeners();
    return false;
  }

  void toggleSymptom(String label) => update(() {
        if (label == kNoSymptom) {
          symptoms = [kNoSymptom];
          return;
        }
        symptoms.remove(kNoSymptom);
        symptoms.contains(label) ? symptoms.remove(label) : symptoms.add(label);
        if (symptoms.isEmpty) symptoms = [kNoSymptom];
      });

  Future<bool> addEvent(EventItem e) async {
    if (!isAuthenticated) {
      dataError = 'Silakan masuk kembali sebelum menyimpan event.';
      notifyListeners();
      return false;
    }
    final res = await ApiService.createEvent(e.toJson());
    if (res.success) {
      await Future.wait(
          [fetchRecentEvents(), fetchDailySummary(), fetchCaparInsights()]);
      return true;
    }
    dataError = res.message ?? 'Event tidak tersimpan di server.';
    notifyListeners();
    return false;
  }

  /// Submit daily check-in matching patient-app-api.md contract
  Future<bool> submitDaily() async {
    if (!isAuthenticated) {
      dataError = 'Silakan masuk kembali sebelum mengirim catatan harian.';
      notifyListeners();
      return false;
    }
    if (confirmedDailySections.isEmpty) {
      dataError =
          'Isi dan simpan setidaknya satu bagian catatan harian sebelum mengirim.';
      notifyListeners();
      return false;
    }

    // Parse measurement values
    num? bpSys, bpDia, tempVal, weightVal, spo2Val, glucVal;
    try {
      final bpVal = measurement('bp').value;
      if (bpVal != null && bpVal.contains('/')) {
        final parts = bpVal.split('/');
        bpSys = num.tryParse(parts[0].trim());
        bpDia = num.tryParse(parts[1].trim());
      }
    } catch (e) {
      dataError = 'Pengukuran tekanan darah tidak valid: $e';
      notifyListeners();
      return false;
    }
    tempVal = num.tryParse(measurement('temp').value ?? '');
    weightVal = num.tryParse(measurement('weight').value ?? '');
    spo2Val = num.tryParse(measurement('spo2').value ?? '');
    glucVal = num.tryParse(measurement('glucose').value ?? '');

    final hasSymptomsSection = hasDailySection('symptoms');
    final hasActivitySection = hasDailySection('activity');
    final hasSleepSection = hasDailySection('sleep');
    final hasMeasurementSection = hasDailySection('measurements');
    final stressValue = stress?.apiValue;
    final payload = <String, dynamic>{
      'recorded_at': logDate.toIso8601String(),
      if (hasSleepSection)
        'sleep': {
          'duration_minutes': sleepMinutes,
          'quality': sleepQuality.apiValue,
          'bedtime':
              '${bedTime.hour.toString().padLeft(2, '0')}:${bedTime.minute.toString().padLeft(2, '0')}',
          'wake_time':
              '${wakeTime.hour.toString().padLeft(2, '0')}:${wakeTime.minute.toString().padLeft(2, '0')}',
          'disturbances': {
            'woke_frequently': sleepWakeOften,
            'difficulty_falling_asleep': sleepHardToSleep,
            'nightmares': sleepNightmare,
          },
        }
      else
        'sleep': <String, dynamic>{},
      'symptoms': hasSymptomsSection && hasSymptoms
          ? symptoms
              .where((s) => s != kNoSymptom)
              .map(mapSymptomLabelToApi)
              .toList()
          : <String>[],
      if (hasSymptomsSection) 'feeling': mood.apiValue,
      if (hasSymptomsSection && hasSymptoms)
        'symptom_severity': (symptomLevel * 3.5 + 1).round().clamp(1, 10),
      if (hasActivitySection) 'activity': mapActivityToApi(activity),
      if (hasActivitySection && stressValue != null)
        'stress_level': stressValue,
      if (hasActivitySection)
        'lifestyle': {
          'meal': habitMeal,
          'caffeine': habitCaffeine,
          'alcohol': habitAlcohol,
          'smoking': habitSmoking,
        },
      if (hasActivitySection) 'medication_taken': habitMedication,
      if (hasActivitySection && routineMedications.isNotEmpty)
        'medication_name': routineMedications.first.name,
      if (hasActivitySection && routineMedications.isNotEmpty)
        'medication_dosage': routineMedications.first.dosage,
      if (hasMeasurementSection)
        'measurements': {
          if (bpSys != null) 'systolic_bp': bpSys,
          if (bpDia != null) 'diastolic_bp': bpDia,
          if (tempVal != null) 'temperature_c': tempVal,
          if (weightVal != null) 'weight_kg': weightVal,
          if (spo2Val != null) 'spo2_pct': spo2Val,
          if (glucVal != null) 'glucose_mg_dl': glucVal,
          'additional': measurements
              .where((entry) =>
                  entry.key.startsWith('custom_') &&
                  entry.value?.isNotEmpty == true)
              .map((entry) => {
                    'name': entry.label,
                    'unit': entry.unit,
                    'value': entry.value,
                  })
              .toList(),
        },
      if (hasDailySection('note') && note.isNotEmpty) 'note': note,
    };

    final res = await ApiService.createCheckIn(payload);
    if (res.success) {
      lastSubmitted = DateTime.now();
      isDailyDraftDirty = false;
      await Future.wait(
          [fetchDailySummary(), fetchCaparInsights(), fetchOverview()]);
      return true;
    }
    dataError = res.message ?? 'Check-in gagal disimpan di server.';
    notifyListeners();
    return false;
  }
}
