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

  static double? averageQualifiedRawHeartRate(
    List<Map<String, dynamic>> readings,
  ) {
    final values = readings
        .where(isQualifiedRawReading)
        .map((reading) => (reading['heart_rate_bpm'] as num).toDouble())
        .toList();
    if (values.isEmpty) return null;
    return values.reduce((sum, value) => sum + value) / values.length;
  }

  static const minimumRepeatReadings = 5;

  static String participantContextConclusion({
    required double? heartRate,
    required double? baselineMean,
    required String participantContext,
  }) {
    final measured = heartRate == null
        ? 'HR raw saat deviasi tidak tersedia'
        : 'HR raw saat deviasi ${heartRate.toStringAsFixed(1)}';
    final comparison = heartRate == null || baselineMean == null
        ? 'rata-rata baseline tidak tersedia untuk perbandingan'
        : 'lebih tinggi ${(heartRate - baselineMean).toStringAsFixed(1)} dari rata-rata baseline ${baselineMean.toStringAsFixed(1)}';
    return 'Kesimpulan sementara: $measured $comparison. '
        'Anda melaporkan konteks: $participantContext. '
        'Konteks tersebut menjadi informasi untuk meninjau bacaan, tetapi '
        'tidak membuktikan penyebab deviasi. Ini observasi, bukan diagnosis.';
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
  List<Map<String, dynamic>> _logs = [];
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
  bool _isRecordingContextRepeat = false;
  bool _ownsStream = false;
  bool _clarificationRequested = false;
  bool _liveDeviationPrompted = false;
  bool _rawDeviationInProgress = false;
  bool _isStartingRun = false;
  bool _showAllScenarioLogs = false;
  DateTime? _recordingStartedAt;
  DateTime? _recordingStoppedAt;
  DateTime? _contextRepeatStartedAt;
  DateTime? _lastContextRepeatReadingAt;
  double? _contextRepeatAverage;
  int _contextRepeatCount = 0;
  final List<Map<String, dynamic>> _contextRepeatReadings = [];
  final Map<String, Map<String, dynamic>> _recordingSamples = {};
  Timer? _refreshTimer;
  Timer? _contextRepeatTimer;
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
    _contextRepeatTimer?.cancel();
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
        'activity_repeat_selected' => 'Rekam ulang dipilih',
        'activity_context_sufficient' => 'Konteks dinilai cukup',
        'activity_repeat_skipped' => 'Tidak merekam ulang',
        'observation_frozen' => 'Hasil observasi dibekukan',
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
      parts.add('HR raw ${hr.toStringAsFixed(1)}');
    }
    final baselineMean = log['baseline_mean_hr'];
    if (hr is num && baselineMean is num) {
      parts.add('baseline ${baselineMean.toStringAsFixed(1)}');
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

  Future<void> _reloadScenarioLogs() async {
    final sessionId = _sessionId;
    if (sessionId == null) {
      _showScenarioError('Log belum dapat dimuat tanpa sesi HIL.');
      return;
    }
    final response = await ApiService.getHilScenarioLogs(
      sessionId: sessionId,
      runId: _runId,
      limit: 100,
    );
    if (!mounted) return;
    if (!response.success || response.data == null) {
      _showScenarioError(
        response.message ?? 'Log tersimpan gagal dimuat dari database.',
      );
      return;
    }
    final logs = response.data!
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList()
      ..sort((left, right) {
        final leftAt = _eventTimestamp(left);
        final rightAt = _eventTimestamp(right);
        if (leftAt == null) return rightAt == null ? 0 : 1;
        if (rightAt == null) return -1;
        return rightAt.compareTo(leftAt);
      });
    setState(() {
      _logs = logs;
      _error = null;
    });
  }

  Future<void> _showScenarioLogDetails(
    Map<String, dynamic> log,
  ) async {
    final details = <String>[
      'Skenario ${log['scenario'] ?? widget.scenario}',
      'Aktivitas: ${_activityLabel(_normalizeActivity(log['activity']))}',
      'Waktu log: ${_eventTimeLabel(log)}',
      if (DateTime.tryParse(log['observed_at']?.toString() ?? '')
          case final observedAt?)
        'Waktu bacaan: ${formatHilWibDateTime(observedAt)}',
      if (log['raw_hr'] is num)
        'HR raw: ${(log['raw_hr'] as num).toStringAsFixed(1)}',
      if (log['baseline_mean_hr'] is num)
        'Rata-rata baseline: ${(log['baseline_mean_hr'] as num).toStringAsFixed(1)}',
      if (log['algorithm_status'] != null)
        'Status deviasi: ${log['algorithm_status']}',
      if (log['quality_status'] != null)
        'Mutu bacaan: ${log['quality_status']}',
      if ((log['clarification']?.toString().trim().isNotEmpty ?? false))
        'Jawaban pengguna:\n${log['clarification']}',
      if ((log['explanation']?.toString().trim().isNotEmpty ?? false))
        'Hasil/interpretasi:\n${log['explanation']}',
      if ((log['recommendation']?.toString().trim().isNotEmpty ?? false))
        'Rekomendasi:\n${log['recommendation']}',
    ];
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        key: const Key('hil-recorded-log-detail-dialog'),
        title: Text(
          _eventLabel(log['event_type']?.toString() ?? 'Log HIL'),
        ),
        content: SingleChildScrollView(
          child: SelectableText(details.join('\n\n')),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Tutup'),
          ),
        ],
      ),
    );
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
    if (_isRecordingContextRepeat) {
      _collectContextRepeatReadings();
      return;
    }
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
      await _reloadScenarioLogs();
      if (!mounted) return;
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
    double? rawSignalQuality,
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
      if (rawHeartRate != null && rawSignalQuality != null)
        'raw_signal_quality': rawSignalQuality,
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
    double? rawSignalQuality,
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
      rawSignalQuality: rawSignalQuality,
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
        final freezeObservation = await _showScenarioResultDialog(
          title: 'Skenario B · One way feedback',
          summary: _buildObservationSummary(
            deviationLog,
            participantContext: null,
          ),
          recommendation: recommendation,
          canFreeze: true,
        );
        if (freezeObservation) {
          await _logSelectedObservation(
            'observation_frozen',
            explanation: _buildObservationSummary(
              deviationLog,
              participantContext: null,
            ),
            recommendation: recommendation,
          );
        }
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
            sampleTime.difference(rawTime).abs() <= const Duration(seconds: 90);
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
      final freezeObservation = await _showScenarioResultDialog(
        title: 'Skenario B · One way feedback',
        summary: 'HR raw ${rawHr.toStringAsFixed(1)} terdeteksi '
            '${formatHilWibDateTime(rawTime)}, lebih tinggi dari rata-rata '
            'baseline aktivitas. Ini observasi, bukan diagnosis.',
        recommendation: recommendation,
        canFreeze: true,
      );
      if (!mounted) return;
      setState(() {
        _isSaving = true;
        _error = null;
      });
      final sample = await sampleFuture;
      if (!mounted) return;
      final sampleId = sample?['_id']?.toString();
      Map<String, dynamic>? deviation;
      Map<String, dynamic>? feedback;
      if (sampleId != null) {
        setState(() => _selectedSampleId = sampleId);
        deviation = await _logSelectedObservation(
          'deviation_detected',
          rawHeartRate: rawHr,
          rawRecordedAt: rawTime,
          rawSignalQuality: _rawSignalQuality(rawReading),
        );
        if (deviation?['algorithm_status'] == 'candidate_deviation') {
          feedback = await _logSelectedObservation(
            'feedback_presented',
            recommendation: recommendation,
          );
        }
      }
      if (feedback == null) {
        setState(() => _selectedSampleId = null);
        final rawDeviationSaved = await _saveLog(
          'deviation_detected',
          rawHeartRate: rawHr,
          rawRecordedAt: rawTime,
          rawSignalQuality: _rawSignalQuality(rawReading),
        );
        if (rawDeviationSaved) {
          final feedbackSaved = await _saveLog(
            'feedback_presented',
            recommendation: recommendation,
          );
          if (feedbackSaved && _logs.isNotEmpty) feedback = _logs.last;
        }
      }
      if (!mounted) return;
      if (feedback == null) {
        setState(() {
          _isSaving = false;
          _rawDeviationInProgress = false;
          _error = 'Feedback sudah ditampilkan, tetapi log deviasi atau '
              'rekomendasi belum tersimpan. Periksa koneksi lalu muat ulang log.';
        });
        return;
      }
      if (_selectedSampleId != null) {
        _handledDeviationSampleIds.add(_selectedSampleId!);
      }
      final appState = context.read<AppState>();
      final saved = await appState.recordHumanInTheLoopScenario(
        scenario: 'B',
        explanationSnapshot: _explanationSnapshot(
          recommendation,
          'candidate_deviation',
          sourceLogId: feedback['_id'].toString(),
          sampleId: feedback['sample_id']?.toString(),
        ),
      );
      if (!mounted) return;
      setState(() {
        if (!saved) {
          _error = 'Feedback sudah ditampilkan, tetapi histori penjelasan '
              'belum tersimpan: ${appState.dataError ?? 'coba lagi.'}';
        }
      });
      if (freezeObservation) {
        await _saveLog(
          'observation_frozen',
          sampleId: _selectedSampleId,
          rawHeartRate: rawHr,
          rawRecordedAt: rawTime,
          rawSignalQuality: _rawSignalQuality(rawReading),
          explanation: 'Ringkasan observasi: HR raw '
              '${rawHr.toStringAsFixed(1)} pada '
              '${formatHilWibDateTime(rawTime)}; lebih tinggi dari rata-rata '
              'baseline aktivitas.',
          recommendation: recommendation,
        );
      }
      if (!mounted) return;
      setState(() {
        _isSaving = false;
        _rawDeviationInProgress = false;
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
    Map<String, dynamic> deviation = {
      'observed_at': rawTime.toIso8601String(),
      'heart_rate_bpm': rawHr,
      'baseline_mean_hr': _baselineMean,
      'algorithm_status': 'candidate_deviation',
      'quality_status': sample == null ? 'unavailable' : 'accepted',
    };
    Map<String, dynamic>? conclusionLog;
    var logsSaved = true;

    if (sampleId != null) {
      setState(() => _selectedSampleId = sampleId);
      final savedDeviation = await _logSelectedObservation(
        'deviation_detected',
        rawHeartRate: rawHr,
        rawRecordedAt: rawTime,
        rawSignalQuality: _rawSignalQuality(rawReading),
      );
      if (savedDeviation != null) deviation = savedDeviation;
      logsSaved = savedDeviation != null;
      if (savedDeviation == null) {
        setState(() => _selectedSampleId = null);
        logsSaved = await _saveLog(
          'deviation_detected',
          rawHeartRate: rawHr,
          rawRecordedAt: rawTime,
          rawSignalQuality: _rawSignalQuality(rawReading),
        );
      }
      if (logsSaved) {
        final requested = sampleId != null && _selectedSampleId != null
            ? await _logSelectedObservation('clarification_requested')
            : await _saveLog('clarification_requested');
        final submitted = requested == null
            ? null
            : _selectedSampleId != null
                ? await _logSelectedObservation(
                    'clarification_submitted',
                    clarification: answer,
                  )
                : await _saveLog(
                    'clarification_submitted',
                    clarification: answer,
                  );
        logsSaved = submitted != null;
      }
    } else {
      final savedDeviation = await _saveLog(
        'deviation_detected',
        rawHeartRate: rawHr,
        rawRecordedAt: rawTime,
        rawSignalQuality: _rawSignalQuality(rawReading),
      );
      logsSaved = savedDeviation;
      if (savedDeviation) {
        logsSaved = await _saveLog('clarification_requested');
        if (logsSaved) {
          logsSaved = await _saveLog(
            'clarification_submitted',
            clarification: answer,
          );
        }
      }
      if (mounted) {
        setState(() {
          _error = logsSaved
              ? null
              : 'Sampel agregat belum tervalidasi. Jawaban tetap diproses, '
                  'tetapi sebagian log belum tersimpan.';
        });
      }
    }

    if (!mounted) return;
    setState(() {
      _isSaving = true;
      _clarificationRequested = false;
      if (sampleId != null && logsSaved) {
        _handledDeviationSampleIds.add(sampleId);
      }
    });

    final baselineMean = _baselineMean;
    final response = await ApiService.generatePersonalChatAnswer(
      question: 'Buat interpretasi zero-shot HIL yang singkat dan mudah '
          'dipahami. Bandingkan HR raw dengan rata-rata baseline, gunakan '
          'konteks yang dilaporkan pengguna sebagai laporan subjektif saja, '
          'dan jangan menyatakan konteks sebagai penyebab atau membuat '
          'diagnosis. Jelaskan keterbatasan bila sampel Polar agregat belum '
          'tervalidasi.',
      evidence: [
        {
          'source': 'real_wearable_sample',
          'recorded_at': rawTime.toUtc().toIso8601String(),
          'facts': 'HR raw live saat trigger skenario C.',
          'metric': 'HR raw',
          'value': rawHr,
          'status': sample == null
              ? 'live; sampel agregat belum tervalidasi'
              : 'live; sampel agregat terkait tersedia',
        },
        if (baselineMean != null)
          {
            'source': 'hil_personal_baseline',
            'facts': 'Rata-rata baseline untuk aktivitas $_activity.',
            'metric': 'HR raw baseline mean',
            'value': baselineMean,
            'status': 'personal baseline',
          },
        {
          'source': 'participant_clarification',
          'facts': answer,
          'status': 'dilaporkan pengguna; bukan bukti sebab-akibat',
        },
      ],
      localSummary: 'Skenario C VidyaMedic. Aktivitas: $_activity. '
          'HR raw: ${rawHr.toStringAsFixed(1)}. '
          'Rata-rata baseline: ${baselineMean?.toStringAsFixed(1) ?? 'tidak tersedia'}. '
          'Kualitas sampel agregat: ${sample == null ? 'belum tervalidasi' : 'tersedia'}. '
          'Konteks pengguna: $answer. Data observasional, bukan diagnosis.',
      conversationHistory: const [],
    );
    if (!mounted) return;
    final generatedText = response.data?.trim();
    final zeroShotConclusion =
        response.success && generatedText != null && generatedText.isNotEmpty
            ? generatedText.substring(
                0,
                generatedText.length > 1200 ? 1200 : generatedText.length,
              )
            : null;
    final hasZeroShotConclusion = zeroShotConclusion != null;
    final conclusion = zeroShotConclusion ??
        HilRecordedScenarioAnalysis.participantContextConclusion(
          heartRate: rawHr,
          baselineMean: baselineMean,
          participantContext: answer,
        );
    if (!hasZeroShotConclusion) {
      setState(() {
        _error = response.message ??
            'Analisis zero-shot tidak tersedia; yang ditampilkan hanya '
                'ringkasan observasi.';
      });
    }

    if (logsSaved) {
      final resultEvent =
          hasZeroShotConclusion ? 'zero_shot_generated' : 'zero_shot_failed';
      final resultLogExplanation = hasZeroShotConclusion
          ? conclusion
          : '${response.message ?? 'Analisis zero-shot tidak tersedia.'} '
              'Ringkasan observasi: $conclusion';
      final boundedResultLogExplanation = resultLogExplanation.substring(
          0,
          resultLogExplanation.length > 1200
              ? 1200
              : resultLogExplanation.length);
      if (_selectedSampleId != null) {
        conclusionLog = await _logSelectedObservation(
          resultEvent,
          clarification: answer,
          explanation: boundedResultLogExplanation,
        );
      } else {
        final saved = await _saveLog(
          resultEvent,
          clarification: answer,
          explanation: boundedResultLogExplanation,
        );
        if (saved && _logs.isNotEmpty) conclusionLog = _logs.last;
      }
    } else {
      setState(() {
        _error = 'Interpretasi sudah dibuat, tetapi log deviasi/jawaban belum '
            'lengkap di database. Periksa koneksi lalu muat ulang log.';
      });
    }
    if (!mounted) return;

    if (conclusionLog != null && hasZeroShotConclusion) {
      final appState = context.read<AppState>();
      final saved = await appState.recordHumanInTheLoopScenario(
        scenario: 'C',
        explanationSnapshot: _explanationSnapshot(
          conclusion,
          'candidate_deviation',
          sourceLogId: conclusionLog!['_id'].toString(),
          sampleId: conclusionLog!['sample_id']?.toString(),
        ),
      );
      if (!saved && mounted) {
        setState(() {
          _error = 'Kesimpulan tersedia, tetapi histori penjelasan gagal '
              'tersimpan: ${appState.dataError ?? 'coba lagi.'}';
        });
      }
    }

    if (!mounted) return;
    setState(() {
      _isSaving = false;
      _rawDeviationInProgress = false;
    });
    final freezeObservation = await _showScenarioResultDialog(
      title: 'Skenario C · Kesimpulan observasi',
      summary: _buildObservationSummary(
        deviation,
        participantContext: answer,
      ),
      recommendation: conclusion,
      recommendationHeading: hasZeroShotConclusion
          ? 'Interpretasi zero-shot'
          : 'Ringkasan observasi',
      canFreeze: true,
    );
    if (freezeObservation) {
      await _saveLog(
        'observation_frozen',
        sampleId: _selectedSampleId,
        rawHeartRate: rawHr,
        rawRecordedAt: rawTime,
        rawSignalQuality: _rawSignalQuality(rawReading),
        clarification: answer,
        explanation: _buildObservationSummary(
          deviation,
          participantContext: answer,
        ),
        recommendation: conclusion.substring(
          0,
          conclusion.length > 500 ? 500 : conclusion.length,
        ),
      );
    }
    if (!mounted) return;
    final action = await _showRepeatDecisionDialog();
    if (!mounted || action == null) return;
    final actionEvent = switch (action) {
      'repeat' => 'activity_repeat_selected',
      'sufficient' => 'activity_context_sufficient',
      _ => 'activity_repeat_skipped',
    };
    final choiceSaved = await _saveLog(
      actionEvent,
      sampleId: _selectedSampleId,
      explanation: switch (action) {
        'repeat' => 'Pengguna memilih merekam ulang aktivitas.',
        'sufficient' => 'Pengguna menyatakan konteks sudah cukup.',
        _ => 'Pengguna memilih tidak merekam ulang aktivitas.',
      },
    );
    if (!choiceSaved && mounted) {
      setState(() {
        _error = 'Pilihan Anda belum tersimpan di database. '
            'Coba muat ulang log setelah koneksi pulih.';
      });
    }
    if (action == 'repeat' && mounted) {
      _startContextRepeatRecording();
    }
  }

  void _startContextRepeatRecording() {
    final bridge = _appState.wearableBridge;
    if (!_isLiveMonitoring || !bridge.isStreaming || bridge.isDemoDevice) {
      _showScenarioError(
        'Untuk merekam ulang konteks ${_activityLabel(_activity)}, '
        'hubungkan Polar H10 nyata dan mulai pemantauan live.',
      );
      return;
    }

    _contextRepeatTimer?.cancel();
    _contextRepeatReadings.clear();
    _contextRepeatStartedAt = DateTime.now().toUtc();
    _lastContextRepeatReadingAt = null;
    _contextRepeatAverage = null;
    _contextRepeatCount = 0;
    setState(() {
      _isRecordingContextRepeat = true;
      _error = null;
    });
    _collectContextRepeatReadings();
    _contextRepeatTimer = Timer(
      const Duration(seconds: 30),
      () => unawaited(_finishContextRepeatRecording()),
    );
  }

  void _collectContextRepeatReadings() {
    final startedAt = _contextRepeatStartedAt;
    if (!_isRecordingContextRepeat || startedAt == null) return;
    final newReadings = _appState.wearableBridge.recentStreamReadings
        .where((reading) {
      final recordedAt = DateTime.tryParse(
        reading['recorded_at']?.toString() ?? '',
      )?.toUtc();
      return recordedAt != null &&
          !recordedAt.isBefore(startedAt) &&
          (_lastContextRepeatReadingAt == null ||
              recordedAt.isAfter(_lastContextRepeatReadingAt!)) &&
          HilRecordedScenarioAnalysis.isQualifiedRawReading(reading);
    }).toList()
      ..sort((left, right) => DateTime.parse(left['recorded_at'].toString())
          .compareTo(DateTime.parse(right['recorded_at'].toString())));
    if (newReadings.isEmpty) return;
    _contextRepeatReadings.addAll(newReadings);
    _lastContextRepeatReadingAt =
        DateTime.parse(newReadings.last['recorded_at'].toString()).toUtc();
    _contextRepeatCount = _contextRepeatReadings.length;
    if (mounted) setState(() {});
  }

  Future<void> _finishContextRepeatRecording() async {
    if (!_isRecordingContextRepeat) return;
    _collectContextRepeatReadings();
    _contextRepeatTimer?.cancel();
    _contextRepeatTimer = null;
    final readings = List<Map<String, dynamic>>.from(_contextRepeatReadings);
    final average =
        HilRecordedScenarioAnalysis.averageQualifiedRawHeartRate(readings);
    final count = readings.length;
    final baselineMean = _baselineMean;
    final participantContext = _clarificationController.text.trim();
    final enoughReadings =
        count >= HilRecordedScenarioAnalysis.minimumRepeatReadings;
    final status = !enoughReadings || average == null || baselineMean == null
        ? 'not_assessable'
        : average > baselineMean
            ? 'candidate_deviation'
            : 'normal';

    setState(() {
      _isRecordingContextRepeat = false;
      _contextRepeatAverage = average;
      _contextRepeatCount = count;
      _isSaving = true;
    });

    final generated = enoughReadings && average != null
        ? await ApiService.generatePersonalChatAnswer(
            question: 'Buat interpretasi zero-shot singkat untuk rekaman '
                'ulang konteks aktivitas ${_activityLabel(_activity)}. '
                'Bandingkan rerata HR rekaman ulang dengan baseline personal '
                'aktivitas yang sama. Sebutkan jawaban konteks sebagai '
                'laporan pengguna, bukan sebab yang terbukti. Rekaman ulang '
                'hanya pembanding sesi dan TIDAK memperbarui baseline personal. '
                'Jangan membuat diagnosis.',
            evidence: [
              {
                'source': 'real_wearable_sample',
                'facts': 'Rerata HR raw dari $count bacaan berkualitas '
                    'saat rekaman ulang konteks ${_activityLabel(_activity)}.',
                'metric': 'repeat_mean_hr',
                'value': average,
                'unit': 'bpm',
                'status': 'observed; temporary session comparison',
              },
              if (baselineMean != null)
                {
                  'source': 'hil_personal_baseline',
                  'facts': 'Rata-rata baseline aktivitas '
                      '${_activityLabel(_activity)}.',
                  'metric': 'baseline_mean_hr',
                  'value': baselineMean,
                  'unit': 'bpm',
                  'status': 'personal baseline; unchanged',
                },
              {
                'source': 'participant_clarification',
                'facts': participantContext.isEmpty
                    ? 'Pengguna tidak menambahkan konteks aktivitas.'
                    : participantContext,
                'status': 'reported by participant; not causal evidence',
              },
            ],
            localSummary: 'Rekaman ulang HIL selama 30 detik untuk konteks '
                '${_activityLabel(_activity)}. Rerata HR raw: '
                '${average.toStringAsFixed(1)} dari $count bacaan berkualitas. '
                'Rata-rata baseline personal aktivitas yang sama: '
                '${baselineMean?.toStringAsFixed(1) ?? 'tidak tersedia'}. '
                'Status sementara: $status. Rekaman ini hanya pembanding sesi '
                'dan tidak mengubah baseline personal. '
                'Konteks pengguna: ${participantContext.isEmpty ? 'tidak diisi' : participantContext}.',
            conversationHistory: const [],
          )
        : null;

    if (!mounted) return;
    final generatedText =
        generated?.success == true ? generated?.data?.trim() : null;
    final hasInterpretation = generatedText != null && generatedText.isNotEmpty;
    final repeatConclusion = hasInterpretation
        ? generatedText.substring(
            0,
            generatedText.length > 1200 ? 1200 : generatedText.length,
          )
        : enoughReadings && average != null && baselineMean != null
            ? 'Rerata HR rekaman ulang ${average.toStringAsFixed(1)} '
                '${average > baselineMean ? 'lebih tinggi' : 'tidak lebih tinggi'} '
                'dari baseline aktivitas ${_activityLabel(_activity)} '
                '${baselineMean.toStringAsFixed(1)}. Hasil ini hanya '
                'pembanding sementara sesi dan tidak mengubah baseline personal. '
                'Konteks yang dilaporkan: ${participantContext.isEmpty ? 'tidak diisi' : participantContext}. '
                'Ini observasi, bukan diagnosis.'
            : 'Rekaman ulang belum cukup untuk dibandingkan. Terkumpul '
                '$count bacaan berkualitas; diperlukan minimal '
                '${HilRecordedScenarioAnalysis.minimumRepeatReadings}. '
                'Baseline personal tetap tidak berubah.';
    final resultEvent =
        hasInterpretation ? 'zero_shot_generated' : 'zero_shot_failed';
    final repeatLogText = 'Rekaman ulang konteks ${_activityLabel(_activity)}: '
        '$count bacaan berkualitas; rerata HR raw '
        '${average?.toStringAsFixed(1) ?? 'tidak tersedia'}; '
        'baseline personal ${baselineMean?.toStringAsFixed(1) ?? 'tidak tersedia'} '
        '(tidak diubah). Kesimpulan: $repeatConclusion';
    final boundedLogText = repeatLogText.substring(
        0, repeatLogText.length > 1200 ? 1200 : repeatLogText.length);
    Map<String, dynamic>? resultLog;
    if (_selectedSampleId != null) {
      resultLog = await _logSelectedObservation(
        resultEvent,
        clarification: participantContext.isEmpty
            ? 'Konteks tidak diisi.'
            : participantContext,
        explanation: boundedLogText,
      );
    } else {
      final saved = await _saveLog(
        resultEvent,
        clarification: participantContext.isEmpty
            ? 'Konteks tidak diisi.'
            : participantContext,
        explanation: boundedLogText,
      );
      if (saved && _logs.isNotEmpty) resultLog = _logs.last;
    }
    if (!mounted) return;

    if (resultLog != null && hasInterpretation) {
      final appState = context.read<AppState>();
      final saved = await appState.recordHumanInTheLoopScenario(
        scenario: 'C',
        explanationSnapshot: _explanationSnapshot(
          repeatConclusion,
          status,
          sourceLogId: resultLog['_id'].toString(),
          sampleId: resultLog['sample_id']?.toString(),
        ),
      );
      if (!saved && mounted) {
        setState(() {
          _error = 'Interpretasi rekaman ulang tersedia, tetapi histori '
              'penjelasan gagal disimpan: ${appState.dataError ?? 'coba lagi.'}';
        });
      }
    } else if (!hasInterpretation && generated != null) {
      setState(() {
        _error = generated.message ??
            'Zero-shot tidak tersedia; ditampilkan ringkasan hasil pengukuran.';
      });
    }

    if (!mounted) return;
    setState(() => _isSaving = false);
    await _showScenarioResultDialog(
      title: 'Hasil rekam ulang · ${_activityLabel(_activity)}',
      summary: average == null
          ? 'Tidak ada rerata bacaan berkualitas yang dapat dihitung. '
              '$count bacaan terkumpul.'
          : 'Rerata HR raw rekaman ulang: ${average.toStringAsFixed(1)} '
              'dari $count bacaan berkualitas. '
              'Baseline personal: ${baselineMean?.toStringAsFixed(1) ?? 'tidak tersedia'}. '
              'Rekaman ulang ini bersifat sementara dan baseline personal tidak berubah.',
      recommendation: repeatConclusion,
      recommendationHeading:
          hasInterpretation ? 'Interpretasi zero-shot' : 'Ringkasan observasi',
    );
  }

  double? _rawSignalQuality(Map<String, dynamic> reading) {
    final quality = reading['signal_confidence'];
    return quality is num && quality.isFinite ? quality.toDouble() : null;
  }

  Future<String?> _showRepeatDecisionDialog() => showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => AlertDialog(
          key: const Key('hil-recorded-repeat-decision-dialog'),
          title: const Text('Apakah aktivitas perlu direkam ulang?'),
          content: const Text(
            'Anda dapat mengulang rekaman aktivitas dengan sensor Polar, '
            'menyatakan informasi ini sudah cukup, atau memilih untuk tidak '
            'mengulang. Rekaman ulang tidak mengubah baseline personal.',
          ),
          actions: [
            TextButton(
              key: const Key('hil-recorded-repeat-skip'),
              onPressed: () => Navigator.pop(dialogContext, 'skip'),
              child: const Text('Tidak diulang'),
            ),
            OutlinedButton(
              key: const Key('hil-recorded-repeat-sufficient'),
              onPressed: () => Navigator.pop(dialogContext, 'sufficient'),
              child: const Text('Cukup'),
            ),
            FilledButton(
              key: const Key('hil-recorded-repeat-again'),
              onPressed: () => Navigator.pop(dialogContext, 'repeat'),
              child: const Text('Rekam ulang'),
            ),
          ],
        ),
      );

  Map<String, dynamic> _explanationSnapshot(
    String explanation,
    String status, {
    required String sourceLogId,
    String? sampleId,
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
    final qualityAccepted = log['sample_id'] != null &&
        log['quality_status'] == 'accepted' &&
        log['algorithm_status'] == 'candidate_deviation';
    return [
      if (observedAt != null)
        'Waktu sampel: ${formatHilWibDateTime(observedAt)}.',
      if (heartRate is num)
        'HR raw saat deviasi: ${heartRate.toStringAsFixed(1)}.',
      if (log['baseline_mean_hr'] is num)
        'Rata-rata baseline: ${(log['baseline_mean_hr'] as num).toStringAsFixed(1)}.',
      qualityAccepted
          ? 'Deviasi terdeteksi pada bacaan berkualitas. Ini observasi, bukan diagnosis.'
          : 'HR raw live melewati rata-rata baseline, tetapi sampel Polar agregat belum tervalidasi. Hasil ini bersifat sementara dan bukan diagnosis.',
      if (participantContext != null)
        'Klarifikasi peserta: $participantContext. Informasi ini adalah laporan peserta, bukan bukti penyebab.',
    ].join('\n');
  }

  Future<bool> _showScenarioResultDialog({
    required String title,
    required String summary,
    required String recommendation,
    String recommendationHeading = 'Saran umum',
    bool canFreeze = false,
  }) async {
    if (!mounted) return false;
    return await showDialog<bool>(
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
                recommendationHeading,
                style: AppTheme.font(size: 12, weight: FontWeight.w800),
              ),
              const SizedBox(height: 6),
              Text(recommendation),
            ],
          ),
        ),
        actions: [
          if (canFreeze)
            OutlinedButton(
              key: const Key('hil-recorded-freeze-observation'),
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Bekukan hasil'),
            ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Mengerti'),
          ),
        ],
      ),
    ) ??
        false;
  }

  Map<String, dynamic> _map(dynamic value) =>
      value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

  Widget _hrPerSecondCard() {
    final isLiveRawScenario = _isLiveMonitoring || _isRecordingContextRepeat;
    final isShowingRepeat =
        _isRecordingContextRepeat || _contextRepeatReadings.isNotEmpty;
    final source = isShowingRepeat
        ? _contextRepeatReadings
        : _isLiveMonitoring
            ? _rawSessionReadings()
            : _samples;
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
              'HR per detik · ${_activityLabel(_activity)}'
              '${isShowingRepeat ? ' · rekam ulang sementara' : ''}',
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
            if (_isRecordingContextRepeat)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  'Mengumpulkan bacaan rekam ulang '
                  '$_contextRepeatCount/${HilRecordedScenarioAnalysis.minimumRepeatReadings} minimum. '
                  'Baseline personal tidak diubah.',
                  key: const Key('hil-recorded-repeat-progress'),
                  style: AppTheme.font(size: 10, color: AppTheme.textSecondary),
                ),
              ),
            if (!_isRecordingContextRepeat && _contextRepeatAverage != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  'Rerata sementara: ${_contextRepeatAverage!.toStringAsFixed(1)} '
                  'dari $_contextRepeatCount bacaan. Baseline personal tidak diubah.',
                  key: const Key('hil-recorded-repeat-average'),
                  style: AppTheme.font(size: 10, color: AppTheme.textSecondary),
                ),
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

  Widget _logHistory() {
    final sortedLogs = List<Map<String, dynamic>>.from(_logs)
      ..sort((left, right) {
        final leftAt = _eventTimestamp(left);
        final rightAt = _eventTimestamp(right);
        if (leftAt == null) return rightAt == null ? 0 : 1;
        if (rightAt == null) return -1;
        return rightAt.compareTo(leftAt);
      });
    final visibleLogs =
        _showAllScenarioLogs ? sortedLogs : sortedLogs.take(5).toList();
    return Card(
      key: const Key('hil-recorded-log-history'),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Log aktivitas dan hasil (WIB)',
                    style: AppTheme.font(size: 12, weight: FontWeight.w800),
                  ),
                ),
                IconButton(
                  key: const Key('hil-recorded-log-reload'),
                  tooltip: 'Muat ulang log dari database',
                  onPressed: _isSaving ? null : _reloadScenarioLogs,
                  icon: const Icon(Icons.refresh_rounded),
                ),
              ],
            ),
            const Text(
              'Pilihan, jawaban pengguna, hasil zero-shot, dan waktu tersimpan di database. Ketuk log untuk melihat detail lengkap.',
              key: Key('hil-recorded-log-time-explanation'),
            ),
            const SizedBox(height: 6),
            Text('Nomor sesi: $_runId', style: AppTheme.font(size: 9.5)),
            if (visibleLogs.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text('Belum ada log untuk sesi ini.'),
              ),
            ...visibleLogs.map(
              (log) => ListTile(
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
                onTap: () => _showScenarioLogDetails(log),
              ),
            ),
            if (sortedLogs.length > 5)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  key: const Key('hil-recorded-log-expand'),
                  onPressed: () => setState(
                    () => _showAllScenarioLogs = !_showAllScenarioLogs,
                  ),
                  child: Text(
                    _showAllScenarioLogs ? 'Tutup log' : 'Lihat semua log',
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

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
                '${_isRecordingContextRepeat ? 'Rekaman ulang ${_activityLabel(_activity)} sedang dihitung sebagai pembanding sementara. ' : ''}'
                'Popup hanya muncul sekali saat HR raw melewati rata-rata baseline; baseline personal tidak berubah.',
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
