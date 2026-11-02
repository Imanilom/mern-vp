import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../providers/app_state.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/hil_time.dart';
import '../pedagogy/history_trend_chart.dart';
import '../profile/wearable_pairing_screen.dart';

class HilRecordedScenarioAnalysis {
  static double threshold(double? baselineStandardDeviation) =>
      math.max(10, (baselineStandardDeviation ?? 0) * 2);

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

  static Map<String, dynamic>? latestDeviationSample({
    required List<Map<String, dynamic>> samples,
    required double? baselineMean,
    required double thresholdBpm,
  }) {
    for (final sample in samples.reversed) {
      final quality = sample['data_quality'];
      final dataQuality =
          quality is Map ? Map<String, dynamic>.from(quality) : const {};
      final qSignal = dataQuality['q_signal'];
      final qComplete = dataQuality['q_complete'];
      final heartRate = sample['heart_rate_bpm'];
      if (isElevatedCandidate(
        heartRate: heartRate is num ? heartRate.toDouble() : null,
        baselineMean: baselineMean,
        thresholdBpm: thresholdBpm,
        qSignal: qSignal is num ? qSignal.toDouble() : null,
        qComplete: qComplete is num ? qComplete.toDouble() : null,
        qualityAccepted: dataQuality['status'] == 'accepted',
      )) {
        return sample;
      }
    }
    return null;
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
  String? _zeroShotExplanation;
  bool _isLoading = true;
  bool _isSaving = false;
  bool _isRefreshingSamples = false;
  bool _isStartingLiveMonitoring = false;
  bool _isLiveMonitoring = false;
  bool _isStoppingLiveMonitoring = false;
  bool _ownsStream = false;
  bool _clarificationRequested = false;
  bool _isGeneratingExplanation = false;
  bool _isResultFrozen = false;
  bool _isStartingRun = false;
  Map<String, dynamic>? _frozenOutcomeSnapshot;
  DateTime? _recordingStartedAt;
  DateTime? _recordingStoppedAt;
  final Map<String, Map<String, dynamic>> _recordingSamples = {};
  Timer? _refreshTimer;
  late final AppState _appState;

  @override
  void initState() {
    super.initState();
    _appState = context.read<AppState>();
    unawaited(_initialize());
  }

  Future<void> _initialize() async {
    await _restoreFrozenOutcome();
    if (mounted) await _startRun();
  }

  String get _freezeStorageKey {
    final account = _appState.currentAccount;
    final accountId = (account?['id'] ??
            account?['_id'] ??
            account?['email'] ??
            _appState.userProfile.name)
        .toString()
        .trim();
    final scope = accountId.isEmpty ? 'signed_in_account' : accountId;
    return 'vidyamedic_hil_frozen_result_v1_'
        '${Uri.encodeComponent(scope)}_${widget.scenario}';
  }

  Future<void> _restoreFrozenOutcome() async {
    try {
      final preferences = await SharedPreferences.getInstance();
      final encoded = preferences.getString(_freezeStorageKey);
      if (encoded == null) return;
      final decoded = jsonDecode(encoded);
      if (decoded is! Map) {
        throw const FormatException('Snapshot freeze HIL tidak valid.');
      }
      final snapshot = Map<String, dynamic>.from(decoded);
      if (snapshot['scenario'] != widget.scenario ||
          snapshot['summary'] is! String) {
        throw const FormatException('Isi snapshot freeze HIL tidak valid.');
      }
      if (!mounted) return;
      setState(() {
        _frozenOutcomeSnapshot = snapshot;
        _isResultFrozen = true;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = 'Hasil freeze sebelumnya gagal dimuat: $error';
      });
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
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
    final baseline = log['baseline_mean_hr'];
    if (hr is num) {
      parts.add('HR ${hr.toStringAsFixed(1)} bpm');
    }
    if (baseline is num) {
      parts.add('baseline ${baseline.toStringAsFixed(1)} bpm');
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

  double? get _baselineStd {
    final value = _hrStats['standard_deviation'];
    return value is num && value.isFinite ? value.toDouble() : null;
  }

  double get _threshold => HilRecordedScenarioAnalysis.threshold(_baselineStd);

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
    final isPeakScenario = widget.scenario == 'C';
    final recordingStartedAt = isPeakScenario ? _recordingStartedAt : null;
    final recordingStoppedAt = isPeakScenario ? _recordingStoppedAt : null;
    final response = await ApiService.getWearableSamples(
      from: (recordingStartedAt ?? now.subtract(const Duration(days: 31)))
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
          (recordingStartedAt == null ||
              !recordedAt.isBefore(recordingStartedAt)) &&
          (recordingStoppedAt == null ||
              !recordedAt.isAfter(recordingStoppedAt));
    }).toList()
      ..sort((a, b) => DateTime.parse(a['recorded_at'].toString())
          .compareTo(DateTime.parse(b['recorded_at'].toString())));
    if (isPeakScenario && recordingStartedAt != null) {
      for (final sample in samples) {
        final id = sample['_id']?.toString();
        if (id != null) _recordingSamples[id] = sample;
      }
    }
    final sessionSamples = _recordingSamples.values.toList()
      ..sort((a, b) => DateTime.parse(a['recorded_at'].toString())
          .compareTo(DateTime.parse(b['recorded_at'].toString())));
    final displayedSamples =
        isPeakScenario && recordingStartedAt != null ? sessionSamples : samples;
    final targetSample = isPeakScenario
        ? HilRecordedScenarioAnalysis.maximumHeartRateSample(displayedSamples)
        : HilRecordedScenarioAnalysis.latestDeviationSample(
            samples: displayedSamples,
            baselineMean: _baselineMean,
            thresholdBpm: _threshold,
          );
    setState(() {
      _samples = displayedSamples;
      final selectedId = _selectedSampleId;
      final selectedSample = targetSample ??
          (displayedSamples.isEmpty ? null : displayedSamples.last);
      _selectedSampleId = selectedSample?['_id']?.toString();
      if (selectedSample != null &&
          _selectedSampleId != selectedId &&
          !_isResultFrozen) {
        _recommendation = null;
        _zeroShotExplanation = null;
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
    if ((!isPeakScenario || _recordingStoppedAt != null) &&
        !_isResultFrozen &&
        targetId != null &&
        (isPeakScenario ? _isDeviation(targetSample!) : true) &&
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
    _recordingSamples.clear();
    _loadedSampleIds.clear();
    _autoAttemptedDeviationSampleIds.clear();
    _handledDeviationSampleIds.clear();
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
    if (requested == null) _handledDeviationSampleIds.remove(sampleId);
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

  Future<bool> _confirmZeroShotTransfer() async {
    final consent = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Persetujuan penjelasan zero-shot'),
        content: const Text(
          'Nilai HR, ringkasan baseline, dan klarifikasi yang Anda tulis akan dikirim ke layanan AI untuk membuat penjelasan. Jangan masukkan nama atau informasi pengenal. Hasil hanya ringkasan observasional, bukan diagnosis.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Setuju dan lanjutkan'),
          ),
        ],
      ),
    );
    return consent == true;
  }

  Future<void> _openClarificationPicker() async {
    String? choice = _clarificationController.text.trim().isNotEmpty
        ? _clarificationController.text.trim()
        : null;
    final selected = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) {
          final options = <String>[
            'Saya baru selesai olahraga, lalu duduk sebelum mulai rekaman',
            'Saya baru selesai berjalan / bergerak, lalu duduk sebelum rekaman',
            'Saya sedang beraktivitas berat atau olahraga saat rekaman',
            'Saya sedang stres / cemas',
            'Saya sedang beristirahat / tidur',
            'Saya sedang makan / minum',
            'Saya tidak ingat / tidak yakin',
            'Tidak ada faktor khusus yang memengaruhi denyut',
          ];
          return AlertDialog(
            title: const Text('Pilih faktor yang mungkin memengaruhi deviasi'),
            content: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 360),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: options.map((option) {
                    final selected = choice == option;
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
                            color:
                                selected ? AppTheme.primary : AppTheme.divider,
                          ),
                          color: selected ? AppTheme.primarySoft : null,
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                option,
                                style: AppTheme.font(
                                  size: 11,
                                  weight: selected
                                      ? FontWeight.w700
                                      : FontWeight.w500,
                                ),
                              ),
                            ),
                            if (selected)
                              Icon(
                                Icons.check_circle,
                                color: AppTheme.primary,
                                size: 18,
                              ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Batal'),
              ),
              FilledButton(
                onPressed: choice == null
                    ? null
                    : () => Navigator.pop(dialogContext, choice),
                child: const Text('Simpan pilihan'),
              ),
            ],
          );
        },
      ),
    );
    if (!mounted || selected == null) return;
    setState(() {
      _clarificationController.text = selected;
      _clarificationController.selection = TextSelection.collapsed(
        offset: _clarificationController.text.length,
      );
    });
  }

  Future<void> _submitClarification() async {
    final clarification = _clarificationController.text.trim();
    final sample = _selectedSample;
    if (clarification.isEmpty || sample == null) {
      setState(() =>
          _error = 'Pilih salah satu faktor yang mungkin memengaruhi deviasi.');
      return;
    }
    if (!await _confirmZeroShotTransfer() || !mounted) return;
    setState(() {
      _isGeneratingExplanation = true;
      _error = null;
      _zeroShotExplanation = null;
    });
    final submitted = await _logSelectedObservation(
      'clarification_submitted',
      clarification: clarification,
    );
    if (!mounted) return;
    if (submitted == null) {
      setState(() => _isGeneratingExplanation = false);
      return;
    }
    final selectedLog =
        _logs.lastWhere((log) => log['event_type'] == 'deviation_detected');
    final recordedAt = DateTime.tryParse(
      (selectedLog['observed_at'] ?? sample['recorded_at'])?.toString() ?? '',
    );
    final recordedAtLabel = recordedAt == null
        ? 'waktu tidak tersedia'
        : formatHilWibDateTime(recordedAt);
    final heartRate = selectedLog['heart_rate_bpm'];
    final baselineMeanHr = selectedLog['baseline_mean_hr'];
    final deltaHr = heartRate is num && baselineMeanHr is num
        ? heartRate - baselineMeanHr
        : null;
    final threshold = selectedLog['threshold_bpm'];
    final zScore = selectedLog['z_score'];
    final activityLabel = _activityLabel(_activity);
    final localSummary = [
      'Ringkasan fakta Skenario C HIL:',
      'Waktu sampel saat perubahan terdeteksi: $recordedAtLabel (WIB).',
      'Aktivitas yang dipilih untuk pengukuran: $activityLabel.',
      'Urutan konteks menurut peserta: $clarification. Ini laporan peserta, bukan kesimpulan sensor.',
      if (heartRate is num)
        'HR saat sampel: ${heartRate.toStringAsFixed(1)} bpm.',
      if (baselineMeanHr is num)
        'Baseline pribadi untuk $activityLabel: ${baselineMeanHr.toStringAsFixed(1)} bpm.',
      if (deltaHr != null)
        'Selisih HR terhadap baseline: ${deltaHr >= 0 ? '+' : ''}${deltaHr.toStringAsFixed(1)} bpm.',
      if (threshold is num)
        'Ambang perubahan menonjol: ${threshold.toStringAsFixed(1)} bpm di atas baseline.',
      if (zScore is num)
        'Jarak dari variasi yang biasa terlihat: ${zScore.abs().toStringAsFixed(1)} kali.',
      'Status sistem: ${selectedLog['algorithm_status'] ?? 'tidak tersedia'}.',
      'Interpretasi: HR yang lebih tinggi tercatat saat konteks pengukuran "$activityLabel". Peserta melaporkan konteks sebelumnya seperti di atas. Urutan waktunya memberi konteks, tetapi tidak membuktikan aktivitas tersebut sebagai penyebab perubahan HR.',
    ].join(' ');
    if (mounted) {
      setState(() => _zeroShotExplanation = localSummary);
    }
    final evidence = <Map<String, dynamic>>[
      {
        'source': 'real_wearable_sample',
        'recorded_at': recordedAt?.toIso8601String(),
        'facts':
            'Sampel Polar H10 pada $recordedAtLabel WIB; konteks pengukuran $activityLabel.',
        'metric': 'mean_hr',
        'value': heartRate,
        'unit': 'bpm',
        'status': selectedLog['algorithm_status'],
      },
      {
        'source': 'hil_personal_baseline',
        'recorded_at': recordedAt?.toIso8601String(),
        'facts': 'Baseline HIL pribadi untuk aktivitas $activityLabel.',
        'metric': 'mean_hr',
        'value': baselineMeanHr,
        'unit': 'bpm',
        'status': 'ready',
      },
      {
        'source': 'participant_clarification',
        'recorded_at': recordedAt?.toIso8601String(),
        'facts': clarification,
        'metric': 'context',
        'value': clarification,
        'unit': '',
        'status': 'self_reported',
      },
    ];
    final response = await ApiService.generatePersonalChatAnswer(
      question: 'Jelaskan observasi Skenario C HIL. Cantumkan waktu sampel '
          'WIB, aktivitas pengukuran, HR, baseline, selisih, ambang, status, '
          'dan klarifikasi peserta. Pertahankan angka dan waktu persis. '
          'Bedakan konteks pengukuran dari laporan peserta; klarifikasi bukan '
          'bukti penyebab. Tanpa diagnosis atau saran medis.',
      evidence: evidence,
      localSummary: localSummary.length > 1200
          ? localSummary.substring(0, 1200)
          : localSummary,
      conversationHistory: const [],
    );
    if (!mounted) return;
    if (!response.success || response.data == null) {
      final message = response.message ?? 'Ringkasan penjelasan gagal dibuat.';
      final savedFailure = await _logSelectedObservation(
        'zero_shot_failed',
        clarification: clarification,
        explanation: message,
      );
      if (!mounted) return;
      setState(() {
        _isGeneratingExplanation = false;
        _error = savedFailure == null
            ? 'Ringkasan faktual tetap ditampilkan, tetapi $message Log kegagalan juga belum tersimpan.'
            : 'Ringkasan faktual tetap ditampilkan, tetapi penjelasan AI gagal dibuat: $message';
      });
      await _showScenarioResultDialog(
        title: 'Skenario C · Ringkasan klarifikasi',
        summary: localSummary,
        recommendation: _hilRecommendation,
      );
      return;
    }

    final explanationPrefix = [
      localSummary,
      '',
      'Penjelasan tambahan:',
    ].join('\n');
    final explanation = '$explanationPrefix'
        '${response.data!.substring(
      0,
      math.max(0, 1200 - explanationPrefix.length),
    )}';
    final saved = await _logSelectedObservation(
      'zero_shot_generated',
      clarification: clarification,
      explanation: explanation,
    );
    if (!mounted) return;
    setState(() {
      _isGeneratingExplanation = false;
      if (saved != null) _zeroShotExplanation = explanation;
    });
    if (saved != null) {
      final appState = context.read<AppState>();
      final explanationSaved = await appState.recordHumanInTheLoopScenario(
        scenario: 'C',
        explanationSnapshot: _explanationSnapshot(
          explanation,
          'candidate_deviation_with_participant_context',
          sourceLogId: saved['_id'].toString(),
          sampleId: saved['sample_id'].toString(),
        ),
      );
      if (!explanationSaved && mounted) {
        setState(() {
          _error = 'Penjelasan C sudah dibuat dan log skenario tersimpan, '
              'tetapi histori penjelasan belum tersimpan: '
              '${appState.dataError ?? 'coba lagi.'}';
        });
      }
    }
    await _showScenarioResultDialog(
      title: 'Skenario C · Ringkasan klarifikasi',
      summary: explanation,
      recommendation: _hilRecommendation,
    );
  }

  String get _hilRecommendation =>
      'Duduk atau beristirahat dengan tenang selama beberapa menit, lalu ukur kembali denyut saat kondisi stabil. Catat bila baru selesai berolahraga atau bergerak. Jika denyut tetap tinggi, terasa tidak biasa, atau disertai nyeri dada, sesak napas berat, pusing berat, atau pingsan, segera cari bantuan medis. Ini saran umum, bukan diagnosis.';

  String _buildObservationSummary(
    Map<String, dynamic> log, {
    required String? participantContext,
  }) {
    final observedAt = DateTime.tryParse(log['observed_at']?.toString() ?? '');
    final heartRate = log['heart_rate_bpm'];
    final baseline = log['baseline_mean_hr'];
    final delta =
        heartRate is num && baseline is num ? heartRate - baseline : null;
    return [
      if (observedAt != null)
        'Waktu sampel: ${formatHilWibDateTime(observedAt)}.',
      'Aktivitas saat pengukuran: ${_activityLabel(_activity)}.',
      if (heartRate is num)
        'Denyut terukur: ${heartRate.toStringAsFixed(1)} bpm.',
      if (baseline is num)
        'Baseline pribadi: ${baseline.toStringAsFixed(1)} bpm.',
      if (delta != null)
        'Selisih dari baseline: ${delta >= 0 ? '+' : ''}${delta.toStringAsFixed(1)} bpm.',
      if (log['threshold_bpm'] is num)
        'Ambang deviasi: ${(log['threshold_bpm'] as num).toStringAsFixed(1)} bpm.',
      'Status: anomali terdeteksi dibandingkan baseline pribadi. Ini observasi, bukan diagnosis.',
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

  List<ChartPoint> get _chartPoints => _samples
      .map((sample) {
        final time = DateTime.tryParse(sample['recorded_at']?.toString() ?? '');
        final hr = _sampleHr(sample);
        if (time == null || hr == null) return null;
        return ChartPoint(
          time,
          hr,
          activity: _activity,
          observationStatus:
              _isDeviation(sample) ? 'candidate_deviation' : 'normal',
        );
      })
      .whereType<ChartPoint>()
      .toList()
    ..sort((left, right) => left.time.compareTo(right.time));

  Widget _chartCard() {
    final points = _chartPoints;
    return Card(
      key: const Key('hil-recorded-chart'),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'HR rekaman nyata · ${_activityLabel(_activity)}',
              style: AppTheme.font(size: 12, weight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              _baselineMean == null
                  ? 'Belum ada nilai pembanding pribadi untuk aktivitas ini.'
                  : 'Garis putus-putus: nilai pembanding pribadi ${_baselineMean!.toStringAsFixed(1)} bpm · '
                      'perubahan menonjol di atas +${_threshold.toStringAsFixed(1)} bpm',
              style: AppTheme.font(size: 10, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 8),
            if (points.length < 2)
              const SizedBox(
                key: Key('hil-recorded-chart-empty'),
                height: 170,
                child: Center(
                  child:
                      Text('Perlu minimal dua sampel HR nyata untuk grafik.'),
                ),
              )
            else
              SizedBox(
                height: 190,
                width: double.infinity,
                child: CustomPaint(
                  painter: TrendChartPainter(
                    points: points,
                    color: AppTheme.primary,
                    baselineMean: _baselineMean,
                    timeDisplayOffset: hilWibOffset,
                    maximumGap: const Duration(minutes: 2),
                  ),
                ),
              ),
            Text(
              '${points.length} bacaan diterima · data simulasi dan data pembentukan profil tidak disertakan',
              style: AppTheme.font(size: 9.5, color: AppTheme.textMuted),
            ),
          ],
        ),
      ),
    );
  }

  Widget _observationCard() {
    final sample = _selectedSample;
    final hr = sample == null ? null : _sampleHr(sample);
    final candidate = sample != null && _isDeviation(sample);
    final mean = _baselineMean;
    final zScore = hr != null && mean != null && (_baselineStd ?? 0) > 0
        ? (hr - mean) / _baselineStd!
        : null;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
                widget.scenario == 'C'
                    ? _recordingStartedAt == null
                        ? 'Sampel HR tertinggi pada riwayat'
                        : _recordingStoppedAt == null
                            ? 'HR maksimum sementara'
                            : 'HR maksimum pada rekaman'
                    : 'Observasi terbaru',
                style: AppTheme.font(size: 12, weight: FontWeight.w800)),
            const SizedBox(height: 7),
            if (widget.scenario == 'C' &&
                _recordingStartedAt != null &&
                _recordingStoppedAt == null)
              const Text(
                'Skenario menilai bacaan tertinggi pada sesi ini. Hentikan rekaman untuk menetapkan nilai puncak.',
                key: Key('hil-recorded-peak-guidance'),
              ),
            if (_samples.isEmpty)
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
                'Denyut ${hr?.toStringAsFixed(1) ?? '-'} bpm · nilai pembanding pribadi '
                '${mean?.toStringAsFixed(1) ?? '-'} bpm'
                '${zScore == null ? '' : ' · jarak dari kisaran pribadi sekitar ${zScore.abs().toStringAsFixed(1)} kali variasi yang biasa terlihat'}',
                key: const Key('hil-recorded-observation-summary'),
                style: AppTheme.font(size: 11, weight: FontWeight.w700),
              ),
              Text(
                candidate
                    ? 'Anomali terdeteksi: denyut lebih tinggi ${_threshold.toStringAsFixed(1)} bpm dari pembanding aktivitas; pemeriksaan mutu bacaan lolos.'
                    : _baseline.isEmpty
                        ? 'Nilai pembanding pribadi untuk aktivitas ini belum siap, jadi perubahan belum dapat dinilai.'
                        : 'Denyut belum melewati batas anomali, yaitu pembanding pribadi + ${_threshold.toStringAsFixed(1)} bpm.',
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
                label:
                    Text(_handledDeviationSampleIds.contains(_selectedSampleId)
                        ? 'Skenario sudah berjalan'
                        : widget.scenario != 'C'
                            ? widget.scenario == 'B'
                                ? 'Tampilkan feedback satu arah'
                                : 'Minta klarifikasi peserta'
                            : _recordingStartedAt == null
                                ? 'Mulai rekam untuk menguji skenario'
                                : _recordingStoppedAt == null
                                    ? 'Hentikan rekaman untuk menilai puncak'
                                    : widget.scenario == 'B'
                                        ? 'Tampilkan feedback satu arah'
                                        : 'Minta klarifikasi peserta'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _toggleResultFreeze() async {
    try {
      final preferences = await SharedPreferences.getInstance();
      if (_isResultFrozen) {
        final removed = await preferences.remove(_freezeStorageKey);
        if (!removed && preferences.containsKey(_freezeStorageKey)) {
          throw StateError('Freeze gagal dibatalkan di perangkat.');
        }
        if (!mounted) return;
        setState(() {
          _isResultFrozen = false;
          _frozenOutcomeSnapshot = null;
        });
        return;
      }

      final sample = _selectedSample;
      final recordedAt = DateTime.tryParse(
        sample?['recorded_at']?.toString() ?? '',
      );
      final clarification = _clarificationController.text.trim();
      final summary = widget.scenario == 'B'
          ? _recommendation ?? 'Feedback belum tersedia.'
          : _zeroShotExplanation ??
              (clarification.isNotEmpty
                  ? clarification
                  : 'Anomali terdeteksi; klarifikasi peserta belum dikirim.');
      final snapshot = <String, dynamic>{
        'scenario': widget.scenario,
        'summary': summary,
        'activity': _activity,
        'sample_id': sample?['_id']?.toString(),
        'recorded_at': recordedAt?.toIso8601String(),
        'heart_rate_bpm': sample == null ? null : _sampleHr(sample),
        'baseline_mean_hr': _baselineMean,
        'clarification': clarification,
        'frozen_at': DateTime.now().toUtc().toIso8601String(),
      };
      final saved = await preferences.setString(
        _freezeStorageKey,
        jsonEncode(snapshot),
      );
      if (!saved) throw StateError('Freeze hasil gagal disimpan di perangkat.');
      if (!mounted) return;
      setState(() {
        _frozenOutcomeSnapshot = snapshot;
        _isResultFrozen = true;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Freeze hasil gagal disimpan: $error');
    }
  }

  Widget _scenarioOutcome() {
    final frozen = _frozenOutcomeSnapshot;
    if (_isResultFrozen && frozen != null) {
      final recordedAt = DateTime.tryParse(
        frozen['recorded_at']?.toString() ?? '',
      );
      final heartRate = frozen['heart_rate_bpm'];
      final baselineMeanHr = frozen['baseline_mean_hr'];
      return Card(
        key: const Key('hil-recorded-frozen-result'),
        color: AppTheme.primarySoft,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Skenario ${widget.scenario} · hasil dibekukan',
                      style: AppTheme.font(size: 12, weight: FontWeight.w800),
                    ),
                  ),
                  TextButton.icon(
                    key: const Key('hil-recorded-unfreeze-result'),
                    onPressed: _toggleResultFreeze,
                    icon: const Icon(Icons.lock_open_rounded),
                    label: const Text('Batal freeze'),
                  ),
                ],
              ),
              if (recordedAt != null)
                Text('Waktu sampel: ${formatHilWibDateTime(recordedAt)}'),
              if (frozen['activity'] != null)
                Text('Aktivitas pengukuran: '
                    '${_activityLabel(frozen['activity'].toString())}'),
              if (heartRate is num)
                Text('HR saat dibekukan: ${heartRate.toStringAsFixed(1)} bpm'),
              if (baselineMeanHr is num)
                Text('Baseline pribadi: '
                    '${baselineMeanHr.toStringAsFixed(1)} bpm'),
              const SizedBox(height: 8),
              Text(frozen['summary']?.toString() ?? ''),
            ],
          ),
        ),
      );
    }
    if (_recommendation != null) {
      return Card(
        key: const Key('hil-recorded-scenario-B-result'),
        color: AppTheme.primarySoft,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text('Skenario B · one way feedback',
                        style:
                            AppTheme.font(size: 12, weight: FontWeight.w800)),
                  ),
                  TextButton.icon(
                    key: const Key('hil-recorded-freeze-result'),
                    onPressed: _toggleResultFreeze,
                    icon: Icon(
                      _isResultFrozen ? Icons.lock : Icons.lock_open_rounded,
                    ),
                    label: Text(
                      _isResultFrozen ? 'Batal freeze' : 'Freeze hasil',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(_recommendation!),
              const SizedBox(height: 5),
              Text(
                _isResultFrozen
                    ? 'Hasil saat ini dibekukan dan tetap ditampilkan meski sinyal atau deviasi berikutnya turun kembali.'
                    : 'Feedback satu arah; tidak meminta klarifikasi. Hasil ini dibekukan saat anomali muncul agar tidak hilang saat sinyal turun kembali.',
              ),
            ],
          ),
        ),
      );
    }
    if (!_clarificationRequested) return const SizedBox.shrink();
    return Card(
      key: const Key('hil-recorded-scenario-C-result'),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text('Skenario C · klarifikasi peserta',
                      style: AppTheme.font(size: 12, weight: FontWeight.w800)),
                ),
                TextButton.icon(
                  key: const Key('hil-recorded-freeze-result-c'),
                  onPressed: _toggleResultFreeze,
                  icon: Icon(
                    _isResultFrozen ? Icons.lock : Icons.lock_open_rounded,
                  ),
                  label: Text(
                    _isResultFrozen ? 'Batal freeze' : 'Freeze hasil',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 5),
            const Text(
              'Pilih faktor yang mungkin memengaruhi deviasi saat perubahan denyut ini terjadi.',
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              key: const Key('hil-recorded-clarification-picker'),
              onPressed:
                  _isGeneratingExplanation ? null : _openClarificationPicker,
              icon: const Icon(Icons.fact_check_outlined),
              label: Text(
                _clarificationController.text.trim().isNotEmpty
                    ? 'Ubah pilihan klarifikasi'
                    : 'Pilih klarifikasi',
              ),
            ),
            if (_clarificationController.text.trim().isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.primarySoft,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _clarificationController.text.trim(),
                  style: AppTheme.font(size: 10.5),
                ),
              ),
            ],
            const SizedBox(height: 10),
            FilledButton.icon(
              key: const Key('hil-recorded-submit-clarification'),
              onPressed: _isGeneratingExplanation ? null : _submitClarification,
              icon: _isGeneratingExplanation
                  ? const SizedBox(
                      width: 15,
                      height: 15,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.auto_awesome_outlined),
              label: Text(_isGeneratingExplanation
                  ? 'Membuat penjelasan...'
                  : 'Kirim klarifikasi & buat ringkasan penjelasan'),
            ),
            if (_zeroShotExplanation != null) ...[
              const SizedBox(height: 12),
              Container(
                key: const Key('hil-recorded-zero-shot-explanation'),
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.primarySoft,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Ringkasan perubahan + klarifikasi',
                        style:
                            AppTheme.font(size: 11, weight: FontWeight.w800)),
                    const SizedBox(height: 5),
                    Text(_zeroShotExplanation!),
                  ],
                ),
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
                '3. Pola pribadi: denyut rata-rata dari rekaman berkualitas untuk aktivitas ini menjadi pembanding (${_baselineMean?.toStringAsFixed(1) ?? 'belum tersedia'} bpm).',
              ),
              const SizedBox(height: 4),
              Text(
                '4. Perubahan menonjol: ditandai bila denyut lebih tinggi dari pembanding pribadi sebesar ${_threshold.toStringAsFixed(1)} bpm atau lebih. Ini pengamatan, bukan diagnosis.',
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
                      'Hasil skenario memakai HR tertinggi yang tercatat selama sesi rekaman ini, lalu membandingkannya dengan baseline aktivitas terpilih. Perhitungan langsung dari HR dan mutu sensor; ELSTM tidak digunakan.',
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
                                _zeroShotExplanation = null;
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
              _chartCard(),
              _observationCard(),
              _analysisNodesCard(),
              if (_samples.isEmpty && !_isLoading) _noSamplesGuidanceCard(),
              if (_samples.isNotEmpty &&
                  !_isDeviation(_selectedSample ?? const {}) &&
                  !_clarificationRequested &&
                  _recommendation == null)
                _noDeviationGuidanceCard(),
              _scenarioOutcome(),
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
                'Polar H10 ${bridge.isStreaming ? 'aktif' : 'terputus'} · sampel diperbarui otomatis tiap 30 detik. '
                'Skenario akan berjalan otomatis jika ditemukan perubahan menonjol dengan data yang layak.',
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
            'Belum ada rekaman Polar H10 yang layak untuk aktivitas ini. Mulai rekam untuk melihat grafik dan menjalankan skenario bila ada perubahan denyut yang menonjol.',
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
                'Belum ada bacaan yang menunjukkan perubahan denyut menonjol. Skenario ${widget.scenario} akan berjalan otomatis bila denyut melampaui pembanding pribadi aktivitas ini sebesar ${_threshold.toStringAsFixed(1)} bpm dan mutu bacaan memadai. Muat ulang setelah rekaman terbaru tersedia.',
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
