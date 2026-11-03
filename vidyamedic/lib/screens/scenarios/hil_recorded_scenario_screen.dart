import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/app_state.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/hil_time.dart';
import '../../widgets/hil_hr_line_chart.dart';
import '../profile/wearable_pairing_screen.dart';

class HilRecordedScenarioAnalysis {
  static bool isElevatedCandidate({
    required double? heartRate,
    required double? baselineMean,
    required double thresholdBpm,
    required double? qSignal,
    required double? qComplete,
    required bool qualityAccepted,
  }) =>
      qualityAccepted &&
      heartRate != null &&
      baselineMean != null &&
      qSignal != null &&
      qSignal >= 0.6 &&
      qComplete != null &&
      qComplete >= 0.6 &&
      heartRate > baselineMean + thresholdBpm;

  static Map<String, dynamic>? maximumHeartRateSample(
    List<Map<String, dynamic>> samples,
  ) {
    Map<String, dynamic>? maximum;
    for (final sample in samples) {
      final heartRate = sample['heart_rate_bpm'];
      if (heartRate is! num || !heartRate.isFinite) continue;
      final currentMaximum = maximum?['heart_rate_bpm'];
      if (currentMaximum is! num || heartRate > currentMaximum) {
        maximum = sample;
      }
    }
    return maximum;
  }

  static bool isQualifiedRawReading(Map<String, dynamic> reading) {
    final heartRate = reading['heart_rate_bpm'];
    final signalConfidence = reading['signal_confidence'];
    return reading['sensor_contact'] == true &&
        heartRate is num &&
        heartRate.isFinite &&
        heartRate >= 20 &&
        heartRate <= 250 &&
        signalConfidence is num &&
        signalConfidence.isFinite &&
        signalConfidence >= 0.6;
  }

  static Map<String, dynamic>? maximumQualifiedRawHeartRateSample(
    List<Map<String, dynamic>> readings,
  ) =>
      maximumHeartRateSample(
        readings.where(isQualifiedRawReading).toList(),
      );

  static bool isElevatedRawReading({
    required Map<String, dynamic> reading,
    required double? baselineMean,
    required double thresholdBpm,
  }) {
    final heartRate = reading['heart_rate_bpm'];
    return isQualifiedRawReading(reading) &&
        heartRate is num &&
        baselineMean != null &&
        heartRate > baselineMean + thresholdBpm;
  }
}

class HilRecordedScenarioScreen extends StatefulWidget {
  const HilRecordedScenarioScreen({
    required this.scenario,
    required this.baselineContexts,
    required this.initialActivity,
    super.key,
  });

  final String scenario;
  final List<Map<String, dynamic>> baselineContexts;
  final String initialActivity;

  @override
  State<HilRecordedScenarioScreen> createState() =>
      _HilRecordedScenarioScreenState();
}

class _HilRecordedScenarioScreenState extends State<HilRecordedScenarioScreen> {
  static const _activities = <(String, String)>[
    ('sitting', 'Duduk'),
    ('standing', 'Berdiri'),
    ('walking', 'Berjalan'),
  ];

  late final String _runId =
      'hil-${widget.scenario}-${DateTime.now().toUtc().microsecondsSinceEpoch}';
  String? _sessionId;
  late String _activity =
      _activities.any((item) => item.$1 == widget.initialActivity)
          ? widget.initialActivity
          : 'sitting';
  final TextEditingController _clarificationController =
      TextEditingController();
  final List<Map<String, dynamic>> _logs = [];
  final Set<String> _loadedSampleIds = {};
  final Set<String> _autoAttemptedDeviationSampleIds = {};
  final Set<String> _handledDeviationSampleIds = {};
  List<Map<String, dynamic>> _samples = [];
  String? _selectedSampleId;
  String? _error;
  String? _recommendation;
  bool _isLoading = true;
  bool _isSaving = false;
  bool _isRefreshingSamples = false;
  bool _isStartingLiveMonitoring = false;
  bool _isLiveMonitoring = false;
  bool _isStoppingLiveMonitoring = false;
  bool _ownsStream = false;
  bool _clarificationRequested = false;
  bool _liveDeviationPrompted = false;
  bool _rawDeviationInProgress = false;
  bool _isStartingRun = false;
  DateTime? _recordingStartedAt;
  DateTime? _recordingStoppedAt;
  final Map<String, Map<String, dynamic>> _recordingSamples = {};
  Timer? _refreshTimer;
  late final AppState _appState;

  @override
  void initState() {
    super.initState();
    _appState = context.read<AppState>();
    _appState.wearableBridge.addListener(_onWearableReadingsChanged);
    unawaited(_initialize());
  }

  Future<void> _initialize() async {
    await _startRun();
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _appState.wearableBridge.removeListener(_onWearableReadingsChanged);
    if (_sessionId != null) unawaited(_completeRun());
    if (_ownsStream && _appState.wearableBridge.isStreaming) {
      unawaited(_appState.wearableBridge.stopStreaming());
    }
    _clarificationController.dispose();
    super.dispose();
  }

  Future<void> _completeRun() async {
    if (_isLiveMonitoring && !_isStoppingLiveMonitoring) {
      await _saveLog(
        'live_recording_stopped',
        explanation: 'Perekaman dihentikan ketika halaman skenario ditutup.',
      );
    }
    final response = await ApiService.completeHilSession(_runId);
    if (!response.success) {
      debugPrint('[HIL] Gagal menutup sesi $_runId: ${response.message}');
    }
  }

  String _normalizeActivity(dynamic value) {
    final activity = value?.toString().trim().toLowerCase() ?? '';
    return switch (activity) {
      'duduk' || 'sit' => 'sitting',
      'berdiri' || 'stand' => 'standing',
      'berjalan' || 'walk' => 'walking',
      _ => activity,
    };
  }

  String _activityLabel(String activity) =>
      _activities
          .where((item) => item.$1 == activity)
          .map((item) => item.$2)
          .firstOrNull ??
      activity;

  String _eventLabel(String eventType) => switch (eventType) {
        'scenario_started' => 'Skenario dibuka',
        'activity_selected' => 'Aktivitas dipilih',
        'live_recording_started' => 'Rekaman sensor dimulai',
        'live_recording_stopped' => 'Rekaman sensor dihentikan',
        'live_recording_interrupted' => 'Rekaman sensor terputus',
        'records_loaded' => 'Data sensor dimuat',
        'deviation_detected' => 'Anomali terdeteksi',
        'feedback_presented' => 'One way feedback',
        'clarification_requested' => 'Klarifikasi diminta',
        'clarification_submitted' => 'Klarifikasi dikirim',
        'zero_shot_generated' => 'Ringkasan otomatis dibuat',
        'zero_shot_failed' => 'Ringkasan otomatis gagal dibuat',
        _ => eventType.replaceAll('_', ' '),
      };

  DateTime? _eventTimestamp(Map<String, dynamic> log) => DateTime.tryParse(
        (log['createdAt'] ?? log['created_at'] ?? log['occurred_at'])
                ?.toString() ??
            '',
      );

  String _eventTimeLabel(Map<String, dynamic> log) {
    final time = _eventTimestamp(log);
    return time == null ? 'Waktu tidak tersedia' : formatHilWibDateTime(time);
  }

  String _eventSummary(Map<String, dynamic> log) {
    final activity = _activityLabel(_normalizeActivity(log['activity']));
    final parts = <String>[];
    final hr = log['heart_rate_bpm'];
    if (hr is num) {
      parts.add('HR raw maks ${hr.toStringAsFixed(1)}');
    }
    final recommendation = log['recommendation']?.toString().trim();
    if (recommendation?.isNotEmpty == true) {
      parts.add(recommendation!);
    }
    final clarification = log['clarification']?.toString().trim();
    if (clarification?.isNotEmpty == true) {
      parts.add('Keterangan: $clarification');
    }
    final explanation = log['explanation']?.toString().trim();
    if (explanation?.isNotEmpty == true) {
      parts.add(explanation!);
    }
    if (parts.isEmpty) return 'Aktivitas: $activity';
    return 'Aktivitas: $activity · ${parts.take(3).join(' · ')}';
  }

  Map<String, dynamic> get _baseline {
    for (final context in widget.baselineContexts) {
      if (_normalizeActivity(context['activity']) != _activity) continue;
      final readiness = _map(context['scenario_readiness']);
      if (readiness['ready'] == true) return context;
    }
    return {};
  }

  Map<String, dynamic> get _hrStats =>
      _map(_map(_baseline['feature_stats'])['mean_hr']);

  double? get _baselineMean {
    final value = _hrStats['mean'];
    return value is num && value.isFinite ? value.toDouble() : null;
  }

  double get _threshold => 0;

  Map<String, dynamic>? get _selectedSample {
    for (final sample in _samples) {
      if (sample['_id']?.toString() == _selectedSampleId) return sample;
    }
    return null;
  }

  double? _sampleHr(Map<String, dynamic> sample) {
    final value = sample['heart_rate_bpm'];
    return value is num && value.isFinite ? value.toDouble() : null;
  }

  bool _isDeviation(Map<String, dynamic> sample) {
    final hr = _sampleHr(sample);
    final mean = _baselineMean;
    final quality = _map(sample['data_quality']);
    final qSignal = quality['q_signal'];
    final qComplete = quality['q_complete'];
    return _baseline.isNotEmpty &&
        HilRecordedScenarioAnalysis.isElevatedCandidate(
          heartRate: hr,
          baselineMean: mean,
          thresholdBpm: _threshold,
          qSignal: qSignal is num ? qSignal.toDouble() : null,
          qComplete: qComplete is num ? qComplete.toDouble() : null,
          qualityAccepted: quality['status'] == 'accepted',
        );
  }

  List<Map<String, dynamic>> _rawSessionReadings() {
    final startedAt = _recordingStartedAt;
    if (startedAt == null) return const [];
    return _appState.wearableBridge.recentStreamReadings.where((reading) {
      final recordedAt =
          DateTime.tryParse(reading['recorded_at']?.toString() ?? '');
      return recordedAt?.isBefore(startedAt) == false &&
          HilRecordedScenarioAnalysis.isQualifiedRawReading(reading);
    }).toList()
      ..sort((a, b) => DateTime.parse(a['recorded_at'].toString())
          .compareTo(DateTime.parse(b['recorded_at'].toString())));
  }

  void _onWearableReadingsChanged() {
    if (!_isLiveMonitoring ||
        _liveDeviationPrompted ||
        _rawDeviationInProgress) {
      return;
    }
    final baseline = _baselineMean;
    if (baseline == null) return;
    final readings = _rawSessionReadings();
    final deviation = readings
        .where(
          (reading) => HilRecordedScenarioAnalysis.isElevatedRawReading(
            reading: reading,
            baselineMean: baseline,
            thresholdBpm: 0,
          ),
        )
        .firstOrNull;
    if (deviation == null) return;
    _liveDeviationPrompted = true;
    _rawDeviationInProgress = true;
    unawaited(_presentLiveRawDeviation(deviation));
  }

  Future<void> _startRun() async {
    if (_sessionId != null || _isStartingRun) return;
    _isStartingRun = true;
    try {
      final session = await ApiService.createHilSession({
        'run_id': _runId,
        'scenario': widget.scenario,
        'source': 'recorded_polar_sample',
        'activity': _activity,
      });
      if (!mounted) {
        if (session.success) {
          await ApiService.completeHilSession(_runId);
        }
        return;
      }
      if (!session.success || session.data == null) {
        setState(() {
          _isLoading = false;
          _error = session.message ?? 'Sesi HIL gagal dimulai.';
        });
        return;
      }
      _sessionId = session.data!['_id']?.toString();
      if (_sessionId == null) {
        final response = await ApiService.completeHilSession(_runId);
        if (!response.success) {
          debugPrint('[HIL] Gagal menutup sesi $_runId: ${response.message}');
        }
        setState(() {
          _isLoading = false;
          _error = 'ID sesi HIL tidak diterima dari server.';
        });
        return;
      }
      final started = await _saveLog('scenario_started');
      if (!started || !mounted) {
        if (!started) {
          final response = await ApiService.completeHilSession(_runId);
          if (!response.success) {
            debugPrint('[HIL] Gagal menutup sesi $_runId: ${response.message}');
          }
        }
        return;
      }
      await _loadSamples();
    } finally {
      _isStartingRun = false;
    }
  }

  Future<void> _loadSamples() async {
    if (_isRefreshingSamples) return;
    _isRefreshingSamples = true;
    setState(() {
      _error = null;
      if (_samples.isEmpty) _isLoading = true;
    });
    final now = DateTime.now().toUtc();
    final recordingStartedAt = _recordingStartedAt;
    final recordingStoppedAt = _recordingStoppedAt;
    final sampleCutoff = recordingStartedAt?.subtract(
      _liveDeviationPrompted ? const Duration(minutes: 1) : Duration.zero,
    );
    final response = await ApiService.getWearableSamples(
      from: (sampleCutoff ?? now.subtract(const Duration(days: 31)))
          .toIso8601String(),
      to: now.toIso8601String(),
      limit: 100,
    );
    if (!mounted) return;
    if (!response.success || response.data == null) {
      setState(() {
        _isLoading = false;
        _error = response.message ?? 'Riwayat HR gagal dimuat.';
      });
      _isRefreshingSamples = false;
      return;
    }
    final samples = response.data!
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .where((sample) {
      final quality = _map(sample['data_quality']);
      final recordedAt =
          DateTime.tryParse(sample['recorded_at']?.toString() ?? '');
      return sample['provider'] == 'polar_h10' &&
          sample['is_simulated'] != true &&
          sample['recording_purpose'] != 'hil_baseline' &&
          _normalizeActivity(sample['activity']) == _activity &&
          sample['sensor_contact'] == true &&
          quality['status'] == 'accepted' &&
          _sampleHr(sample) != null &&
          recordedAt != null &&
          (sampleCutoff == null || !recordedAt.isBefore(sampleCutoff)) &&
          (recordingStoppedAt == null ||
              !recordedAt.isAfter(recordingStoppedAt));
    }).toList()
      ..sort((a, b) => DateTime.parse(a['recorded_at'].toString())
          .compareTo(DateTime.parse(b['recorded_at'].toString())));
    if (recordingStartedAt != null) {
      for (final sample in samples) {
        final id = sample['_id']?.toString();
        if (id != null) _recordingSamples[id] = sample;
      }
    }
    final sessionSamples = _recordingSamples.values.toList()
      ..sort((a, b) => DateTime.parse(a['recorded_at'].toString())
          .compareTo(DateTime.parse(b['recorded_at'].toString())));
    final displayedSamples =
        recordingStartedAt != null ? sessionSamples : samples;
    final targetSample =
        HilRecordedScenarioAnalysis.maximumHeartRateSample(displayedSamples);
    setState(() {
      _samples = displayedSamples;
      final selectedId = _selectedSampleId;
      final selectedSample = targetSample ??
          (displayedSamples.isEmpty ? null : displayedSamples.last);
      _selectedSampleId = selectedSample?['_id']?.toString();
      if (selectedSample != null && _selectedSampleId != selectedId) {
        _recommendation = null;
        _clarificationRequested = false;
        _clarificationController.clear();
      }
      _isLoading = false;
    });

    final newSamples = samples
        .where(
            (sample) => !_loadedSampleIds.contains(sample['_id']?.toString()))
        .toList();
    if (newSamples.isNotEmpty) {
      final saved = await _saveLog(
        'records_loaded',
        sampleIds:
            newSamples.map((sample) => sample['_id'].toString()).toList(),
      );
      if (!saved || !mounted) {
        _isRefreshingSamples = false;
        return;
      }
      _loadedSampleIds.addAll(
        newSamples.map((sample) => sample['_id'].toString()),
      );
    }
    _isRefreshingSamples = false;
    final targetId = targetSample?['_id']?.toString();
    if ((_recordingStartedAt == null || _recordingStoppedAt != null) &&
        targetId != null &&
        _isDeviation(targetSample!) &&
        !_handledDeviationSampleIds.contains(targetId) &&
        _autoAttemptedDeviationSampleIds.add(targetId)) {
      await _presentScenarioOutcome();
    }
  }

  Future<void> _startLiveMonitoring() async {
    if (_isStoppingLiveMonitoring) return;
    if (_isLiveMonitoring) {
      await _stopLiveMonitoring();
      return;
    }
    if (_isStartingLiveMonitoring) return;
    setState(() => _isStartingLiveMonitoring = true);
    final bridge = context.read<AppState>().wearableBridge;
    final startStreamHere = !bridge.isStreaming;
    if (bridge.isDemoDevice) {
      setState(() => _isStartingLiveMonitoring = false);
      _showScenarioError('Skenario B/C hanya menerima data Polar H10 nyata.');
      return;
    }
    if (startStreamHere) {
      await Navigator.of(context).push<void>(
        MaterialPageRoute<void>(
          builder: (_) => WearablePairingScreen(
            activityOverride: _activity,
            startStreamingAndReturnHome: true,
          ),
        ),
      );
      if (!mounted) return;
    }
    if (!bridge.isStreaming || bridge.isDemoDevice) {
      setState(() => _isStartingLiveMonitoring = false);
      _showScenarioError(
        bridge.error ?? 'Streaming Polar H10 belum aktif.',
      );
      return;
    }
    _recordingStartedAt = DateTime.now().toUtc();
    _recordingStoppedAt = null;
    _appState.wearableBridge.setActivity(_activity);
    _recordingSamples.clear();
    _loadedSampleIds.clear();
    _autoAttemptedDeviationSampleIds.clear();
    _handledDeviationSampleIds.clear();
    _liveDeviationPrompted = false;
    _rawDeviationInProgress = false;
    final started = await _saveLog(
      'live_recording_started',
      explanation: 'Rekaman live Polar H10 dimulai.',
    );
    if (!mounted) return;
    if (!started) {
      if (startStreamHere && bridge.isStreaming) {
        await bridge.stopStreaming();
      }
      _recordingStartedAt = null;
      _recordingStoppedAt = null;
      _recordingSamples.clear();
      if (mounted) setState(() => _isStartingLiveMonitoring = false);
      return;
    }
    _ownsStream = startStreamHere;
    setState(() {
      _isLiveMonitoring = true;
      _isStoppingLiveMonitoring = false;
      _isStartingLiveMonitoring = false;
    });
    await _loadSamples();
    if (!mounted || !_isLiveMonitoring) return;
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (!mounted) return;
      if (!bridge.isStreaming) {
        unawaited(_stopLiveMonitoring(interrupted: true));
        _showScenarioError(
          bridge.error ?? 'Streaming Polar H10 terputus.',
        );
        return;
      }
      unawaited(_loadSamples());
    });
  }

  Future<void> _stopLiveMonitoring({bool interrupted = false}) async {
    if (!_isLiveMonitoring || _isStoppingLiveMonitoring) return;
    _isStoppingLiveMonitoring = true;
    _refreshTimer?.cancel();
    _refreshTimer = null;
    _recordingStoppedAt = DateTime.now().toUtc();
    final shouldStopStream = _ownsStream;
    _ownsStream = false;
    _isLiveMonitoring = false;
    if (mounted) setState(() {});
    await _saveLog(
      interrupted ? 'live_recording_interrupted' : 'live_recording_stopped',
      explanation: interrupted
          ? 'Perekaman live berhenti karena koneksi atau streaming Polar H10 terputus.'
          : 'Perekaman live dihentikan oleh pengguna.',
    );
    final bridge = _appState.wearableBridge;
    if (shouldStopStream && bridge.isStreaming) {
      await bridge.stopStreaming();
    }
    _isStoppingLiveMonitoring = false;
    while (_isRefreshingSamples && mounted) {
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    if (mounted) await _loadSamples();
  }

  void _showScenarioError(String message) {
    if (!mounted) return;
    setState(() => _error = message);
  }

  Future<bool> _saveLog(
    String eventType, {
    String? sampleId,
    List<String> sampleIds = const [],
    double? rawHeartRate,
    DateTime? rawRecordedAt,
    String? recommendation,
    String? clarification,
    String? explanation,
  }) async {
    final sessionId = _sessionId;
    if (sessionId == null) {
      debugPrint(
          '[HIL] Log $eventType tidak dapat disimpan tanpa sesi HIL aktif.');
      return false;
    }
    final response = await ApiService.createHilScenarioLog({
      'session_id': sessionId,
      'run_id': _runId,
      'scenario': widget.scenario,
      'event_type': eventType,
      'activity': _activity,
      if (sampleId != null) 'sample_id': sampleId,
      if (sampleIds.isNotEmpty) 'sample_ids': sampleIds,
      if (rawHeartRate != null) 'raw_hr': rawHeartRate,
      if (rawRecordedAt != null)
        'raw_recorded_at': rawRecordedAt.toUtc().toIso8601String(),
      if (recommendation != null) 'recommendation': recommendation,
      if (clarification != null) 'clarification': clarification,
      if (explanation != null) 'explanation': explanation,
    });
    if (!mounted) return false;
    if (!response.success || response.data == null) {
      setState(() {
        _error = response.message ?? 'Log eksperimen gagal disimpan.';
      });
      return false;
    }
    setState(() {
      _error = null;
      _logs.add(response.data!);
    });
    return true;
  }

  Future<Map<String, dynamic>?> _logSelectedObservation(
    String eventType, {
    double? rawHeartRate,
    DateTime? rawRecordedAt,
    String? recommendation,
    String? clarification,
    String? explanation,
  }) async {
    final sample = _selectedSample;
    final sampleId = sample?['_id']?.toString();
    if (sample == null || sampleId == null) return null;
    final saved = await _saveLog(
      eventType,
      sampleId: sampleId,
      rawHeartRate: rawHeartRate,
      rawRecordedAt: rawRecordedAt,
      recommendation: recommendation,
      clarification: clarification,
      explanation: explanation,
    );
    if (!saved || _logs.isEmpty) return null;
    return _logs.last;
  }

  Future<void> _presentScenarioOutcome() async {
    final sample = _selectedSample;
    final sampleId = sample?['_id']?.toString();
    if ((widget.scenario == 'C' &&
            (_recordingStartedAt == null ||
                _recordingStoppedAt == null ||
                _isLiveMonitoring)) ||
        sample == null ||
        sampleId == null ||
        _isSaving ||
        _handledDeviationSampleIds.contains(sampleId)) {
      return;
    }
    setState(() {
      _isSaving = true;
      _error = null;
    });
    final deviationLog = await _logSelectedObservation('deviation_detected');
    if (!mounted) return;
    if (deviationLog == null) {
      setState(() => _isSaving = false);
      return;
    }
    final status =
        deviationLog['algorithm_status']?.toString() ?? 'not_assessable';
    if (status != 'candidate_deviation') {
      setState(() {
        _isSaving = false;
        _error = status == 'not_assessable'
            ? 'Bukti atau baseline belum cukup untuk menilai deviasi.'
            : 'Sampel rekaman ini tidak melewati ambang deviasi HIL.';
      });
      return;
    }
    _handledDeviationSampleIds.add(sampleId);

    if (widget.scenario == 'B') {
      final recommendation =
          'Anomali terdeteksi pada denyut saat $_activity. Istirahat 5–10 menit, hentikan aktivitas berat, dan cek ulang denyut setelah Anda tenang. Jika HR tetap tinggi atau disertai pusing, nyeri dada, sesak napas, atau lemas, segera konsultasikan ke tenaga kesehatan.';
      final feedbackLog = await _logSelectedObservation(
        'feedback_presented',
        recommendation: recommendation,
      );
      if (!mounted) return;
      setState(() {
        _isSaving = false;
        if (feedbackLog != null) _recommendation = recommendation;
      });
      if (feedbackLog == null) _handledDeviationSampleIds.remove(sampleId);
      if (feedbackLog != null) {
        final appState = context.read<AppState>();
        final saved = await appState.recordHumanInTheLoopScenario(
          scenario: 'B',
          explanationSnapshot: _explanationSnapshot(
            recommendation,
            status,
            sourceLogId: feedbackLog['_id'].toString(),
            sampleId: feedbackLog['sample_id'].toString(),
          ),
        );
        if (!saved && mounted) {
          setState(() {
            _error = 'Feedback B sudah ditampilkan, tetapi histori penjelasan '
                'belum tersimpan: ${appState.dataError ?? 'coba lagi.'}';
          });
        }
        await _showScenarioResultDialog(
          title: 'Skenario B · One way feedback',
          summary: _buildObservationSummary(
            deviationLog,
            participantContext: null,
          ),
          recommendation: recommendation,
        );
      }
      return;
    }

    final requested = await _logSelectedObservation('clarification_requested');
    if (!mounted) return;
    setState(() {
      _isSaving = false;
      _clarificationRequested = requested != null;
    });
    if (requested == null) {
      _handledDeviationSampleIds.remove(sampleId);
      return;
    }
    await _openClarificationPicker();
  }

  Future<Map<String, dynamic>?> _persistRawDeviationSample(
    Map<String, dynamic> rawReading,
  ) async {
    final rawTime =
        DateTime.tryParse(rawReading['recorded_at']?.toString() ?? '');
    if (rawTime == null) return null;
    final bridge = _appState.wearableBridge;

    for (var attempt = 0; attempt < 5; attempt++) {
      await bridge.flushSample(force: true);
      if (!mounted) return null;
      while (_isRefreshingSamples && mounted) {
        await Future<void>.delayed(const Duration(milliseconds: 100));
      }
      if (!mounted) return null;
      await _loadSamples();
      final candidates = _samples.where((sample) {
        final sampleTime =
            DateTime.tryParse(sample['recorded_at']?.toString() ?? '');
        return sampleTime != null &&
            sampleTime.difference(rawTime).abs() <=
                const Duration(seconds: 90);
      }).toList()
        ..sort((left, right) {
          final leftTime = DateTime.parse(left['recorded_at'].toString());
          final rightTime = DateTime.parse(right['recorded_at'].toString());
          final distance = leftTime
              .difference(rawTime)
              .abs()
              .compareTo(rightTime.difference(rawTime).abs());
          if (distance != 0) return distance;
          return (_sampleHr(right) ?? 0).compareTo(_sampleHr(left) ?? 0);
        });
      if (candidates.isNotEmpty) return candidates.first;
      if (attempt < 4) {
        await Future<void>.delayed(const Duration(seconds: 1));
      }
    }
    return null;
  }

  Future<void> _presentLiveRawDeviation(
    Map<String, dynamic> rawReading,
  ) async {
    final rawHr = _sampleHr(rawReading);
    final rawTime =
        DateTime.tryParse(rawReading['recorded_at']?.toString() ?? '');
    if (rawHr == null || rawTime == null || !mounted) {
      _rawDeviationInProgress = false;
      return;
    }

    final sampleFuture = _persistRawDeviationSample(rawReading);
    if (widget.scenario == 'B') {
      final recommendation =
          'HR raw saat $_activity melewati rata-rata baseline personal. Istirahat sejenak, hentikan aktivitas berat, lalu cek kembali. Jika denyut tetap tinggi atau disertai gejala yang mengkhawatirkan, hubungi tenaga kesehatan.';
      setState(() {
        _recommendation = recommendation;
      });
      await _showScenarioResultDialog(
        title: 'Skenario B · One way feedback',
        summary: 'HR raw ${rawHr.toStringAsFixed(1)} terdeteksi '
            '${formatHilWibDateTime(rawTime)}, lebih tinggi dari rata-rata '
            'baseline aktivitas. Ini observasi, bukan diagnosis.',
        recommendation: recommendation,
      );
      if (!mounted) return;
      setState(() {
        _isSaving = true;
        _error = null;
      });
      final sample = await sampleFuture;
      if (!mounted) return;
      final sampleId = sample?['_id']?.toString();
      if (sample == null || sampleId == null) {
        setState(() {
          _isSaving = false;
          _rawDeviationInProgress = false;
          _error = 'Feedback sudah ditampilkan dan rekaman tetap berjalan, '
              'tetapi sampel Polar belum tersedia untuk menyimpan histori.';
        });
        return;
      }
      setState(() => _selectedSampleId = sampleId);
      final deviation = await _logSelectedObservation(
        'deviation_detected',
        rawHeartRate: rawHr,
        rawRecordedAt: rawTime,
      );
      if (!mounted) return;
      if (deviation == null ||
          deviation['algorithm_status'] != 'candidate_deviation') {
        setState(() {
          _isSaving = false;
          _rawDeviationInProgress = false;
          _error = 'Feedback sudah ditampilkan, tetapi sampel tersimpan '
              'belum mengonfirmasi HR raw di atas baseline.';
        });
        return;
      }
      final feedback = await _logSelectedObservation(
        'feedback_presented',
        recommendation: recommendation,
      );
      if (!mounted) return;
      if (feedback == null) {
        setState(() {
          _isSaving = false;
          _rawDeviationInProgress = false;
        });
        return;
      }
      _handledDeviationSampleIds.add(sampleId);
      final appState = context.read<AppState>();
      final saved = await appState.recordHumanInTheLoopScenario(
        scenario: 'B',
        explanationSnapshot: _explanationSnapshot(
          recommendation,
          'candidate_deviation',
          sourceLogId: feedback['_id'].toString(),
          sampleId: feedback['sample_id'].toString(),
        ),
      );
      if (!mounted) return;
      setState(() {
        _isSaving = false;
        _rawDeviationInProgress = false;
        if (!saved) {
          _error = 'Feedback sudah ditampilkan, tetapi histori penjelasan '
              'belum tersimpan: ${appState.dataError ?? 'coba lagi.'}';
        }
      });
      return;
    }

    final answerFuture = _showClarificationDialog(
      rawHeartRate: rawHr,
      observedAt: rawTime,
    );
    final answer = await answerFuture;
    if (!mounted) return;
    if (answer == null) {
      setState(() {
        _rawDeviationInProgress = false;
        _clarificationRequested = false;
      });
      return;
    }

    setState(() {
      _isSaving = true;
      _clarificationController.text = answer;
      _clarificationRequested = true;
      _error = null;
    });
    final sample = await sampleFuture;
    if (!mounted) return;
    final sampleId = sample?['_id']?.toString();
    if (sample == null || sampleId == null) {
      setState(() {
        _isSaving = false;
        _rawDeviationInProgress = false;
        _error = 'Deviasi HR raw terdeteksi dan jawaban tersimpan sementara, '
            'tetapi sampel Polar berkualitas belum tersedia untuk menyimpan '
            'klarifikasi. Hentikan rekaman lalu muat ulang observasi.';
      });
      return;
    }

    setState(() {
      _selectedSampleId = sampleId;
    });
    final deviation = await _logSelectedObservation(
      'deviation_detected',
      rawHeartRate: rawHr,
      rawRecordedAt: rawTime,
    );
    if (!mounted) return;
    if (deviation == null ||
        deviation['algorithm_status'] != 'candidate_deviation') {
      setState(() {
        _isSaving = false;
        _rawDeviationInProgress = false;
        _error = 'Popup sudah ditampilkan, tetapi deviasi belum dapat '
            'disimpan dari sampel Polar yang tervalidasi.';
      });
      return;
    }
    final requested = await _logSelectedObservation('clarification_requested');
    if (!mounted) return;
    if (requested == null) {
      setState(() {
        _isSaving = false;
        _rawDeviationInProgress = false;
      });
      return;
    }
    final submitted = await _logSelectedObservation(
      'clarification_submitted',
      clarification: answer,
    );
    if (!mounted) return;
    setState(() {
      _isSaving = false;
      _rawDeviationInProgress = false;
      _clarificationRequested = submitted == null;
      if (submitted != null) _handledDeviationSampleIds.add(sampleId);
    });
  }

  Map<String, dynamic> _explanationSnapshot(
    String explanation,
    String status, {
    required String sourceLogId,
    required String sampleId,
  }) {
    return {
      'version': 1,
      'session_id': _sessionId,
      'run_id': _runId,
      'scenario': widget.scenario,
      'segment_id': null,
      'sample_id': sampleId,
      'source_log_id': sourceLogId,
      'activity': _activity,
      'explanation': explanation,
      'status': status,
      'quality_status': 'accepted',
      'baseline_ready': _baseline.isNotEmpty,
      'factors': ['mean_hr'],
    };
  }

  Future<String?> _showClarificationDialog({
    double? rawHeartRate,
    DateTime? observedAt,
  }) async {
    String? choice = _clarificationController.text.trim().isNotEmpty
        ? _clarificationController.text.trim()
        : null;
    final otherContextController = TextEditingController();
    final selected = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) {
          final options = <String>[
            'Saya berolahraga sebelum perubahan denyut',
            'Saya berjalan atau bergerak sebelum perubahan denyut',
            'Saya sedang beraktivitas saat perubahan denyut',
            'Saya sedang beristirahat',
            'Saya sedang stres atau cemas',
            'Saya baru makan atau minum',
            'Saya tidak ingat / tidak yakin',
            'Tidak ada aktivitas atau konteks khusus sebelumnya',
          ];
          return AlertDialog(
            key: const Key('hil-recorded-clarification-dialog'),
            title: const Text('Ada aktivitas atau konteks sebelumnya?'),
            content: SizedBox(
              width: 420,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 420),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (rawHeartRate != null) ...[
                        Text(
                          'HR raw mencapai ${rawHeartRate.toStringAsFixed(1)}, melewati rata-rata baseline aktivitas. '
                          '${observedAt == null ? '' : 'Terdeteksi ${formatHilWibDateTime(observedAt)}. '}'
                          'Apa konteks sebelum perubahan ini?',
                          key: const Key('hil-recorded-raw-deviation-prompt'),
                        ),
                        const SizedBox(height: 10),
                      ],
                      const Text(
                        'Aktivitas apa yang terjadi sebelum perubahan denyut terdeteksi?',
                      ),
                      const SizedBox(height: 10),
                      ...options.map((option) {
                        final isSelected = choice == option;
                        return InkWell(
                          onTap: () => setDialogState(() => choice = option),
                          child: Container(
                            width: double.infinity,
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isSelected
                                    ? AppTheme.primary
                                    : AppTheme.divider,
                              ),
                              color: isSelected ? AppTheme.primarySoft : null,
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    option,
                                    style: AppTheme.font(
                                      size: 11,
                                      weight: isSelected
                                          ? FontWeight.w700
                                          : FontWeight.w500,
                                    ),
                                  ),
                                ),
                                if (isSelected)
                                  Icon(
                                    Icons.check_circle,
                                    color: AppTheme.primary,
                                    size: 18,
                                  ),
                              ],
                            ),
                          ),
                        );
                      }),
                      TextField(
                        controller: otherContextController,
                        maxLength: 300,
                        maxLines: 2,
                        decoration: const InputDecoration(
                          labelText: 'Hal lain (opsional)',
                          hintText: 'Tambahkan konteks bila diperlukan',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, null),
                child: const Text('Batal'),
              ),
              FilledButton(
                onPressed: () {
                  final other = otherContextController.text.trim();
                  final answer = [
                    if (choice != null) choice,
                    if (other.isNotEmpty) 'Hal lain: $other',
                  ].join(' · ');
                  if (answer.isNotEmpty) {
                    Navigator.pop(dialogContext, answer);
                  }
                },
                child: const Text('Kirim jawaban'),
              ),
            ],
          );
        },
      ),
    );
    otherContextController.dispose();
    if (!mounted) return null;
    return selected;
  }

  Future<void> _openClarificationPicker() async {
    final selected = await _showClarificationDialog();
    if (!mounted) return;
    if (selected == null) {
      setState(() => _clarificationRequested = false);
      return;
    }
    setState(() {
      _clarificationController.text = selected;
      _clarificationController.selection = TextSelection.collapsed(
        offset: _clarificationController.text.length,
      );
    });
    await _submitClarification();
  }

  Future<void> _submitClarification() async {
    final clarification = _clarificationController.text.trim();
    if (clarification.isEmpty || _selectedSample == null) {
      setState(() => _error = 'Isi konteks sebelum mengirim klarifikasi.');
      return;
    }
    final submitted = await _logSelectedObservation(
      'clarification_submitted',
      clarification: clarification,
    );
    if (!mounted) return;
    if (submitted != null) {
      setState(() => _clarificationRequested = false);
    }
  }

  String _buildObservationSummary(
    Map<String, dynamic> log, {
    required String? participantContext,
  }) {
    final observedAt = DateTime.tryParse(log['observed_at']?.toString() ?? '');
    final heartRate = log['heart_rate_bpm'];
    return [
      if (observedAt != null)
        'Waktu sampel: ${formatHilWibDateTime(observedAt)}.',
      if (heartRate is num)
        'HR raw maksimum: ${heartRate.toStringAsFixed(1)}.',
      'Deviasi terdeteksi pada bacaan berkualitas. Ini observasi, bukan diagnosis.',
      if (participantContext != null)
        'Klarifikasi peserta: $participantContext. Informasi ini adalah laporan peserta, bukan bukti penyebab.',
    ].join('\n');
  }

  Future<void> _showScenarioResultDialog({
    required String title,
    required String summary,
    required String recommendation,
  }) async {
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        key: const Key('hil-recorded-result-dialog'),
        title: Text(title),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Ringkasan observasi',
                style: AppTheme.font(size: 12, weight: FontWeight.w800),
              ),
              const SizedBox(height: 6),
              Text(summary),
              const SizedBox(height: 16),
              Text(
                'Saran umum',
                style: AppTheme.font(size: 12, weight: FontWeight.w800),
              ),
              const SizedBox(height: 6),
              Text(recommendation),
            ],
          ),
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Mengerti'),
          ),
        ],
      ),
    );
  }

  Map<String, dynamic> _map(dynamic value) =>
      value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

  Widget _hrPerSecondCard() {
    final isLiveRawScenario = _isLiveMonitoring;
    final source = isLiveRawScenario ? _rawSessionReadings() : _samples;
    final samples = source.reversed.take(30).toList().reversed.toList();
    final maximum = isLiveRawScenario
        ? HilRecordedScenarioAnalysis.maximumQualifiedRawHeartRateSample(
            source,
          )
        : HilRecordedScenarioAnalysis.maximumHeartRateSample(source);
    final maximumHr = maximum == null ? null : _sampleHr(maximum);
    final readings = samples.map(_sampleHr).whereType<double>().toList();
    return Card(
      key: const Key('hil-recorded-hr-per-second'),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'HR per detik · ${_activityLabel(_activity)}',
              style: AppTheme.font(size: 12, weight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              maximumHr == null
                  ? 'Belum ada bacaan HR berkualitas.'
                  : 'HR raw maksimum: ${maximumHr.toStringAsFixed(1)}.',
              style: AppTheme.font(size: 10, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 8),
            if (samples.isEmpty)
              const SizedBox(
                height: 190,
                child: Center(
                  child: Text('Grafik HR akan muncul setelah sensor merekam.'),
                ),
              )
            else
              HilHrLineChart(
                chartKey: const Key('hil-recorded-hr-line-chart'),
                readings: readings,
                personalBaseline: _baselineMean,
                activityAverage: null,
              ),
            Text(
              '${samples.length} bacaan per detik berkualitas ditampilkan pada grafik.',
              style: AppTheme.font(size: 9.5, color: AppTheme.textMuted),
            ),
          ],
        ),
      ),
    );
  }

  Widget _observationCard() {
    final liveRawPeak = _isLiveMonitoring
        ? HilRecordedScenarioAnalysis.maximumQualifiedRawHeartRateSample(
            _rawSessionReadings(),
          )
        : null;
    final sample = liveRawPeak ?? _selectedSample;
    final hr = sample == null ? null : _sampleHr(sample);
    final candidate = liveRawPeak != null
        ? HilRecordedScenarioAnalysis.isElevatedRawReading(
            reading: liveRawPeak,
            baselineMean: _baselineMean,
            thresholdBpm: _threshold,
          )
        : sample != null && _isDeviation(sample);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'HR raw per detik',
              style: AppTheme.font(size: 12, weight: FontWeight.w800),
            ),
            const SizedBox(height: 7),
            if (_recordingStartedAt != null && _recordingStoppedAt == null)
              const Text(
              'HR raw sesi diperiksa per bacaan; popup hanya muncul sekali selama rekaman.',
                key: Key('hil-recorded-peak-guidance'),
              ),
            if (_samples.isEmpty && liveRawPeak == null)
              const Text(
                  'Belum ada sampel Polar H10 yang valid pada rekaman ini.'),
            if (sample != null) ...[
              const SizedBox(height: 8),
              Text(
                'Polar H10 · ${DateTime.tryParse(sample['recorded_at']?.toString() ?? '') == null ? 'waktu tidak diketahui' : formatHilWibDateTime(DateTime.parse(sample['recorded_at'].toString()))}',
                key: const Key('hil-recorded-observation-time'),
                style: AppTheme.font(size: 10, color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 4),
              Text(
                'HR raw maksimum: ${hr?.toStringAsFixed(1) ?? '-'}',
                key: const Key('hil-recorded-observation-summary'),
                style: AppTheme.font(size: 11, weight: FontWeight.w700),
              ),
              Text(
                candidate
                    ? liveRawPeak != null
                        ? _liveDeviationPrompted
                            ? 'HR raw melewati rata-rata baseline; popup sudah ditampilkan sekali, rekaman tetap berjalan.'
                            : 'HR raw melewati rata-rata baseline.'
                        : 'Deviasi terdeteksi pada HR maksimum; mutu bacaan lolos.'
                    : _baseline.isEmpty
                        ? 'Pembanding aktivitas belum tersedia untuk menilai deviasi.'
                        : 'Belum ada deviasi pada HR maksimum bacaan.',
                key: const Key('hil-recorded-observation-explanation'),
                style: AppTheme.font(
                  size: 10,
                  color:
                      candidate ? AppTheme.statusRed : AppTheme.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              FilledButton.icon(
                key: const Key('hil-recorded-trigger-scenario'),
                onPressed: candidate &&
                        (widget.scenario != 'C' ||
                            (_recordingStartedAt != null &&
                                _recordingStoppedAt != null &&
                                !_isLiveMonitoring)) &&
                        !_isSaving &&
                        !_handledDeviationSampleIds.contains(_selectedSampleId)
                    ? _presentScenarioOutcome
                    : null,
                icon: _isSaving
                    ? const SizedBox(
                        width: 15,
                        height: 15,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.bolt_rounded),
                label: Text(
                    _handledDeviationSampleIds.contains(_selectedSampleId)
                        ? 'Skenario sudah berjalan'
                        : widget.scenario == 'C' &&
                                _recordingStartedAt != null &&
                                _recordingStoppedAt == null
                            ? 'HR maksimum sementara'
                            : widget.scenario == 'B'
                                ? 'Tampilkan feedback'
                                : 'Tanyakan konteks sebelumnya'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _logHistory() => Card(
        key: const Key('hil-recorded-log-history'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Ringkasan langkah dan waktu (WIB)',
                  style: AppTheme.font(size: 12, weight: FontWeight.w800)),
              const SizedBox(height: 4),
              const Text(
                'Setiap waktu menunjukkan kapan langkah dicatat. Untuk data sensor, waktu bacaan Polar H10 juga ditampilkan terpisah.',
                key: Key('hil-recorded-log-time-explanation'),
              ),
              const SizedBox(height: 6),
              Text('Nomor sesi: $_runId', style: AppTheme.font(size: 9.5)),
              ..._logs.take(5).map((log) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.check_circle_outline, size: 16),
                    title: Text(
                      '${_eventLabel(log['event_type']?.toString() ?? '')} · ${_eventTimeLabel(log)}',
                    ),
                    subtitle: Text(
                      _eventSummary(log),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  )),
            ],
          ),
        ),
      );

  Widget _analysisNodesCard() => Card(
        key: const Key('hil-recorded-analysis-nodes'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Arti tahapan analisis',
                style: AppTheme.font(size: 12, weight: FontWeight.w800),
              ),
              const SizedBox(height: 7),
              const Text(
                '1. Pengukuran: denyut jantung berasal dari Polar H10 dan dicatat bersama aktivitas serta waktunya.',
              ),
              const SizedBox(height: 4),
              const Text(
                '2. Pemeriksaan mutu: aplikasi memastikan sensor menempel, bacaan cukup lengkap, dan sinyal layak sebelum membandingkan hasil.',
              ),
              const SizedBox(height: 4),
              Text(
                '3. Pola pribadi untuk aktivitas ini menjadi pembanding deviasi.',
              ),
              const SizedBox(height: 4),
              const Text(
                '4. HR raw per detik yang lolos mutu dibandingkan dengan rata-rata baseline aktivitas. Popup hanya muncul sekali saat HR raw melewati rata-rata; rekaman tetap berjalan. Ini pengamatan, bukan diagnosis.',
              ),
              const SizedBox(height: 4),
              Text(
                widget.scenario == 'B'
                    ? '5. Puncak rekaman: HR tertinggi pada sesi ini dibandingkan dengan baseline aktivitas terpilih; ELSTM tidak digunakan.\n6. One way feedback: sistem memberi arahan tindakan yang jelas tanpa meminta jawaban.\n7. Freeze: hasil anomali dibekukan agar tidak hilang saat feedback atau sinyal normal kembali.'
                    : '5. Puncak rekaman: HR tertinggi pada sesi ini dibandingkan dengan baseline aktivitas terpilih; ELSTM tidak digunakan.\n6. Klarifikasi pengguna: sistem mencatat kapan pertanyaan dikirim dan kapan jawaban diterima. Jawaban pengguna dibedakan dari hasil sensor.\n7. Freeze: hasil observasi dan penjelasan yang sudah dibuat tetap tersimpan agar tidak hilang saat perubahan berikutnya muncul.',
              ),
            ],
          ),
        ),
      );

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: Text(
              'Skenario ${widget.scenario} · ${_activityLabel(_activity)}'),
          actions: [
            IconButton(
              key: const Key('hil-recorded-refresh'),
              tooltip: 'Muat ulang rekaman',
              onPressed: _isLoading ? null : _loadSamples,
              icon: const Icon(Icons.refresh_rounded),
            ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.scenario == 'B'
                          ? 'Skenario B · one way feedback'
                          : 'Skenario C · klarifikasi dari pengguna',
                      style: AppTheme.font(size: 14, weight: FontWeight.w800),
                    ),
                    const SizedBox(height: 5),
                    const Text(
                      'Skenario memakai bacaan Polar H10 nyata dan pola pribadi untuk aktivitas yang sama. Data simulasi dan data pembentukan pola tidak dipakai sebagai hasil tes.',
                    ),
                    const SizedBox(height: 5),
                    const Text(
                      'Skenario membaca HR per detik, memeriksa mutu sensor, lalu menggunakan HR maksimum untuk menilai deviasi terhadap baseline aktivitas. Tidak ada grafik atau ringkasan rata-rata BPM.',
                      key: Key('hil-recorded-peak-method'),
                    ),
                    const SizedBox(height: 8),
                    _liveRecordingCard(),
                    DropdownButtonFormField<String>(
                      key: const Key('hil-recorded-activity-picker'),
                      initialValue: _activity,
                      decoration: const InputDecoration(labelText: 'Aktivitas'),
                      items: _activities
                          .map((item) => DropdownMenuItem(
                                value: item.$1,
                                child: Text(item.$2),
                              ))
                          .toList(),
                      onChanged: _isLoading || _isLiveMonitoring
                          ? null
                          : (activity) async {
                              if (activity == null) return;
                              final previousActivity = _activity;
                              setState(() {
                                _activity = activity;
                                _samples = [];
                                _selectedSampleId = null;
                                _recordingStartedAt = null;
                                _recordingStoppedAt = null;
                                _recordingSamples.clear();
                                _recommendation = null;
                                _clarificationRequested = false;
                                _clarificationController.clear();
                                _autoAttemptedDeviationSampleIds.clear();
                                _handledDeviationSampleIds.clear();
                              });
                              final saved = await _saveLog(
                                'activity_selected',
                                explanation:
                                    'Aktivitas diubah dari ${_activityLabel(previousActivity)} ke ${_activityLabel(activity)}.',
                              );
                              if (saved && mounted) await _loadSamples();
                            },
                    ),
                  ],
                ),
              ),
            ),
            if (_error != null)
              Card(
                color: AppTheme.statusYellowBg,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(
                    _error!,
                    key: const Key('hil-recorded-error'),
                    style: AppTheme.font(color: AppTheme.statusRed),
                  ),
                ),
              ),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              )
            else ...[
              _hrPerSecondCard(),
              _observationCard(),
              _analysisNodesCard(),
              if (_samples.isEmpty && !_isLoading) _noSamplesGuidanceCard(),
              if (_samples.isNotEmpty &&
                  !_isDeviation(_selectedSample ?? const {}) &&
                  !_clarificationRequested &&
                  _recommendation == null)
                _noDeviationGuidanceCard(),
              _logHistory(),
            ],
          ],
        ),
      );

  Widget _liveRecordingCard() {
    final bridge = context.watch<AppState>().wearableBridge;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              key: const Key('hil-recorded-live-monitor'),
              onPressed: _isSaving ||
                      _isStartingLiveMonitoring ||
                      _isStoppingLiveMonitoring
                  ? null
                  : () => unawaited(_startLiveMonitoring()),
              icon: _isStartingLiveMonitoring || _isStoppingLiveMonitoring
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(_isLiveMonitoring ? Icons.stop : Icons.sensors),
              label: Text(_isStoppingLiveMonitoring
                  ? 'Menyimpan waktu berhenti...'
                  : _isStartingLiveMonitoring
                      ? 'Menghubungkan Polar H10...'
                      : _isLiveMonitoring
                          ? 'Hentikan rekam & pantau'
                          : 'Rekam H10 & jalankan Skenario ${widget.scenario}'),
            ),
          ),
          if (_isLiveMonitoring)
            Padding(
              padding: const EdgeInsets.only(top: 5),
              child: Text(
                'Polar H10 ${bridge.isStreaming ? 'aktif' : 'terputus'} · HR raw dipantau langsung; riwayat sampel disinkronkan tiap 30 detik. '
                'Popup hanya muncul sekali saat HR raw melewati rata-rata baseline; rekaman tetap berjalan.',
                key: const Key('hil-recorded-live-monitor-status'),
                style: AppTheme.font(
                  size: 10,
                  color: AppTheme.textSecondary,
                ),
              ),
            ),
          if (!_isLiveMonitoring)
            Padding(
              padding: const EdgeInsets.only(top: 5),
              child: Text(
                bridge.isStreaming && !bridge.isDemoDevice
                    ? 'Polar H10 terhubung dan merekam.'
                    : bridge.isConnected && !bridge.isDemoDevice
                        ? 'Polar H10 terhubung, tetapi streaming belum dimulai.'
                        : bridge.isDemoDevice
                            ? 'Perangkat demo terdeteksi; skenario memerlukan Polar H10 nyata.'
                            : 'Polar H10 belum terhubung. Tekan tombol untuk menghubungkan dan mulai merekam.',
                key: const Key('hil-recorded-wearable-connection'),
                style: AppTheme.font(
                  size: 10,
                  color: bridge.isStreaming && !bridge.isDemoDevice
                      ? AppTheme.statusGreen
                      : AppTheme.statusOrange,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _noSamplesGuidanceCard() => Card(
        key: const Key('hil-recorded-no-samples-guidance'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Text(
            'Belum ada rekaman Polar H10 yang layak untuk aktivitas ini. Mulai rekam untuk melihat HR per detik dan menjalankan skenario bila ada deviasi.',
            style: AppTheme.font(
              size: 10.5,
              color: AppTheme.textSecondary,
              height: 1.4,
            ),
          ),
        ),
      );

  Widget _noDeviationGuidanceCard() => Card(
        key: const Key('hil-recorded-no-deviation-guidance'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Belum ada perubahan menonjol pada bacaan terpilih',
                style: AppTheme.font(size: 12, weight: FontWeight.w800),
              ),
              const SizedBox(height: 5),
              Text(
                'Belum ada HR maksimum yang menunjukkan deviasi pada bacaan berkualitas. Muat ulang setelah rekaman terbaru tersedia.',
                style: AppTheme.font(
                  size: 10.5,
                  color: AppTheme.textSecondary,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                key: const Key('hil-recorded-refresh-observations'),
                onPressed: _isRefreshingSamples
                    ? null
                    : () => unawaited(_loadSamples()),
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Muat ulang observasi'),
              ),
            ],
          ),
        ),
      );
}
