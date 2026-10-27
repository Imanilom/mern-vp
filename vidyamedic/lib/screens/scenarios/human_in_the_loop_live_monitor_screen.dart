import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/app_state.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../pedagogy/history_trend_chart.dart';
import '../profile/wearable_pairing_screen.dart';

class HilLiveWindow {
  const HilLiveWindow({
    required this.meanHr,
    required this.hrSlopeBpmPerMinute,
    required this.accelerationVariability,
    required this.sampleCount,
  });

  final double? meanHr;
  final double? hrSlopeBpmPerMinute;
  final double? accelerationVariability;
  final int sampleCount;

  bool get motionIsStable =>
      accelerationVariability != null && accelerationVariability! <= 0.03;
}

class HilLiveAnalysis {
  static bool isElevatedAtStableMotion(
    double meanHr,
    double baselineMeanHr,
    double threshold,
    bool motionIsStable,
  ) =>
      motionIsStable && meanHr > baselineMeanHr + threshold;

  static String classifyObservation({
    required double meanHr,
    required double? baselineMeanHr,
    required double threshold,
    required bool qualityGatePassed,
  }) {
    if (baselineMeanHr == null || !qualityGatePassed) {
      return 'not_assessable';
    }
    return meanHr > baselineMeanHr + threshold
        ? 'candidate_deviation'
        : 'normal';
  }

  static HilLiveWindow analyzeWindow(
    List<Map<String, dynamic>> readings,
  ) {
    final valid = readings
        .map((reading) {
          final hr = reading['heart_rate_bpm'];
          final timestamp = DateTime.tryParse(
            reading['recorded_at']?.toString() ?? '',
          );
          if (hr is! num || !hr.isFinite || timestamp == null || hr <= 0) {
            return null;
          }
          final acceleration = reading['acceleration_g'];
          final magnitude = acceleration is List && acceleration.length >= 3
              ? math.sqrt(acceleration
                      .take(3)
                      .whereType<num>()
                      .map((value) => value * value)
                      .fold<double>(0, (sum, value) => sum + value)) -
                  1
              : null;
          return (
            time: timestamp.millisecondsSinceEpoch / 1000,
            hr: hr.toDouble(),
            magnitude: magnitude,
          );
        })
        .whereType<
            ({
              double time,
              double hr,
              double? magnitude,
            })>()
        .toList()
      ..sort((a, b) => a.time.compareTo(b.time));
    if (valid.isEmpty) {
      return const HilLiveWindow(
        meanHr: null,
        hrSlopeBpmPerMinute: null,
        accelerationVariability: null,
        sampleCount: 0,
      );
    }

    final meanHr = valid.map((reading) => reading.hr).reduce((a, b) => a + b) /
        valid.length;
    final meanTime =
        valid.map((reading) => reading.time).reduce((a, b) => a + b) /
            valid.length;
    final covariance = valid
        .map((reading) => (reading.time - meanTime) * (reading.hr - meanHr))
        .reduce((a, b) => a + b);
    final timeVariance = valid
        .map((reading) => math.pow(reading.time - meanTime, 2).toDouble())
        .reduce((a, b) => a + b);
    final slope = timeVariance > 0 ? covariance / timeVariance * 60 : null;
    final magnitudes =
        valid.map((reading) => reading.magnitude).whereType<double>().toList();
    final accelerationVariability =
        magnitudes.length < 4 ? null : _standardDeviation(magnitudes);

    return HilLiveWindow(
      meanHr: meanHr,
      hrSlopeBpmPerMinute: slope,
      accelerationVariability: accelerationVariability,
      sampleCount: valid.length,
    );
  }

  static double? calculateDfaAlpha1(List<double> rrIntervalsMs) {
    if (rrIntervalsMs.length < 64 ||
        rrIntervalsMs.any((value) => !value.isFinite || value <= 0)) {
      return null;
    }
    final mean = rrIntervalsMs.reduce((a, b) => a + b) / rrIntervalsMs.length;
    var cumulative = 0.0;
    final profile = rrIntervalsMs.map((rr) {
      cumulative += rr - mean;
      return cumulative;
    }).toList();
    final logScales = <double>[];
    final logFluctuations = <double>[];
    for (var scale = 4; scale <= 16; scale++) {
      final segmentCount = profile.length ~/ scale;
      if (segmentCount < 2) continue;
      var squaredResiduals = 0.0;
      var pointCount = 0;
      for (var segment = 0; segment < segmentCount; segment++) {
        final start = segment * scale;
        final values = profile.sublist(start, start + scale);
        final xMean = (scale - 1) / 2;
        final yMean = values.reduce((a, b) => a + b) / scale;
        var covariance = 0.0;
        var variance = 0.0;
        for (var index = 0; index < scale; index++) {
          final centeredX = index - xMean;
          covariance += centeredX * (values[index] - yMean);
          variance += centeredX * centeredX;
        }
        final slope = variance == 0 ? 0 : covariance / variance;
        for (var index = 0; index < scale; index++) {
          final predicted = yMean + slope * (index - xMean);
          squaredResiduals += math.pow(values[index] - predicted, 2);
          pointCount++;
        }
      }
      final fluctuation = math.sqrt(squaredResiduals / pointCount);
      if (fluctuation > 0 && fluctuation.isFinite) {
        logScales.add(math.log(scale));
        logFluctuations.add(math.log(fluctuation));
      }
    }
    if (logScales.length < 2) return null;
    final xMean = logScales.reduce((a, b) => a + b) / logScales.length;
    final yMean =
        logFluctuations.reduce((a, b) => a + b) / logFluctuations.length;
    var covariance = 0.0;
    var variance = 0.0;
    for (var index = 0; index < logScales.length; index++) {
      covariance +=
          (logScales[index] - xMean) * (logFluctuations[index] - yMean);
      variance += math.pow(logScales[index] - xMean, 2);
    }
    if (variance == 0) return null;
    final alpha = covariance / variance;
    return alpha.isFinite ? alpha : null;
  }

  static double _standardDeviation(List<double> values) {
    final mean = values.reduce((a, b) => a + b) / values.length;
    final variance = values
            .map((value) => math.pow(value - mean, 2).toDouble())
            .reduce((a, b) => a + b) /
        values.length;
    return math.sqrt(variance);
  }
}

class HumanInTheLoopLiveMonitorScreen extends StatefulWidget {
  const HumanInTheLoopLiveMonitorScreen({
    required this.baselineContexts,
    required this.initialActivity,
    super.key,
  });

  final List<Map<String, dynamic>> baselineContexts;
  final String initialActivity;

  @override
  State<HumanInTheLoopLiveMonitorScreen> createState() =>
      _HumanInTheLoopLiveMonitorScreenState();
}

class _HumanInTheLoopLiveMonitorScreenState
    extends State<HumanInTheLoopLiveMonitorScreen> {
  static const _activityOptions = <(String, String, String)>[
    ('sitting', 'Duduk', 'chair'),
    ('standing', 'Berdiri', 'accessibility_new'),
    ('walking', 'Berjalan', 'directions_walk'),
  ];

  String _activity = 'sitting';
  String _testMode = 'direct';
  String _latestStatus =
      'Mulai pemantauan untuk mengevaluasi HR setiap 30 detik.';
  String? _latestDetail;
  String? _recoveryLabel;
  double? _latestMeanHr;
  double? _latestSlope;
  double? _latestDfaAlpha1;
  int? _latestDfaRrCount;
  String? _latestDfaComparison;
  int _elapsedSeconds = 0;
  int _highHrStableWindows = 0;
  int _simulationStep = 0;
  final List<double> _simulatedHrHistory = [];
  bool _isMonitoring = false;
  bool _isSimulation = false;
  bool _ownsStream = false;
  bool _isPromptVisible = false;
  bool _promptedForCurrentEpisode = false;
  bool _hadElevatedHr = false;
  bool _isSavingClarification = false;
  bool _isGeneratingInsight = false;
  int _backendEvaluationGeneration = 0;
  String? _zeroShotInsight;
  String? _zeroShotInsightError;
  Timer? _timer;
  DateTime? _lastReadingAt;
  DateTime? _dfaBatchStartedAt;
  double? _previousWindowMeanHr;
  late final AppState _appState;
  late final List<Map<String, dynamic>> _dfaReadings;
  final List<ChartPoint> _hrObservationPoints = [];

  @override
  void initState() {
    super.initState();
    _appState = context.read<AppState>();
    _dfaReadings = [];
    _activity =
        _activityOptions.any((option) => option.$1 == widget.initialActivity)
            ? widget.initialActivity
            : 'sitting';
    _appState.wearableBridge.addListener(_handleWearableChange);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _appState.wearableBridge.removeListener(_handleWearableChange);
    if (_ownsStream && _appState.wearableBridge.isStreaming) {
      unawaited(_appState.wearableBridge.stopStreaming());
    }
    super.dispose();
  }

  Map<String, dynamic> _map(dynamic value) =>
      value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

  String _normalizeActivity(String? value) {
    final activity = value?.trim().toLowerCase() ?? '';
    return switch (activity) {
      'duduk' || 'sit' || 'sitting' => 'sitting',
      'berdiri' || 'stand' || 'standing' => 'standing',
      'berjalan' || 'walk' || 'walking' => 'walking',
      _ => activity,
    };
  }

  List<Map<String, dynamic>> get _matchingBaselines => widget.baselineContexts
      .where((baseline) =>
          _normalizeActivity(baseline['activity']?.toString()) == _activity)
      .toList();

  Map<String, dynamic> get _baselineStats {
    final matches = widget.baselineContexts.where((baseline) =>
        _normalizeActivity(baseline['activity']?.toString()) == _activity);
    final values = <String, List<double>>{};
    for (final baseline in matches) {
      final stats = _map(baseline['feature_stats']);
      for (final feature in const ['mean_hr', 'dfa_alpha1']) {
        final featureStats = _map(stats[feature]);
        final mean = featureStats['mean'];
        if (mean is num && mean.isFinite) {
          values.putIfAbsent(feature, () => []).add(mean.toDouble());
        }
        final deviation = featureStats['standard_deviation'];
        if (deviation is num && deviation.isFinite) {
          values
              .putIfAbsent('${feature}_std', () => [])
              .add(deviation.toDouble());
        }
      }
    }
    return {
      for (final entry in values.entries)
        entry.key: entry.value.reduce((a, b) => a + b) / entry.value.length,
    };
  }

  double? get _baselineMeanHr {
    final value = _baselineStats['mean_hr'];
    return value is num ? value.toDouble() : null;
  }

  bool get _hasMatureBaseline =>
      _matchingBaselines.isNotEmpty &&
      _matchingBaselines.every((baseline) => const {'mature', 'mature_legacy'}
          .contains(baseline['level']?.toString().toLowerCase()));

  String get _baselineMaturityLabel {
    if (_matchingBaselines.isEmpty) return 'status tidak tersedia';
    final levels = _matchingBaselines
        .map((baseline) => baseline['level']?.toString().toLowerCase())
        .toSet();
    if (levels
        .every((level) => level == 'mature' || level == 'mature_legacy')) {
      return 'matang';
    }
    if (levels.any((level) => level == 'mature' || level == 'mature_legacy')) {
      return 'campuran (matang dan provisional)';
    }
    return 'provisional/sementara';
  }

  double get _hrElevationThreshold {
    final standardDeviation = _baselineStats['mean_hr_std'];
    return math.max(10, (standardDeviation is num ? standardDeviation : 0) * 2);
  }

  void _resetTestObservations() {
    _hrObservationPoints.clear();
    _zeroShotInsight = null;
    _zeroShotInsightError = null;
  }

  void _recordHrObservation(HilLiveWindow window, double meanHr) {
    final actualBaseline = _baselineMeanHr;
    final status = HilLiveAnalysis.classifyObservation(
      meanHr: meanHr,
      baselineMeanHr: actualBaseline,
      threshold: _hrElevationThreshold,
      qualityGatePassed:
          window.sampleCount >= 3 && window.accelerationVariability != null,
    );
    _hrObservationPoints.add(
      ChartPoint(
        DateTime.now(),
        meanHr,
        activity: _activity,
        observationStatus: status,
      ),
    );
    if (_hrObservationPoints.length > 60) {
      _hrObservationPoints.removeAt(0);
    }
  }

  Future<void> _generateZeroShotInsight() async {
    if (_isGeneratingInsight ||
        _isSimulation ||
        _hrObservationPoints.isEmpty ||
        _baselineMeanHr == null) {
      return;
    }
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Setujui analisis zero-shot?'),
        content: const Text(
          'Ringkasan baseline CAPAR dan hasil HR tes akan diproses oleh '
          'backend VidyaMedic. Backend juga mengambil ringkasan riwayat CAPAR '
          'yang relevan dan mengirim konteks analisis ke Google Gemini untuk '
          'membuat wawasan personal. Layar ini tidak mengirim data wearable '
          'mentah. Analisis bersifat observasional, bukan diagnosis. Simulasi '
          'sintetis tidak dapat dianalisis. Anda dapat membatalkan tanpa '
          'mengirim data.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Setuju & analisis'),
          ),
        ],
      ),
    );
    if (accepted != true || !mounted) return;

    final baselineStatus = _matchingBaselines
        .take(6)
        .map((baseline) =>
            '${baseline['time_period'] ?? 'periode tidak diketahui'}: '
            '${baseline['level'] ?? 'status tidak tersedia'}')
        .join(', ');
    final observations = _hrObservationPoints;
    final recent = observations.length > 12
        ? observations.sublist(observations.length - 12)
        : observations;
    final evidence = <Map<String, dynamic>>[
      {
        'source': 'personal_baseline',
        'facts': 'Baseline aktivitas $_activity berstatus $baselineStatus.',
        'metric': 'mean_hr',
        'value': _baselineMeanHr,
        'unit': 'bpm',
        'status': baselineStatus,
      },
      ...recent.map(
        (point) => <String, dynamic>{
          'source': 'capar_summary',
          'facts': 'Observasi HR pada tes HIL, aktivitas $_activity.',
          'metric': 'mean_hr',
          'value': point.value,
          'unit': 'bpm',
          'status': point.observationStatus ?? 'not_assessed',
        },
      ),
    ];
    final summary = [
      'Tes Human-in-the-Loop: aktivitas $_activity, mode $_testMode.',
      'Rerata baseline HR ${_baselineMeanHr!.toStringAsFixed(1)} bpm; '
          'status kematangan $baselineStatus; ambang observasi '
          '${_hrElevationThreshold.toStringAsFixed(1)} bpm.',
      'Sampel HR tes (maksimum 12 terakhir): '
          '${recent.map((point) => '${point.value.toStringAsFixed(1)} bpm '
              '(${point.observationStatus ?? 'belum dinilai'})').join('; ')}.',
      'Data adalah observasi tes, bukan diagnosis atau bukti penyebab.',
    ].join(' ');

    setState(() {
      _isGeneratingInsight = true;
      _zeroShotInsight = null;
      _zeroShotInsightError = null;
    });
    final response = await ApiService.generatePersonalChatAnswer(
      question: 'Gunakan analisis zero-shot CAPAR untuk menjelaskan secara '
          'ringkas perubahan HR selama tes Human-in-the-Loop ini, status '
          'normal atau kandidat deviasi, kontribusi dan keterbatasan baseline '
          '($baselineStatus), serta informasi apa yang berhasil diperoleh. '
          'Jangan membuat diagnosis atau mengarang penyebab.',
      evidence: evidence,
      localSummary:
          summary.length > 1200 ? summary.substring(0, 1200) : summary,
      conversationHistory: const [],
    );
    if (!mounted) return;
    setState(() {
      _isGeneratingInsight = false;
      if (response.success && response.data != null) {
        _zeroShotInsight = response.data;
      } else {
        _zeroShotInsightError =
            response.message ?? 'Analisis zero-shot tidak tersedia.';
      }
    });
  }

  void _handleWearableChange() {
    if (!mounted || !_isMonitoring) return;
    final bridge = _appState.wearableBridge;
    if (!bridge.isStreaming) {
      setState(() {
        _latestStatus = 'Streaming wearable terputus; evaluasi dihentikan.';
        _latestDetail =
            bridge.error ?? 'Sambungkan kembali sensor untuk melanjutkan.';
      });
      _timer?.cancel();
      _timer = null;
      _isMonitoring = false;
      _ownsStream = false;
      return;
    }
    _collectDfaReadings();
  }

  Future<void> _startMonitoring() async {
    final bridge = _appState.wearableBridge;
    if (bridge.isDemoDevice) {
      setState(() {
        _latestStatus = 'Monitor HIL hanya menerima data sensor nyata.';
        _latestDetail =
            'Data sensor demo/sintetis tidak digunakan untuk perbandingan baseline.';
      });
      return;
    }
    final startStreamHere = !bridge.isStreaming;
    if (!bridge.isStreaming) {
      await Navigator.of(context).push(
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
      setState(() {
        _latestStatus = bridge.isDemoDevice
            ? 'Monitor HIL hanya menerima data sensor nyata.'
            : 'Streaming sensor belum aktif.';
        _latestDetail = bridge.error ??
            'Pastikan Polar H10 tersambung dan aliran HR/RR serta akselerometer tersedia.';
      });
      return;
    }
    _ownsStream = startStreamHere;
    _startTimer();
  }

  void _startSimulation() {
    if (_isMonitoring) return;
    final baseline = _baselineMeanHr ?? 70;
    _isSimulation = true;
    _ownsStream = false;
    _simulationStep = 0;
    _simulatedHrHistory.clear();
    _elapsedSeconds = 0;
    _resetTestObservations();
    _dfaReadings.clear();
    _highHrStableWindows = 0;
    _promptedForCurrentEpisode = false;
    _hadElevatedHr = false;
    _previousWindowMeanHr = null;
    _recoveryLabel = null;
    _isMonitoring = true;
    setState(() {
      _latestStatus = 'Simulasi dimulai · HR tinggi sejak awal.';
      _latestDetail =
          'HR sintetis akan turun bertahap dari ${(baseline + 35).toStringAsFixed(0)} bpm menuju baseline ${baseline.toStringAsFixed(0)} bpm. Data ini hanya untuk uji UI dan tidak disimpan.';
    });
    _runSimulationStep();
    _timer = Timer.periodic(const Duration(seconds: 2), (_) {
      if (!mounted || !_isMonitoring || !_isSimulation || _isPromptVisible) {
        return;
      }
      _elapsedSeconds += 30;
      _runSimulationStep();
    });
  }

  void _runSimulationStep() {
    final baseline = _baselineMeanHr ?? 70;
    const offsets = [35.0, 35.0, 28.0, 21.0, 14.0, 7.0, 0.0];
    if (_simulationStep >= offsets.length) return;
    final targetHr = baseline + offsets[_simulationStep];
    final previousHr = _previousWindowMeanHr ?? targetHr;
    final slope = _simulationStep == 0 ? 0.0 : (targetHr - previousHr) * 2;
    final window = HilLiveWindow(
      meanHr: targetHr,
      hrSlopeBpmPerMinute: slope,
      accelerationVariability: 0,
      sampleCount: 3,
    );
    _simulatedHrHistory.add(targetHr);
    _evaluateHrWindow(windowOverride: window);
    final isFinalStep = _simulationStep == offsets.length - 1;
    _simulationStep++;
    if (isFinalStep && mounted) {
      _timer?.cancel();
      _timer = null;
      setState(() {
        _isMonitoring = false;
        _latestStatus = 'Simulasi selesai · HR kembali ke baseline.';
        _latestDetail =
            'HR simulasi mencapai ${targetHr.toStringAsFixed(1)} bpm; baseline ${baseline.toStringAsFixed(1)} bpm. Rekaman sensor atau event server tidak dibuat.';
      });
    }
  }

  void _startTimer() {
    _isSimulation = false;
    final bridge = _appState.wearableBridge;
    if (_isMonitoring || !bridge.isStreaming || bridge.isDemoDevice) return;
    _isMonitoring = true;
    _elapsedSeconds = 0;
    _resetTestObservations();
    _dfaBatchStartedAt = DateTime.now();
    _lastReadingAt = null;
    _dfaReadings.clear();
    _highHrStableWindows = 0;
    _promptedForCurrentEpisode = false;
    _hadElevatedHr = false;
    _previousWindowMeanHr = null;
    _recoveryLabel = null;
    _collectDfaReadings();
    _evaluateHrWindow();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || !_isMonitoring) return;
      _elapsedSeconds++;
      _collectDfaReadings();
      if (_elapsedSeconds > 0 && _elapsedSeconds % 300 == 0) {
        final previousMeanHr = _previousWindowMeanHr;
        final previousElevated = _hadElevatedHr;
        _evaluateHrWindow(submitBackend: false);
        _evaluateDfaBatch(
          previousMeanHr: previousMeanHr,
          previousElevated: previousElevated,
        );
      } else if (_elapsedSeconds % 30 == 0) {
        _evaluateHrWindow();
      }
      setState(() {});
    });
    setState(() {
      _latestStatus = 'Pemantauan HIL aktif.';
      _latestDetail =
          'HR dievaluasi tiap 30 detik. DFA α1 menunggu satu batch RR 5 menit.';
    });
  }

  void _collectDfaReadings() {
    final startedAt = _dfaBatchStartedAt;
    if (startedAt == null) return;
    final freshReadings = _appState.wearableBridge.recentStreamReadings;
    for (final reading in freshReadings) {
      final recordedAt = DateTime.tryParse(
        reading['recorded_at']?.toString() ?? '',
      );
      if (recordedAt == null ||
          recordedAt.isBefore(startedAt) ||
          (_lastReadingAt != null && !recordedAt.isAfter(_lastReadingAt!))) {
        continue;
      }
      _lastReadingAt = recordedAt;
      _dfaReadings.add(reading);
    }
    if (_dfaReadings.length > 1200) {
      _dfaReadings.removeRange(0, _dfaReadings.length - 1200);
    }
  }

  List<Map<String, dynamic>> _lastThirtySecondsOfReadings() {
    final cutoff = DateTime.now().toUtc().subtract(const Duration(seconds: 30));
    return _appState.wearableBridge.recentStreamReadings.where((reading) {
      final recordedAt =
          DateTime.tryParse(reading['recorded_at']?.toString() ?? '');
      return recordedAt != null && !recordedAt.toUtc().isBefore(cutoff);
    }).toList();
  }

  void _evaluateHrWindow({
    HilLiveWindow? windowOverride,
    bool submitBackend = true,
  }) {
    final recentReadings = _lastThirtySecondsOfReadings();
    final window =
        windowOverride ?? HilLiveAnalysis.analyzeWindow(recentReadings);
    final baselineHr =
        _isSimulation ? (_baselineMeanHr ?? 70) : _baselineMeanHr;
    final meanHr = window.meanHr;
    if (meanHr == null || window.sampleCount < 3) {
      setState(() {
        _latestMeanHr = meanHr;
        _latestSlope = window.hrSlopeBpmPerMinute;
        _latestStatus = 'Data HR 30 detik belum cukup.';
        _latestDetail =
            '${window.sampleCount} pembacaan valid tersedia; dibutuhkan minimal 3 untuk menghitung rerata dan slope.';
      });
      return;
    }
    if (baselineHr == null) {
      _recordHrObservation(window, meanHr);
      setState(() {
        _latestMeanHr = meanHr;
        _latestSlope = window.hrSlopeBpmPerMinute;
        _latestStatus = 'Baseline HR tidak tersedia untuk konteks ini.';
        _latestDetail = _isSimulation
            ? 'Simulasi menggunakan baseline tampilan 70 bpm sebagai nilai contoh.'
            : 'Data live ditampilkan, tetapi deviasi dan pemulihan tidak disimpulkan tanpa baseline pembanding.';
      });
      if (submitBackend && !_isSimulation) {
        unawaited(_submitHilRealtime(
          readings: recentReadings,
          previousMeanHr: _previousWindowMeanHr,
          previousElevated: _hadElevatedHr,
        ));
      }
      _previousWindowMeanHr = meanHr;
      return;
    }
    _recordHrObservation(window, meanHr);
    final elevated = meanHr > baselineHr + _hrElevationThreshold;
    final hrDelta = meanHr - baselineHr;
    final baselineHrStd = _baselineStats['mean_hr_std'];
    final hrZScore = baselineHrStd is num && baselineHrStd > 0
        ? hrDelta / baselineHrStd
        : null;
    final previousMeanHr = _previousWindowMeanHr;
    final previousElevated = _hadElevatedHr;
    final approachingBaseline = _previousWindowMeanHr != null &&
        meanHr < _previousWindowMeanHr! &&
        (meanHr - baselineHr).abs() <
            (_previousWindowMeanHr! - baselineHr).abs();
    if (elevated) _hadElevatedHr = true;

    final status = _hadElevatedHr && approachingBaseline
        ? meanHr <= baselineHr + _hrElevationThreshold
            ? 'HR kembali ke rentang baseline personal.'
            : 'HR menurun menuju baseline personal.'
        : elevated
            ? window.motionIsStable
                ? (window.hrSlopeBpmPerMinute ?? 0) > 0
                    ? 'HR naik saat akselerasi relatif stabil.'
                    : 'HR tetap tinggi saat akselerasi relatif stabil.'
                : 'HR berada di atas rentang personal.'
            : 'HR berada di sekitar rentang baseline personal.';
    final detail = [
      'Rerata 30 dtk ${meanHr.toStringAsFixed(1)} bpm; baseline ${baselineHr.toStringAsFixed(1)} bpm.',
      'Deviasi ${hrDelta >= 0 ? '+' : ''}${hrDelta.toStringAsFixed(1)} bpm${hrZScore == null ? '' : ' (z=${hrZScore.toStringAsFixed(2)})'}.',
      'Ambang observasi ${_hrElevationThreshold.toStringAsFixed(1)} bpm di atas baseline.',
      if (window.hrSlopeBpmPerMinute != null)
        'Slope ${window.hrSlopeBpmPerMinute!.toStringAsFixed(1)} bpm/menit.',
      if (window.accelerationVariability != null)
        'Variasi magnitudo akselerasi ${window.accelerationVariability!.toStringAsFixed(3)} g.',
      if (elevated && window.motionIsStable)
        'Pola ini meminta klarifikasi aktivitas; bukan bukti penyebab atau diagnosis.',
      if (!_hasMatureBaseline)
        'Baseline belum mature; perbandingan ini bersifat sementara.',
      if (_isSimulation) 'SIMULASI: data sintetis, bukan rekaman sensor.',
      if (_hadElevatedHr && approachingBaseline)
        'Arah perubahan HR mendekati rerata baseline; pemulihan tidak dipastikan sebagai efek aktivitas tertentu.',
    ].join(' ');

    setState(() {
      _latestMeanHr = meanHr;
      _latestSlope = window.hrSlopeBpmPerMinute;
      _latestStatus = status;
      _latestDetail = detail;
      _recoveryLabel = _hadElevatedHr && approachingBaseline ? status : null;
    });

    if (HilLiveAnalysis.isElevatedAtStableMotion(
      meanHr,
      baselineHr,
      _hrElevationThreshold,
      window.motionIsStable,
    )) {
      _highHrStableWindows++;
      if (_highHrStableWindows >= 2 && !_promptedForCurrentEpisode) {
        _promptedForCurrentEpisode = true;
        unawaited(_requestActivityClarification(window));
      }
    } else {
      _highHrStableWindows = 0;
    }
    if (!_isSimulation &&
        _hadElevatedHr &&
        !elevated &&
        approachingBaseline &&
        _recoveryLabel != null) {
      _hadElevatedHr = false;
      _highHrStableWindows = 0;
      _promptedForCurrentEpisode = false;
      unawaited(_recordRecoveryEvent(window, baselineHr));
    }
    if (submitBackend && !_isSimulation) {
      unawaited(_submitHilRealtime(
        readings: recentReadings,
        previousMeanHr: previousMeanHr,
        previousElevated: previousElevated,
      ));
    }
    _previousWindowMeanHr = meanHr;
  }

  void _evaluateDfaBatch({
    double? previousMeanHr,
    bool previousElevated = false,
  }) {
    final validRr = _dfaReadings
        .map((reading) => reading['rr_interval_ms'])
        .whereType<num>()
        .map((value) => value.toDouble())
        .where((value) => value >= 250 && value <= 3000)
        .toList();
    setState(() {
      _latestStatus = 'Batch RR 5 menit dikirim untuk evaluasi backend.';
      _latestDetail =
          '${validRr.length} interval RR diteruskan untuk menghitung DFA α1 dan memperbarui interpretasi.';
    });
    if (!_isSimulation) {
      unawaited(_submitHilRealtime(
        readings: _lastThirtySecondsOfReadings(),
        dfaRrIntervals: validRr,
        previousMeanHr: previousMeanHr,
        previousElevated: previousElevated,
      ));
    }
    _dfaReadings.clear();
    _dfaBatchStartedAt = DateTime.now();
  }

  Future<void> _submitHilRealtime({
    required List<Map<String, dynamic>> readings,
    List<double>? dfaRrIntervals,
    double? previousMeanHr,
    required bool previousElevated,
  }) async {
    if (readings.length < 3) {
      if (mounted) {
        setState(() {
          _latestStatus = 'Evaluasi backend belum dapat dilakukan.';
          _latestDetail =
              'Tiga atau lebih pembacaan HR dengan kualitas memadai diperlukan untuk mengirim jendela realtime.';
        });
      }
      return;
    }

    final requestGeneration = ++_backendEvaluationGeneration;
    if (mounted) {
      setState(() {
        _latestStatus = dfaRrIntervals == null
            ? 'Mengirim HR 30 detik untuk evaluasi sinkron backend...'
            : 'Mengirim batch DFA 5 menit untuk evaluasi sinkron backend...';
        _latestDetail =
            'Hasil dihitung langsung oleh API dan tidak menunggu worker atau antrean RabbitMQ.';
      });
    }
    final response = await ApiService.evaluateHilRealtime({
      'activity': _activity,
      'device_id': _appState.wearableBridge.deviceId,
      'readings': readings,
      if (dfaRrIntervals != null) 'dfa_rr_intervals_ms': dfaRrIntervals,
      if (previousMeanHr != null) 'previous_mean_hr': previousMeanHr,
      'previous_elevated': previousElevated,
    });
    if (!mounted || requestGeneration != _backendEvaluationGeneration) return;
    if (!response.success || response.data == null) {
      setState(() {
        _latestStatus = 'Evaluasi realtime backend gagal.';
        _latestDetail = response.message ??
            'Backend tidak mengembalikan hasil evaluasi; status sebelumnya tidak diperbarui.';
      });
      return;
    }

    final result = response.data!;
    final metrics = _map(result['metrics']);
    final interpretation = _map(result['interpretation']);
    final baseline = _map(result['baseline']);
    final comparisons = _map(result['comparisons']);
    final dfaComparison = _map(comparisons['dfa_alpha1']);
    final status = interpretation['status']?.toString() ?? 'not_assessable';
    final detail = interpretation['detail']?.toString() ??
        'Backend tidak memberikan detail interpretasi.';
    final meanHr = metrics['mean_hr'];
    final slope = metrics['hr_slope_bpm_per_minute'];
    final dfaAlpha = metrics['dfa_alpha1'];
    final dfaCount = metrics['dfa_rr_count'];
    final dfaBase = dfaComparison['baseline_mean'];
    final dfaValue = dfaComparison['value'];
    final dfaZ = dfaComparison['z_score'];
    final label = switch (status) {
      'normal' => 'Backend: dalam rentang baseline',
      'candidate_deviation' => 'Backend: kandidat deviasi',
      'recovery_trend' => 'Backend: tren pemulihan menuju baseline',
      'recovered' => 'Backend: kembali ke rentang baseline',
      _ => 'Backend: belum dapat dinilai',
    };
    final dfaText = dfaAlpha is num
        ? ' DFA α1 ${dfaAlpha.toStringAsFixed(3)} dari ${dfaCount ?? 0} RR valid'
            '${dfaBase is num ? ', baseline ${dfaBase.toStringAsFixed(3)}' : ''}'
            '${dfaZ is num ? ', z=${dfaZ.toStringAsFixed(2)}' : ''}.'
        : dfaRrIntervals != null
            ? ' DFA α1 belum tersedia; dibutuhkan minimal 64 RR valid berkualitas.'
            : '';

    setState(() {
      _latestStatus = label;
      _latestDetail =
          '$detail${baseline['level'] == 'provisional' ? ' Baseline masih provisional dan digunakan sebagai referensi sementara.' : ''}$dfaText';
      if (meanHr is num) _latestMeanHr = meanHr.toDouble();
      if (slope is num) _latestSlope = slope.toDouble();
      if (dfaAlpha is num) {
        _latestDfaAlpha1 = dfaAlpha.toDouble();
        _latestDfaRrCount = dfaCount is num ? dfaCount.toInt() : 0;
        _latestDfaComparison = dfaBase is num
            ? 'Deviasi ${dfaValue is num ? (dfaValue - dfaBase).toStringAsFixed(3) : '-'}'
                '${dfaZ is num ? ' (z=${dfaZ.toStringAsFixed(2)})' : ''} dari baseline ${dfaBase.toStringAsFixed(3)}.'
            : 'Baseline DFA α1 untuk konteks ini belum tersedia.';
      } else if (dfaRrIntervals != null) {
        _latestDfaAlpha1 = null;
        _latestDfaRrCount = dfaCount is num ? dfaCount.toInt() : 0;
        _latestDfaComparison =
            'Batch backend selesai; data DFA α1 belum cukup atau kualitasnya tidak memenuhi syarat.';
      }
      if (status == 'candidate_deviation') _hadElevatedHr = true;
      if (status == 'recovered') _hadElevatedHr = false;
      _recoveryLabel = interpretation['is_recovery'] == true ? label : null;
      if (_hrObservationPoints.isNotEmpty && meanHr is num) {
        final previousPoint = _hrObservationPoints.last;
        final chartStatus = switch (status) {
          'normal' || 'recovered' => 'normal',
          'candidate_deviation' => 'candidate_deviation',
          'recovery_trend' => 'recovery',
          _ => 'not_assessable',
        };
        _hrObservationPoints[_hrObservationPoints.length - 1] = ChartPoint(
          previousPoint.time,
          meanHr.toDouble(),
          activity: previousPoint.activity,
          observationStatus: chartStatus,
        );
      }
    });
    if (dfaAlpha is num && dfaRrIntervals != null) {
      unawaited(_recordDfaEvent(
        dfaAlpha.toDouble(),
        dfaCount is num ? dfaCount.toInt() : 0,
      ));
    }
  }

  Future<void> _requestActivityClarification(HilLiveWindow window) async {
    if (!mounted || _isPromptVisible) return;
    _isPromptVisible = true;
    final answer = await showDialog<({String activity, String? intensity})>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Klarifikasi aktivitas'),
        content: Text(
          'HR 30 detik di atas baseline ${_hasMatureBaseline ? 'personal' : 'tersimpan sementara'} sementara akselerasi relatif stabil. '
          'Apakah Anda baru saja melakukan aktivitas berat?\n\n'
          'HR: ${window.meanHr?.toStringAsFixed(1) ?? '-'} bpm'
          '${_baselineMeanHr == null ? '' : ' · baseline ${_baselineMeanHr!.toStringAsFixed(1)} bpm'}'
          '${window.hrSlopeBpmPerMinute == null ? '' : ' · slope ${window.hrSlopeBpmPerMinute!.toStringAsFixed(1)} bpm/menit'}\n\n'
          'Pertanyaan ini hanya mencatat konteks yang Anda laporkan; pola sensor tidak menentukan penyebab.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(
              dialogContext,
              (activity: 'no', intensity: null),
            ),
            child: const Text('Tidak'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(
              dialogContext,
              (activity: 'uncertain', intensity: null),
            ),
            child: const Text('Tidak yakin'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(
              dialogContext,
              (activity: 'yes', intensity: 'vigorous'),
            ),
            child: const Text('Ya, aktivitas berat'),
          ),
        ],
      ),
    );
    _isPromptVisible = false;
    if (answer == null || !mounted) return;
    if (_isSimulation) {
      setState(() {
        _latestStatus = 'Jawaban simulasi tercatat di layar.';
        _latestDetail =
            'Pilihan: ${answer.activity == 'yes' ? 'ya, aktivitas berat' : answer.activity == 'no' ? 'tidak' : 'tidak yakin'}. Tidak dikirim atau disimpan sebagai event pasien.';
      });
      return;
    }
    setState(() => _isSavingClarification = true);
    final saved = await _saveHilEvent(
      eventName: 'activity_clarification',
      details: 'Klarifikasi aktivitas berat oleh peserta.',
      value: {
        'mode': _testMode,
        'ctx': _activity,
        'heavy': answer.activity,
        'intensity': answer.intensity ?? 'not_applicable',
        'hr': window.meanHr,
        'base': _baselineMeanHr,
        'slope': window.hrSlopeBpmPerMinute,
        'accel_var': window.accelerationVariability,
        'stable': window.motionIsStable,
      },
      intensity: answer.intensity ?? 'none',
    );
    if (!mounted) return;
    setState(() => _isSavingClarification = false);
    if (!saved) _showSaveError('Klarifikasi live gagal disimpan.');
  }

  Future<void> _recordRecoveryEvent(
    HilLiveWindow window,
    double baselineHr,
  ) async {
    if (_isSimulation) return;
    await _saveHilEvent(
      eventName: 'hr_recovery_observed',
      details: 'HR menurun menuju atau kembali ke rentang baseline.',
      value: {
        'mode': _testMode,
        'ctx': _activity,
        'hr': window.meanHr,
        'base': baselineHr,
        'slope': window.hrSlopeBpmPerMinute,
        'label': _recoveryLabel,
      },
    );
  }

  Future<void> _recordDfaEvent(double alpha1, int rrCount) async {
    await _saveHilEvent(
      eventName: 'dfa_5_minute_batch',
      details: 'Batch DFA alpha-1 5 menit selesai.',
      value: {
        'mode': _testMode,
        'ctx': _activity,
        'alpha1': alpha1,
        'rr': rrCount,
        'base': _baselineStats['dfa_alpha1'],
      },
    );
  }

  Future<bool> _saveHilEvent({
    required String eventName,
    required String details,
    required Map<String, dynamic> value,
    String? intensity,
  }) async {
    final eventDetails = '$details ${jsonEncode(value)}';
    if (eventDetails.length > 300) {
      _showSaveError(
        'Event HIL tidak disimpan: detail melebihi batas 300 karakter.',
      );
      return false;
    }
    final response = await ApiService.createEvent({
      'event_type': 'hil_scenario',
      'occurred_at': DateTime.now().toUtc().toIso8601String(),
      'details': eventDetails,
      'value': eventName,
      if (intensity != null) 'intensity': intensity,
      'unit': 'hil_live_monitor',
    });
    if (!response.success && mounted) {
      _showSaveError(response.message ?? 'Event HIL gagal disimpan.');
    }
    return response.success;
  }

  void _showSaveError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _stopMonitoring() async {
    _timer?.cancel();
    _timer = null;
    setState(() {
      _isMonitoring = false;
      _isSimulation = false;
      _latestStatus = 'Pemantauan HIL dihentikan.';
    });
    if (_ownsStream && _appState.wearableBridge.isStreaming) {
      await _appState.wearableBridge.stopStreaming();
    }
    _ownsStream = false;
  }

  @override
  Widget build(BuildContext context) {
    final bridge = context.watch<AppState>().wearableBridge;
    final baselineHr = _baselineMeanHr;
    return Scaffold(
      appBar: AppBar(title: const Text('Monitor Human in the Loop')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _infoCard(
            icon: Icons.health_and_safety_outlined,
            title: 'Pemantauan khusus skenario C',
            detail:
                'HR dievaluasi setiap 30 detik, deviasi dibandingkan dengan baseline aktivitas yang dipilih, dan DFA α1 dihitung per batch 5 menit. Hasil hanya observasi, bukan diagnosis.',
          ),
          const SizedBox(height: 12),
          _sectionTitle('Kondisi pengujian'),
          Wrap(
            spacing: 8,
            children: [
              _modeChoice('direct', 'Mulai langsung'),
              _modeChoice('after_activity', 'Setelah aktivitas'),
            ],
          ),
          const SizedBox(height: 12),
          _sectionTitle('Konteks baseline untuk dibandingkan'),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final option in _activityOptions)
                ChoiceChip(
                  key: Key('hil-live-activity-${option.$1}'),
                  label: Text(option.$2),
                  selected: _activity == option.$1,
                  onSelected: _isMonitoring
                      ? null
                      : (_) => setState(() {
                            _activity = option.$1;
                            _resetTestObservations();
                          }),
                ),
            ],
          ),
          const SizedBox(height: 12),
          _infoCard(
            icon: Icons.equalizer,
            title:
                'Baseline ${_activityOptions.firstWhere((option) => option.$1 == _activity).$2}',
            detail: baselineHr == null
                ? 'Data baseline HR untuk aktivitas ini belum tersedia. Pemantauan dapat berjalan, tetapi deviasi dan pemulihan tidak akan disimpulkan tanpa nilai pembanding.'
                : 'Rerata HR ${baselineHr.toStringAsFixed(1)} bpm · ambang observasi +${_hrElevationThreshold.toStringAsFixed(1)} bpm'
                    ' · ${_matchingBaselines.length} periode baseline dirata-ratakan'
                    '${_hasMatureBaseline ? '' : ' (belum mature; referensi sementara)'}.',
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  key: const Key('hil-live-start'),
                  onPressed: _isMonitoring ? null : _startMonitoring,
                  icon: const Icon(Icons.play_arrow),
                  label: Text(bridge.isStreaming
                      ? 'Mulai pemantauan'
                      : 'Sambungkan sensor & mulai'),
                ),
              ),
              if (_isMonitoring) ...[
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  key: const Key('hil-live-stop'),
                  onPressed: _stopMonitoring,
                  icon: const Icon(Icons.stop),
                  label: const Text('Stop'),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              key: const Key('hil-live-run-simulation'),
              onPressed: _isMonitoring ? null : _startSimulation,
              icon: const Icon(Icons.science_outlined),
              label: const Text('Simulasikan HR tinggi → baseline'),
            ),
          ),
          if (_isSimulation)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'MODE SIMULASI · HR tinggi sejak awal, menurun tiap 30 detik simulasi. Tidak menggunakan sensor dan tidak menyimpan event.',
                key: const Key('hil-live-simulation-banner'),
                style: AppTheme.font(
                  size: 10.5,
                  color: AppTheme.statusOrange,
                  height: 1.4,
                ),
              ),
            ),
          if (_isSimulation)
            _infoCard(
              key: const Key('hil-live-simulation-recovery-progress'),
              icon: Icons.trending_down,
              title: 'Progres simulasi recovery',
              detail:
                  '${_simulatedHrHistory.map((hr) => '${hr.toStringAsFixed(0)} bpm').join(' → ')} · baseline ${baselineHr?.toStringAsFixed(0) ?? '70'} bpm',
            ),
          const SizedBox(height: 12),
          _infoCard(
            icon: bridge.isStreaming ? Icons.sensors : Icons.sensors_off,
            title: bridge.isStreaming && !bridge.isDemoDevice
                ? 'Polar H10 tersambung'
                : 'Streaming sensor tidak aktif',
            detail: bridge.isDemoDevice
                ? 'Sensor demo terdeteksi; tidak digunakan untuk analisis live HIL.'
                : bridge.isStreaming
                    ? 'HR saat ini ${bridge.heartRateBpm?.toString() ?? '-'} bpm · ${bridge.recentStreamReadings.length} titik terbaru tersimpan.'
                    : bridge.error ??
                        'Sambungkan perangkat nyata untuk memulai pengukuran.',
          ),
          const SizedBox(height: 12),
          _sectionTitle('Hasil pemantauan'),
          _observationChart(),
          const SizedBox(height: 8),
          _infoCard(
            key: const Key('hil-live-zero-shot-insight'),
            icon: Icons.auto_awesome_outlined,
            title: 'Wawasan zero-shot',
            detail: _zeroShotInsight != null
                ? 'Analisis selesai. Hasil tersedia di bawah.'
                : _zeroShotInsightError ??
                    (_isSimulation
                        ? 'Analisis zero-shot dinonaktifkan untuk simulasi sintetis.'
                        : 'Minta analisis setelah tersedia hasil tes nyata dan baseline aktivitas.'),
          ),
          if (!_isSimulation)
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                key: const Key('hil-live-zero-shot-analyze'),
                onPressed: _isGeneratingInsight ||
                        _hrObservationPoints.isEmpty ||
                        _baselineMeanHr == null
                    ? null
                    : _generateZeroShotInsight,
                icon: _isGeneratingInsight
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.auto_awesome),
                label: Text(_isGeneratingInsight
                    ? 'Menganalisis...'
                    : 'Analisis tes dengan zero-shot'),
              ),
            ),
          if (_zeroShotInsight != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: SelectableText(
                _zeroShotInsight!,
                key: const Key('hil-live-zero-shot-result'),
                style: AppTheme.font(
                  size: 11,
                  color: AppTheme.textSecondary,
                  height: 1.45,
                ),
              ),
            ),
          const SizedBox(height: 8),
          _infoCard(
            key: const Key('hil-live-current-result'),
            icon: Icons.monitor_heart_outlined,
            title: _latestStatus,
            detail: [
              if (_latestMeanHr != null)
                'Rerata HR: ${_latestMeanHr!.toStringAsFixed(1)} bpm.',
              if (_latestSlope != null)
                'Slope: ${_latestSlope!.toStringAsFixed(1)} bpm/menit.',
              if (_recoveryLabel != null) 'Label: $_recoveryLabel.',
              if (_latestDetail != null) _latestDetail!,
            ].join(' '),
          ),
          const SizedBox(height: 8),
          _infoCard(
            key: const Key('hil-live-dfa-result'),
            icon: Icons.multiline_chart,
            title: 'DFA α1 · batch 5 menit',
            detail: _latestDfaAlpha1 == null
                ? 'Belum ada hasil batch. ${_latestDfaRrCount == null ? 'Nilai dihitung setelah lima menit.' : '$_latestDfaRrCount RR valid terkumpul; minimal 64 RR diperlukan.'}'
                : 'DFA α1 ${_latestDfaAlpha1!.toStringAsFixed(3)} dari $_latestDfaRrCount RR valid. ${_latestDfaComparison ?? ''} Nilai deskriptif, bukan diagnosis.',
          ),
          if (_isSavingClarification)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: LinearProgressIndicator(),
            ),
          const SizedBox(height: 12),
          Text(
            'Sinyal HR yang tinggi saat akselerasi stabil hanya memicu pertanyaan kepada peserta. Sistem tidak menyatakan aktivitas berat sebagai penyebab; jawaban dan pemulihan HR disimpan sebagai konteks pengamatan.',
            style: AppTheme.font(
              size: 11,
              color: AppTheme.textSecondary,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _modeChoice(String mode, String label) => ChoiceChip(
        key: Key('hil-live-mode-$mode'),
        label: Text(label),
        selected: _testMode == mode,
        onSelected:
            _isMonitoring ? null : (_) => setState(() => _testMode = mode),
      );

  Widget _observationChart() {
    final points = List<ChartPoint>.unmodifiable(_hrObservationPoints);
    final normalCount =
        points.where((point) => point.observationStatus == 'normal').length;
    final candidateCount = points
        .where((point) => point.observationStatus == 'candidate_deviation')
        .length;
    final recoveryCount =
        points.where((point) => point.observationStatus == 'recovery').length;
    final notAssessedCount = points
        .where((point) => point.observationStatus == 'not_assessable')
        .length;
    return Card(
      key: const Key('hil-live-observation-chart'),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'HR sepanjang tes',
              style: AppTheme.font(
                size: 12,
                weight: FontWeight.w700,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            if (points.isEmpty)
              Text(
                'Grafik muncul setelah window HR pertama dievaluasi.',
                style: AppTheme.font(size: 10.5, color: AppTheme.textSecondary),
              )
            else
              SizedBox(
                height: 210,
                child: CustomPaint(
                  key: const Key('hil-live-observation-chart-plot'),
                  size: const Size(double.infinity, 210),
                  painter: TrendChartPainter(
                    points: points,
                    color: AppTheme.primary,
                    baselineMean: _baselineMeanHr,
                  ),
                ),
              ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 12,
              runSpacing: 6,
              children: [
                _chartLegend(AppTheme.statusGreen, 'Normal'),
                _chartLegend(AppTheme.statusRed, 'Kandidat deviasi'),
                _chartLegend(AppTheme.statusOrange, 'Tren pemulihan'),
                _chartLegend(AppTheme.textMuted, 'Belum dapat dinilai'),
                if (_baselineMeanHr != null)
                  _chartLegend(AppTheme.textMuted, 'Garis: baseline'),
              ],
            ),
            if (points.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  '${points.length} window HR · baseline '
                  '$_baselineMaturityLabel'
                  '${_isSimulation ? ' · DATA SIMULASI' : ''}. '
                  '$normalCount normal · $candidateCount kandidat deviasi · '
                  '$recoveryCount tren pemulihan · '
                  '$notAssessedCount belum dapat dinilai. '
                  'Kandidat deviasi adalah penanda observasi, bukan diagnosis.',
                  key: const Key('hil-live-observation-chart-caption'),
                  style: AppTheme.font(
                    size: 10,
                    color: AppTheme.textSecondary,
                    height: 1.4,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _chartLegend(Color color, String label) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 4),
          Text(label, style: AppTheme.font(size: 9, color: AppTheme.textMuted)),
        ],
      );

  Widget _sectionTitle(String title) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(
          title,
          style: AppTheme.font(
            size: 13,
            weight: FontWeight.w700,
            color: AppTheme.textPrimary,
          ),
        ),
      );

  Widget _infoCard({
    Key? key,
    required IconData icon,
    required String title,
    required String detail,
  }) =>
      Card(
        key: key,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: AppTheme.primary),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTheme.font(
                        size: 12,
                        weight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      detail,
                      style: AppTheme.font(
                        size: 10.5,
                        color: AppTheme.textSecondary,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
}
