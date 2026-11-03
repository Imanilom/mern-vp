import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/app_state.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/hil_time.dart';
import '../profile/wearable_pairing_screen.dart';

class HilLiveWindow {
  const HilLiveWindow({
    required this.maxHr,
    required this.sampleCount,
  });

  final double? maxHr;
  final int sampleCount;
}

class HilLiveAnalysis {
  static double? averageHeartRate(List<Map<String, dynamic>> readings) {
    final values = readings
        .where(_hasAcceptableSignal)
        .map((reading) {
          final value = reading['heart_rate_bpm'];
          return value is num ? value : null;
        })
        .whereType<num>()
        .where((value) => value.isFinite && value >= 20 && value <= 250)
        .toList();
    if (values.isEmpty) return null;
    return values.reduce((total, value) => total + value) / values.length;
  }

  static double? maximumHeartRate(List<Map<String, dynamic>> readings) {
    final values = readings
        .where(_hasAcceptableSignal)
        .map((reading) {
          final value = reading['heart_rate_bpm'];
          return value is num ? value : null;
        })
        .whereType<num>()
        .where((value) => value.isFinite && value >= 20 && value <= 250)
        .toList();
    return values.isEmpty
        ? null
        : values
            .reduce((current, value) => math.max(current, value))
            .toDouble();
  }

  static bool _hasAcceptableSignal(Map<String, dynamic> reading) {
    final confidence = reading['signal_confidence'];
    return reading['sensor_contact'] == true &&
        confidence is num &&
        confidence.isFinite &&
        confidence >= 0.6;
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
          if (hr is! num ||
              !hr.isFinite ||
              timestamp == null ||
              hr < 20 ||
              hr > 250) {
            return null;
          }
          if (!_hasAcceptableSignal(reading)) return null;
          return hr.toDouble();
        })
        .whereType<double>()
        .toList();
    if (valid.isEmpty) {
      return const HilLiveWindow(
        maxHr: null,
        sampleCount: 0,
      );
    }

    final maxHr = valid.reduce((current, value) => math.max(current, value));

    return HilLiveWindow(
      maxHr: maxHr,
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
}

class HilLiveHrLineChart extends StatelessWidget {
  const HilLiveHrLineChart({
    required this.readings,
    required this.personalBaseline,
    required this.activityAverage,
    this.chartKey = const Key('hil-live-hr-line-chart'),
    super.key,
  });

  final List<double> readings;
  final double? personalBaseline;
  final double? activityAverage;
  final Key chartKey;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 190,
        width: double.infinity,
        child: CustomPaint(
          key: chartKey,
          painter: _HilLiveHrChartPainter(
            readings: readings,
            personalBaseline: personalBaseline,
            activityAverage: activityAverage,
            textColor: Theme.of(context).colorScheme.onSurfaceVariant,
            gridColor: Theme.of(context).dividerColor,
            lineColor: Theme.of(context).colorScheme.primary,
          ),
        ),
      );
}

class _HilLiveHrChartPainter extends CustomPainter {
  const _HilLiveHrChartPainter({
    required this.readings,
    required this.personalBaseline,
    required this.activityAverage,
    required this.textColor,
    required this.gridColor,
    required this.lineColor,
  });

  final List<double> readings;
  final double? personalBaseline;
  final double? activityAverage;
  final Color textColor;
  final Color gridColor;
  final Color lineColor;

  @override
  void paint(Canvas canvas, Size size) {
    const left = 38.0;
    const right = 8.0;
    const top = 10.0;
    const bottom = 22.0;
    final plot = Rect.fromLTRB(
      left,
      top,
      size.width - right,
      size.height - bottom,
    );
    final candidates = [
      ...readings,
      if (personalBaseline != null) personalBaseline!,
      if (activityAverage != null) activityAverage!,
    ];
    if (candidates.isEmpty) {
      _drawLabel(canvas, 'Menunggu bacaan HR', Offset(left, size.height / 2),
          11, textColor);
      return;
    }

    final minimum = (candidates.reduce(math.min) - 5).floorToDouble();
    final maximum = (candidates.reduce(math.max) + 5).ceilToDouble();
    final range = math.max(maximum - minimum, 1);
    final gridPaint = Paint()
      ..color = gridColor.withValues(alpha: 0.6)
      ..strokeWidth = 0.7;
    for (var index = 0; index <= 4; index++) {
      final y = plot.top + plot.height * index / 4;
      canvas.drawLine(Offset(plot.left, y), Offset(plot.right, y), gridPaint);
      final value = maximum - range * index / 4;
      _drawLabel(
          canvas, value.toStringAsFixed(0), Offset(0, y - 6), 9, textColor);
    }

    void drawReference(double value, Color color, String label) {
      final y = plot.bottom - (value - minimum) / range * plot.height;
      final paint = Paint()
        ..color = color
        ..strokeWidth = 1.4;
      const dashWidth = 5.0;
      const gap = 4.0;
      var x = plot.left;
      while (x < plot.right) {
        canvas.drawLine(
          Offset(x, y),
          Offset(math.min(x + dashWidth, plot.right), y),
          paint,
        );
        x += dashWidth + gap;
      }
      _drawLabel(canvas, label, Offset(plot.left + 4, y - 12), 8, color);
    }

    if (personalBaseline != null) {
      drawReference(personalBaseline!, Colors.blueGrey, 'Baseline');
    }
    if (activityAverage != null) {
      drawReference(activityAverage!, Colors.teal, 'Rerata aktivitas');
    }

    if (readings.isEmpty) return;
    final path = Path();
    for (var index = 0; index < readings.length; index++) {
      final x = readings.length == 1
          ? plot.center.dx
          : plot.left + plot.width * index / (readings.length - 1);
      final y = plot.bottom - (readings[index] - minimum) / range * plot.height;
      if (index == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = lineColor
        ..strokeWidth = 2.5
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    final peak = readings.reduce(math.max);
    final peakIndex = readings.indexOf(peak);
    final peakX = readings.length == 1
        ? plot.center.dx
        : plot.left + plot.width * peakIndex / (readings.length - 1);
    final peakY = plot.bottom - (peak - minimum) / range * plot.height;
    canvas.drawCircle(
      Offset(peakX, peakY),
      4,
      Paint()..color = lineColor,
    );
    _drawLabel(canvas, 'Sekarang', Offset(plot.right - 42, plot.bottom + 5), 8,
        textColor);
  }

  void _drawLabel(
    Canvas canvas,
    String text,
    Offset offset,
    double fontSize,
    Color color,
  ) {
    final painter = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          color: color,
          fontSize: fontSize,
          fontWeight: FontWeight.w500,
        ),
      ),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout();
    painter.paint(canvas, offset);
  }

  @override
  bool shouldRepaint(covariant _HilLiveHrChartPainter oldDelegate) =>
      oldDelegate.readings != readings ||
      oldDelegate.personalBaseline != personalBaseline ||
      oldDelegate.activityAverage != activityAverage ||
      oldDelegate.textColor != textColor ||
      oldDelegate.gridColor != gridColor ||
      oldDelegate.lineColor != lineColor;
}

class _PudalStage extends StatelessWidget {
  const _PudalStage({
    required this.title,
    required this.detail,
    required this.icon,
  });

  final String title;
  final String detail;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 8),
            Expanded(
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: '$title · ',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    TextSpan(text: detail),
                  ],
                ),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
        ),
      );
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
  late final String _runId =
      'hil-live-${DateTime.now().toUtc().microsecondsSinceEpoch}';
  String? _sessionId;

  static const _activityOptions = <(String, String, String)>[
    ('sitting', 'Duduk', 'chair'),
    ('standing', 'Berdiri', 'accessibility_new'),
    ('walking', 'Berjalan', 'directions_walk'),
  ];

  String _activity = 'sitting';
  String _testMode = 'direct';
  String _latestStatus = 'Mulai pemantauan untuk mengevaluasi HR per detik.';
  String? _latestDetail;
  String? _recoveryLabel;
  double? _latestMaxHr;
  double? _latestDfaAlpha1;
  int? _latestDfaRrCount;
  String? _latestDfaComparison;
  int _elapsedSeconds = 0;
  int _simulationStep = 0;
  final List<double> _simulatedHrHistory = [];
  bool _isMonitoring = false;
  bool _isStartingMonitoring = false;
  bool _isSimulation = false;
  bool _isStoppingMonitoring = false;
  bool _ownsStream = false;
  bool _isPromptVisible = false;
  bool _promptedForCurrentEpisode = false;
  bool _hadElevatedHr = false;
  bool _isRecordingActivityRepeat = false;
  DateTime? _peakDeviationObservedAt;
  DateTime? _recoveryObservedAt;
  DateTime? _activityRepeatStartedAt;
  DateTime? _lastActivityRepeatReadingAt;
  String? _reportedPreviousActivity;
  String? _reportedAdditionalContext;
  double? _activityContextAverageHr;
  bool _isSavingClarification = false;
  bool _isGeneratingInsight = false;
  int _backendEvaluationGeneration = 0;
  String? _zeroShotInsight;
  String? _zeroShotInsightError;
  Timer? _timer;
  DateTime? _lastReadingAt;
  DateTime? _dfaBatchStartedAt;
  double? _previousWindowMaxHr;
  late final AppState _appState;
  late final List<Map<String, dynamic>> _dfaReadings;
  final List<double> _hrObservationMaxima = [];
  final List<Map<String, dynamic>> _sessionEvents = [];
  final List<Map<String, dynamic>> _activityRepeatReadings = [];

  static const _activityRepeatDuration = Duration(seconds: 30);
  static const _minimumActivityRepeatSamples = 10;

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
    if (_sessionId != null) unawaited(_completeRun());
    if (_ownsStream && _appState.wearableBridge.isStreaming) {
      unawaited(_appState.wearableBridge.stopStreaming());
    }
    super.dispose();
  }

  Future<void> _completeRun() async {
    if (_isMonitoring && !_isSimulation && !_isStoppingMonitoring) {
      if (_isRecordingActivityRepeat) {
        await _saveHilEvent(
          eventName: 'activity_repeat_insufficient',
          details:
              'Rekaman ulang terhenti sebelum selesai saat halaman ditutup.',
          value: {
            'ctx': _activity,
            'answer': _reportedPreviousActivity ?? '',
            'samples': _activityRepeatReadings.length,
          },
        );
      }
      await _saveHilEvent(
        eventName: 'live_recording_stopped',
        details: 'Pemantauan dihentikan ketika halaman ditutup.',
        value: {'ctx': _activity, 'mode': _testMode},
      );
    }
    final response = await ApiService.completeHilSession(_runId);
    if (!response.success) {
      debugPrint('[HIL] Gagal menutup sesi $_runId: ${response.message}');
    }
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

  String _activityLabel(String activity) => switch (activity) {
        'sitting' => 'Duduk',
        'standing' => 'Berdiri',
        'walking' => 'Berjalan',
        _ => activity,
      };

  String _liveEventLabel(String eventName) => switch (eventName) {
        'live_recording_started' => 'Rekaman dimulai',
        'live_recording_stopped' => 'Rekaman dihentikan',
        'live_recording_interrupted' => 'Rekaman terputus',
        'activity_selected' => 'Aktivitas dipilih',
        'activity_clarification_requested' => 'Sistem mengirim pertanyaan',
        'activity_clarification_answered' => 'Jawaban pengguna diterima',
        'activity_context_sufficient' => 'Konteks dinilai cukup',
        'activity_repeat_skipped' => 'Aktivitas tidak diulang',
        'activity_repeat_selected' => 'Pengguna memilih mengulang aktivitas',
        'activity_repeat_started' => 'Rekaman ulang dimulai',
        'activity_repeat_completed' => 'Rerata aktivitas sesi tersedia',
        'activity_repeat_insufficient' => 'Rekaman ulang belum cukup',
        'activity_repeat_unavailable' => 'Rekaman ulang belum tersedia',
        'hr_recovery_observed' => 'Denyut mendekati kisaran biasa',
        'dfa_5_minute_batch' => 'Ringkasan pola detak selesai',
        _ => eventName.replaceAll('_', ' '),
      };

  Future<void> _selectActivity(String activity) async {
    if (activity == _activity) return;
    setState(() {
      _activity = activity;
      _resetTestObservations();
    });
    if (!_isSimulation) {
      await _saveHilEvent(
        eventName: 'activity_selected',
        details:
            'Pengguna memilih konteks aktivitas ${_activityLabel(activity)}.',
        value: {'ctx': activity, 'mode': _testMode},
      );
    }
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

  double get _hrElevationThreshold {
    final standardDeviation = _baselineStats['mean_hr_std'];
    return math.max(10, (standardDeviation is num ? standardDeviation : 0) * 2);
  }

  void _resetTestObservations() {
    _hrObservationMaxima.clear();
    _activityRepeatReadings.clear();
    _activityRepeatStartedAt = null;
    _lastActivityRepeatReadingAt = null;
    _reportedPreviousActivity = null;
    _reportedAdditionalContext = null;
    _activityContextAverageHr = null;
    _isRecordingActivityRepeat = false;
    _zeroShotInsight = null;
    _zeroShotInsightError = null;
    _peakDeviationObservedAt = null;
    _recoveryObservedAt = null;
    _promptedForCurrentEpisode = false;
  }

  void _recordHrObservation(double maxHr) {
    _hrObservationMaxima.add(maxHr);
    if (_hrObservationMaxima.length > 60) {
      _hrObservationMaxima.removeAt(0);
    }
  }

  Future<void> _generateZeroShotInsight() async {
    if (_isGeneratingInsight ||
        _isSimulation ||
        _hrObservationMaxima.isEmpty ||
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
    final observations = _hrObservationMaxima;
    final recent = observations.length > 12
        ? observations.sublist(observations.length - 12)
        : observations;
    final evidence = <Map<String, dynamic>>[
      {
        'source': 'personal_baseline',
        'facts': 'Baseline aktivitas $_activity berstatus $baselineStatus.',
        'status': baselineStatus,
      },
      ...recent.map(
        (value) => <String, dynamic>{
          'source': 'capar_summary',
          'facts': 'HR maksimum per detik pada tes HIL, aktivitas $_activity.',
          'metric': 'max_hr',
          'value': value,
          'unit': 'bpm',
          'status': 'observed',
        },
      ),
    ];
    final summary = [
      'Tes Human-in-the-Loop: aktivitas $_activity, mode $_testMode.',
      'Status kematangan baseline: $baselineStatus.',
      'HR maksimum per detik (12 bacaan terakhir): '
          '${recent.map((value) => '${value.toStringAsFixed(1)} bpm').join('; ')}.',
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
    if (!mounted || !_isMonitoring || _isStoppingMonitoring) return;
    final bridge = _appState.wearableBridge;
    if (!bridge.isStreaming) {
      _isStoppingMonitoring = true;
      final repeatWasInterrupted = _isRecordingActivityRepeat;
      setState(() {
        _isMonitoring = false;
        _isRecordingActivityRepeat = false;
        _ownsStream = false;
        _latestStatus = 'Streaming wearable terputus; evaluasi dihentikan.';
        _latestDetail =
            bridge.error ?? 'Sambungkan kembali sensor untuk melanjutkan.';
      });
      _timer?.cancel();
      _timer = null;
      unawaited(_saveHilEvent(
        eventName: 'live_recording_interrupted',
        details: 'Perekaman berhenti karena koneksi Polar H10 terputus.',
        value: {'ctx': _activity},
      ).whenComplete(() => _isStoppingMonitoring = false));
      if (repeatWasInterrupted) {
        unawaited(_saveHilEvent(
          eventName: 'activity_repeat_insufficient',
          details: 'Rekaman ulang terhenti karena koneksi sensor terputus.',
          value: {
            'ctx': _activity,
            'answer': _reportedPreviousActivity ?? '',
            'samples': _activityRepeatReadings.length,
          },
        ));
      }
      return;
    }
    _collectDfaReadings();
  }

  Future<void> _startMonitoring() async {
    if (_isStoppingMonitoring || _isStartingMonitoring || _isMonitoring) return;
    setState(() => _isStartingMonitoring = true);
    final bridge = _appState.wearableBridge;
    if (bridge.isDemoDevice) {
      setState(() {
        _isStartingMonitoring = false;
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
      if (!mounted) {
        _isStartingMonitoring = false;
        return;
      }
    }
    if (!bridge.isStreaming || bridge.isDemoDevice) {
      setState(() {
        _isStartingMonitoring = false;
        _latestStatus = bridge.isDemoDevice
            ? 'Monitor HIL hanya menerima data sensor nyata.'
            : 'Streaming sensor belum aktif.';
        _latestDetail = bridge.error ??
            'Pastikan Polar H10 tersambung dan aliran HR/RR serta akselerometer tersedia.';
      });
      return;
    }
    _ownsStream = startStreamHere;
    _isStoppingMonitoring = false;
    await _startTimer();
    if (mounted) {
      setState(() => _isStartingMonitoring = false);
    } else {
      _isStartingMonitoring = false;
    }
  }

  void _startSimulation() {
    if (_isMonitoring || _isStartingMonitoring) return;
    _isSimulation = true;
    _ownsStream = false;
    _simulationStep = 0;
    _simulatedHrHistory.clear();
    _elapsedSeconds = 0;
    _resetTestObservations();
    _dfaReadings.clear();
    _promptedForCurrentEpisode = false;
    _hadElevatedHr = false;
    _previousWindowMaxHr = null;
    _recoveryLabel = null;
    _isMonitoring = true;
    setState(() {
      _latestStatus = 'Simulasi dimulai · HR tinggi sejak awal.';
      _latestDetail =
          'HR sintetis akan menurun bertahap. Data ini hanya untuk uji UI dan tidak disimpan.';
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
    final window = HilLiveWindow(
      maxHr: targetHr,
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
            'HR maksimum terakhir pada simulasi ${targetHr.toStringAsFixed(1)} bpm. Rekaman sensor atau event server tidak dibuat.';
      });
    }
  }

  Future<void> _startTimer() async {
    _isSimulation = false;
    final bridge = _appState.wearableBridge;
    if (_isMonitoring || !bridge.isStreaming || bridge.isDemoDevice) return;
    final session = await ApiService.createHilSession({
      'run_id': _runId,
      'scenario': 'C',
      'source': 'realtime_wearable',
      'activity': _activity,
    });
    if (!mounted) {
      if (session.success) await ApiService.completeHilSession(_runId);
      return;
    }
    if (!session.success || session.data == null) {
      _showSaveError(session.message ?? 'Sesi HIL realtime gagal dimulai.');
      return;
    }
    _sessionId = session.data!['_id']?.toString();
    if (_sessionId == null) {
      _showSaveError('ID sesi HIL realtime tidak diterima dari server.');
      await ApiService.completeHilSession(_runId);
      return;
    }
    _isMonitoring = true;
    unawaited(_saveHilEvent(
      eventName: 'live_recording_started',
      details: 'Pemantauan Polar H10 dimulai.',
      value: {'ctx': _activity, 'mode': _testMode},
    ));
    _elapsedSeconds = 0;
    _resetTestObservations();
    _dfaBatchStartedAt = DateTime.now();
    _lastReadingAt = null;
    _dfaReadings.clear();
    _promptedForCurrentEpisode = false;
    _hadElevatedHr = false;
    _previousWindowMaxHr = null;
    _recoveryLabel = null;
    _collectDfaReadings();
    _evaluateHrWindow();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || !_isMonitoring) return;
      _elapsedSeconds++;
      _collectDfaReadings();
      _collectActivityRepeatReadings();
      if (_isRecordingActivityRepeat &&
          _activityRepeatStartedAt != null &&
          DateTime.now().toUtc().difference(_activityRepeatStartedAt!) >=
              _activityRepeatDuration) {
        unawaited(_finishActivityRepeatRecording());
      }
      if (_elapsedSeconds > 0 && _elapsedSeconds % 300 == 0) {
        final previousMaxHr = _previousWindowMaxHr;
        final previousElevated = _hadElevatedHr;
        _evaluateHrWindow(submitBackend: false);
        _evaluateDfaBatch(
          previousMaxHr: previousMaxHr,
          previousElevated: previousElevated,
        );
      } else {
        _evaluateHrWindow(submitBackend: _elapsedSeconds % 30 == 0);
      }
      setState(() {});
    });
    setState(() {
      _latestStatus = 'Pemantauan HIL aktif.';
      _latestDetail =
          'HR maksimum dari bacaan per detik diperiksa berkala. Pola jarak antardetak menunggu data yang cukup selama 5 menit.';
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
    final personalBaselineHr =
        _isSimulation ? (_baselineMeanHr ?? 70) : _baselineMeanHr;
    final baselineHr = _activityContextAverageHr ?? personalBaselineHr;
    final maxHr = window.maxHr;
    if (maxHr == null || window.sampleCount == 0) {
      setState(() {
        _latestMaxHr = maxHr;
        _latestStatus = 'Belum ada bacaan HR per detik yang layak.';
        _latestDetail = 'Periksa posisi sensor dan tunggu bacaan berikutnya.';
      });
      return;
    }
    if (baselineHr == null) {
      _recordHrObservation(maxHr);
      setState(() {
        _latestMaxHr = maxHr;
        _latestStatus =
            'Catatan pembanding denyut belum tersedia untuk aktivitas ini.';
        _latestDetail = 'HR maksimum bacaan per detik: '
            '${maxHr.toStringAsFixed(1)} bpm.';
      });
      if (submitBackend && !_isSimulation) {
        unawaited(_submitHilRealtime(
          readings: recentReadings,
          previousMaxHr: _previousWindowMaxHr,
          previousElevated: _hadElevatedHr,
        ));
      }
      _previousWindowMaxHr = maxHr;
      return;
    }
    _recordHrObservation(maxHr);
    final elevated = maxHr > baselineHr + _hrElevationThreshold;
    final previousMaxHr = _previousWindowMaxHr;
    final previousElevated = _hadElevatedHr;
    final isNewDeviation = elevated && !_hadElevatedHr;
    final approachingBaseline = previousMaxHr != null &&
        maxHr < previousMaxHr &&
        (maxHr - baselineHr).abs() < (previousMaxHr - baselineHr).abs();
    final recoveredToBaseline =
        !elevated && maxHr <= baselineHr + _hrElevationThreshold;
    if (isNewDeviation) {
      _peakDeviationObservedAt = DateTime.now().toUtc();
    }
    if (elevated) _hadElevatedHr = true;

    final status = elevated
        ? 'Denyut berbeda dari pola biasanya.'
        : _hadElevatedHr && approachingBaseline
            ? maxHr <= baselineHr + _hrElevationThreshold
                ? 'Denyut kembali ke kisaran biasanya.'
                : 'Denyut bergerak mendekati kisaran biasanya.'
            : 'Denyut berada di sekitar kisaran biasanya.';
    final detail = [
      'HR maksimum pada bacaan per detik: ${maxHr.toStringAsFixed(1)} bpm.',
      if (_activityContextAverageHr != null)
        'Pembanding sesi adalah rerata rekaman ulang aktivitas '
            '(${_activityRepeatReadings.length} bacaan); baseline personal tidak diubah.',
      if (!_hasMatureBaseline) 'Catatan pembanding masih sementara.',
      if (_isSimulation) 'SIMULASI: data sintetis, bukan rekaman sensor.',
    ].join(' ');

    setState(() {
      _latestMaxHr = maxHr;
      _latestStatus = status;
      _latestDetail = detail;
      _recoveryLabel =
          !elevated && _hadElevatedHr && approachingBaseline ? status : null;
    });

    if (_hadElevatedHr && !elevated && recoveredToBaseline) {
      _recoveryObservedAt = DateTime.now().toUtc();
      _hadElevatedHr = false;
      final peakDeviationObservedAt = _peakDeviationObservedAt;
      if (!_isSimulation) {
        unawaited(_recordRecoveryEvent(
          window,
          baselineHr,
          peakDeviationObservedAt: peakDeviationObservedAt,
          recoveryObservedAt: _recoveryObservedAt,
        ));
      }
      _peakDeviationObservedAt = null;
    } else if (_isSimulation && !elevated && approachingBaseline) {
      _hadElevatedHr = false;
      _peakDeviationObservedAt = null;
    }
    if (isNewDeviation && !_promptedForCurrentEpisode) {
      _promptedForCurrentEpisode = true;
      unawaited(_requestActivityClarification(
        window,
        peakDeviationObservedAt: _peakDeviationObservedAt!,
      ));
    }
    if (submitBackend && !_isSimulation) {
      unawaited(_submitHilRealtime(
        readings: recentReadings,
        previousMaxHr: previousMaxHr,
        previousElevated: previousElevated,
      ));
    }
    _previousWindowMaxHr = maxHr;
  }

  void _evaluateDfaBatch({
    double? previousMaxHr,
    bool previousElevated = false,
  }) {
    final validRr = _dfaReadings
        .map((reading) => reading['rr_interval_ms'])
        .whereType<num>()
        .map((value) => value.toDouble())
        .where((value) => value >= 250 && value <= 3000)
        .toList();
    setState(() {
      _latestStatus = 'Ringkasan pola jarak antardetak sedang diperiksa.';
      _latestDetail =
          '${validRr.length} jarak antardetak diteruskan untuk menyusun ringkasan pola detak.';
    });
    if (!_isSimulation) {
      unawaited(_submitHilRealtime(
        readings: _lastThirtySecondsOfReadings(),
        dfaRrIntervals: validRr,
        previousMaxHr: previousMaxHr,
        previousElevated: previousElevated,
      ));
    }
    _dfaReadings.clear();
    _dfaBatchStartedAt = DateTime.now();
  }

  Future<void> _submitHilRealtime({
    required List<Map<String, dynamic>> readings,
    List<double>? dfaRrIntervals,
    double? previousMaxHr,
    required bool previousElevated,
  }) async {
    if (readings.isEmpty) {
      if (mounted) {
        setState(() {
          _latestStatus = 'Evaluasi backend belum dapat dilakukan.';
          _latestDetail = 'Belum ada bacaan HR per detik yang dapat dikirim.';
        });
      }
      return;
    }

    final requestGeneration = ++_backendEvaluationGeneration;
    if (mounted) {
      setState(() {
        _latestStatus = dfaRrIntervals == null
            ? 'Memeriksa HR maksimum per detik...'
            : 'Memeriksa ringkasan pola detak 5 menit...';
        _latestDetail = 'Hasil akan ditampilkan setelah pemeriksaan selesai.';
      });
    }
    final response = await ApiService.evaluateHilRealtime({
      'session_id': _sessionId,
      'activity': _activity,
      'device_id': _appState.wearableBridge.deviceId,
      'run_id': _runId,
      'readings': readings,
      if (dfaRrIntervals != null) 'dfa_rr_intervals_ms': dfaRrIntervals,
      if (previousMaxHr != null) 'previous_max_hr': previousMaxHr,
      if (_activityContextAverageHr != null)
        'context_activity_mean_hr': _activityContextAverageHr,
      'previous_elevated': previousElevated,
    });
    if (!mounted || requestGeneration != _backendEvaluationGeneration) return;
    if (!response.success || response.data == null) {
      setState(() {
        _latestStatus = 'Hasil pengukuran belum dapat dihitung.';
        _latestDetail = response.message ??
            'Backend tidak mengembalikan hasil evaluasi; status sebelumnya tidak diperbarui.';
      });
      return;
    }

    final result = response.data!;
    final metrics = _map(result['metrics']);
    final interpretation = _map(result['interpretation']);
    final comparisons = _map(result['comparisons']);
    final dfaComparison = _map(comparisons['dfa_alpha1']);
    final maxHr = metrics['max_hr'];
    var status = interpretation['status']?.toString() ?? 'not_assessable';
    if (_activityContextAverageHr != null && maxHr is num) {
      status = maxHr > _activityContextAverageHr! + _hrElevationThreshold
          ? 'candidate_deviation'
          : 'normal';
    }
    final dfaAlpha = metrics['dfa_alpha1'];
    final dfaCount = metrics['dfa_rr_count'];
    final dfaBase = dfaComparison['baseline_mean'];
    final dfaValue = dfaComparison['value'];
    final label = switch (status) {
      'normal' => _activityContextAverageHr == null
          ? 'Denyut berada dalam kisaran pribadi'
          : 'Denyut sesuai rerata aktivitas yang diulang',
      'candidate_deviation' => 'Deviasi HR terdeteksi',
      'recovery_trend' => 'HR bergerak mendekati kisaran biasanya',
      'recovered' => 'HR kembali ke kisaran biasanya',
      _ => 'Belum dapat dinilai',
    };
    final dfaText = dfaAlpha is num
        ? ' Ringkasan pola detak dibuat dari ${dfaCount ?? 0} jarak antardetak yang layak.'
        : dfaRrIntervals != null
            ? ' Ringkasan pola detak belum tersedia; diperlukan setidaknya 64 jarak antardetak yang layak.'
            : '';
    final baselineDescription = result['baseline'] is Map &&
            _map(result['baseline'])['level'] == 'provisional'
        ? ' Catatan pembanding masih sementara.'
        : '';

    setState(() {
      _latestStatus = label;
      _latestDetail = [
        if (maxHr is num)
          'HR maksimum per detik: ${maxHr.toStringAsFixed(1)} bpm.',
        if (_activityContextAverageHr != null)
          'Dibandingkan dengan rerata rekaman ulang aktivitas '
              '${_activityContextAverageHr!.toStringAsFixed(1)} bpm; '
              'baseline personal CAPAR tetap.',
        baselineDescription,
        dfaText,
      ].where((part) => part.isNotEmpty).join(' ');
      if (maxHr is num) _latestMaxHr = maxHr.toDouble();
      if (dfaAlpha is num) {
        _latestDfaAlpha1 = dfaAlpha.toDouble();
        _latestDfaRrCount = dfaCount is num ? dfaCount.toInt() : 0;
        _latestDfaComparison = dfaBase is num && dfaValue is num
            ? (dfaValue - dfaBase).abs() < 0.1
                ? 'Pola jeda antardetak mirip dengan catatan pribadi sebelumnya.'
                : 'Pola jeda antardetak berbeda dari catatan pribadi sebelumnya.'
            : 'Belum ada catatan pribadi untuk membandingkan pola jeda antardetak.';
      } else if (dfaRrIntervals != null) {
        _latestDfaAlpha1 = null;
        _latestDfaRrCount = dfaCount is num ? dfaCount.toInt() : 0;
        _latestDfaComparison =
            'Ringkasan pola jeda antardetak belum dapat dibuat karena bacaan belum cukup atau mutunya kurang.';
      }
      if (status == 'candidate_deviation') _hadElevatedHr = true;
      if (status == 'recovered') _hadElevatedHr = false;
      _recoveryLabel = interpretation['is_recovery'] == true ? label : null;
    });
    if (dfaAlpha is num && dfaRrIntervals != null) {
      unawaited(_recordDfaEvent(
        dfaAlpha.toDouble(),
        dfaCount is num ? dfaCount.toInt() : 0,
      ));
    }
  }

  Future<void> _requestActivityClarification(
    HilLiveWindow window, {
    required DateTime peakDeviationObservedAt,
  }) async {
    if (!mounted || _isPromptVisible) return;
    _isPromptVisible = true;
    final contextController = TextEditingController();
    final otherController = TextEditingController();
    if (!_isSimulation) {
      await _saveHilEvent(
        eventName: 'activity_clarification_requested',
        details: 'Sistem menanyakan aktivitas atau konteks sebelum deviasi.',
        value: {
          'mode': _testMode,
          'ctx': _activity,
          'hr_max': window.maxHr,
          'peak_detected_at': peakDeviationObservedAt.toIso8601String(),
        },
      );
      if (!mounted) {
        contextController.dispose();
        otherController.dispose();
        return;
      }
    }
    final answer = await showDialog<({String context, String? other})>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Ada aktivitas atau konteks sebelumnya?'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'HR maksimum yang terdeteksi: '
                '${window.maxHr?.toStringAsFixed(0) ?? '-'} bpm. '
                'Apa yang Anda lakukan sebelum perubahan ini?',
              ),
              const SizedBox(height: 12),
              TextField(
                controller: contextController,
                maxLength: 60,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Aktivitas atau konteks sebelumnya',
                ),
              ),
              TextField(
                controller: otherController,
                maxLength: 60,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Hal lain (opsional)',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(
              dialogContext,
              (context: 'Tidak ingat / tidak yakin', other: null),
            ),
            child: const Text('Tidak ingat'),
          ),
          FilledButton(
            onPressed: () {
              final answerContext = contextController.text.trim();
              final other = otherController.text.trim();
              if (answerContext.isEmpty && other.isEmpty) return;
              Navigator.pop(
                dialogContext,
                (
                  context: answerContext,
                  other: other.isEmpty ? null : other,
                ),
              );
            },
            child: const Text('Kirim'),
          ),
        ],
      ),
    );
    _isPromptVisible = false;
    contextController.dispose();
    otherController.dispose();
    if (answer == null || !mounted) return;
    _reportedPreviousActivity = answer.context;
    _reportedAdditionalContext = answer.other;
    if (_isSimulation) {
      setState(() {
        _latestStatus = 'Jawaban simulasi tercatat di layar.';
        _latestDetail = 'Konteks: ${answer.context}. '
            '${answer.other == null ? '' : 'Hal lain: ${answer.other}. '}'
            'Tidak dikirim atau disimpan sebagai event pasien.';
      });
      await _showActivityActionDialog();
      return;
    }
    setState(() => _isSavingClarification = true);
    final saved = await _saveHilEvent(
      eventName: 'activity_clarification_answered',
      details: 'Jawaban pengguna tentang konteks sebelum deviasi HR.',
      value: {
        'ctx': _activity,
        'answer': answer.context,
        if (answer.other != null) 'other': answer.other,
      },
    );
    if (!mounted) return;
    setState(() => _isSavingClarification = false);
    if (!saved) {
      _showSaveError('Klarifikasi live gagal disimpan.');
      return;
    }
    await _showActivityActionDialog();
  }

  Future<void> _showActivityActionDialog() async {
    final canRepeatActivity =
        _reportedPreviousActivity?.trim().isNotEmpty == true &&
            _reportedPreviousActivity != 'Tidak ingat / tidak yakin';
    final action = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Keputusan dan aksi'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Aktivitas/konteks: ${_reportedPreviousActivity ?? 'tidak diisi'}',
            ),
            const SizedBox(height: 8),
            const Text(
              'Jika aktivitas sebelumnya dapat diulang dengan aman, rekam ulang selama 30 detik. Rerata bacaan berkualitas menjadi pembanding untuk sesi ini saja; baseline personal tidak diubah.',
            ),
          ],
        ),
        actions: [
          TextButton(
            key: const Key('hil-live-activity-action-skip'),
            onPressed: () => Navigator.pop(dialogContext, 'not_repeated'),
            child: const Text('Tidak diulang'),
          ),
          OutlinedButton(
            key: const Key('hil-live-activity-action-sufficient'),
            onPressed: () => Navigator.pop(dialogContext, 'sufficient'),
            child: const Text('Cukup'),
          ),
          FilledButton(
            key: const Key('hil-live-activity-action-repeat'),
            onPressed: canRepeatActivity
                ? () => Navigator.pop(dialogContext, 'repeat')
                : null,
            child: const Text('Ulangi aktivitas (jika aman)'),
          ),
        ],
      ),
    );
    if (!mounted || action == null) return;
    if (_isSimulation) {
      setState(() {
        _latestStatus = switch (action) {
          'sufficient' => 'Konteks dinilai cukup oleh pengguna.',
          'not_repeated' => 'Aktivitas tidak diulang.',
          _ => 'Rekaman ulang membutuhkan sensor live.',
        };
        _latestDetail = action == 'repeat'
            ? 'Mode simulasi tidak merekam aktivitas atau membuat rerata fisiologis.'
            : 'Deviasi awal tetap tercatat sebagai observasi; jawaban konteks tidak mengubah baseline personal.';
      });
      return;
    }

    final eventName = switch (action) {
      'sufficient' => 'activity_context_sufficient',
      'not_repeated' => 'activity_repeat_skipped',
      _ => 'activity_repeat_selected',
    };
    final saved = await _saveHilEvent(
      eventName: eventName,
      details: switch (action) {
        'sufficient' => 'Pengguna menyatakan konteks aktivitas sudah cukup.',
        'not_repeated' => 'Pengguna memilih untuk tidak mengulang aktivitas.',
        _ => 'Pengguna memilih untuk mengulang aktivitas.',
      },
      value: {
        'ctx': _activity,
        'action': action,
        'answer': _reportedPreviousActivity ?? '',
        if (_reportedAdditionalContext != null)
          'other': _reportedAdditionalContext,
      },
    );
    if (!saved || !mounted) return;
    switch (action) {
      case 'sufficient':
        setState(() {
          _latestStatus = 'Konteks dinilai cukup oleh pengguna.';
          _latestDetail =
              'Deviasi awal tetap tercatat sebagai observasi; jawaban konteks tidak mengubah baseline personal.';
        });
        break;
      case 'not_repeated':
        setState(() {
          _latestStatus = 'Aktivitas tidak diulang.';
          _latestDetail =
              'Deviasi awal tetap tercatat sebagai observasi karena tidak ada pengukuran ulang.';
        });
        break;
      case 'repeat':
        _startActivityRepeatRecording();
        break;
    }
  }

  void _startActivityRepeatRecording() {
    final previousActivity = _reportedPreviousActivity?.trim();
    if (previousActivity == null ||
        previousActivity.isEmpty ||
        previousActivity == 'Tidak ingat / tidak yakin') {
      setState(() {
        _latestStatus = 'Aktivitas tidak dapat direkam ulang.';
        _latestDetail =
            'Isi aktivitas sebelumnya terlebih dahulu. Jika tidak ingat, pilih “Cukup” atau “Tidak diulang”.';
      });
      return;
    }
    if (!_isMonitoring ||
        _isSimulation ||
        !_appState.wearableBridge.isStreaming) {
      setState(() {
        _latestStatus = 'Rekaman ulang belum dimulai.';
        _latestDetail =
            'Sambungkan sensor Polar H10 nyata dan mulai pemantauan live sebelum mengulang aktivitas.';
      });
      if (!_isSimulation) {
        unawaited(_saveHilEvent(
          eventName: 'activity_repeat_unavailable',
          details:
              'Rekaman ulang belum dimulai karena sensor live tidak aktif.',
          value: {
            'ctx': _activity,
            'answer': _reportedPreviousActivity ?? '',
            if (_reportedAdditionalContext != null)
              'other': _reportedAdditionalContext,
          },
        ));
      }
      return;
    }
    _activityRepeatReadings.clear();
    _activityRepeatStartedAt = DateTime.now().toUtc();
    _lastActivityRepeatReadingAt = null;
    setState(() {
      _isRecordingActivityRepeat = true;
      _activityContextAverageHr = null;
      _latestStatus = 'Rekaman ulang aktivitas dimulai.';
      _latestDetail =
          'Lakukan kembali aktivitas yang dilaporkan dengan aman. Pengukuran berlangsung 30 detik.';
    });
    unawaited(_saveHilEvent(
      eventName: 'activity_repeat_started',
      details: 'Rekaman ulang aktivitas dimulai selama 30 detik.',
      value: {
        'ctx': _activity,
        'answer': _reportedPreviousActivity ?? '',
        if (_reportedAdditionalContext != null)
          'other': _reportedAdditionalContext,
      },
    ));
  }

  void _collectActivityRepeatReadings() {
    if (!_isRecordingActivityRepeat) return;
    final startedAt = _activityRepeatStartedAt;
    if (startedAt == null) return;
    for (final reading in _appState.wearableBridge.recentStreamReadings) {
      final recordedAt = DateTime.tryParse(
        reading['recorded_at']?.toString() ?? '',
      )?.toUtc();
      if (recordedAt == null ||
          recordedAt.isBefore(startedAt) ||
          (_lastActivityRepeatReadingAt != null &&
              !recordedAt.isAfter(_lastActivityRepeatReadingAt!))) {
        continue;
      }
      _lastActivityRepeatReadingAt = recordedAt;
      if (HilLiveAnalysis.averageHeartRate([reading]) != null) {
        _activityRepeatReadings.add(reading);
      }
    }
    if (mounted) setState(() {});
  }

  Future<void> _finishActivityRepeatRecording() async {
    if (!_isRecordingActivityRepeat) return;
    _backendEvaluationGeneration++;
    final averageHr = HilLiveAnalysis.averageHeartRate(_activityRepeatReadings);
    final sampleCount = _activityRepeatReadings.length;
    setState(() {
      _isRecordingActivityRepeat = false;
      _activityContextAverageHr =
          sampleCount >= _minimumActivityRepeatSamples ? averageHr : null;
      if (_activityContextAverageHr == null) {
        _latestStatus = 'Rekaman ulang belum cukup untuk dihitung.';
        _latestDetail =
            '$sampleCount bacaan berkualitas terkumpul; diperlukan minimal $_minimumActivityRepeatSamples. Deviasi awal tetap dipertahankan.';
      } else {
        _hadElevatedHr = false;
        _promptedForCurrentEpisode = true;
        _latestStatus = 'Rerata konteks aktivitas sesi tersedia.';
        _latestDetail =
            '${_activityContextAverageHr!.toStringAsFixed(1)} bpm dari $sampleCount bacaan berkualitas. Pembanding sementara ini hanya untuk sesi ini dan tidak mengubah baseline personal.';
      }
    });
    await _saveHilEvent(
      eventName: _activityContextAverageHr == null
          ? 'activity_repeat_insufficient'
          : 'activity_repeat_completed',
      details: _activityContextAverageHr == null
          ? 'Rekaman ulang tidak memiliki cukup bacaan berkualitas.'
          : 'Rerata HR rekaman ulang aktivitas dihitung untuk sesi ini.',
      value: {
        'ctx': _activity,
        'answer': _reportedPreviousActivity ?? '',
        'samples': sampleCount,
        if (_reportedAdditionalContext != null)
          'other': _reportedAdditionalContext,
        if (_activityContextAverageHr != null)
          'hr_mean': _activityContextAverageHr,
      },
    );
    if (_activityContextAverageHr != null) {
      _evaluateHrWindow(submitBackend: false);
    }
  }

  Future<void> _recordRecoveryEvent(
    HilLiveWindow window,
    double baselineHr, {
    required DateTime? peakDeviationObservedAt,
    required DateTime? recoveryObservedAt,
  }) async {
    if (_isSimulation) return;
    await _saveHilEvent(
      eventName: 'hr_recovery_observed',
      details: 'HR menurun menuju atau kembali ke rentang baseline.',
      value: {
        'mode': _testMode,
        'ctx': _activity,
        'hr_max': window.maxHr,
        'base': baselineHr,
        'label': _recoveryLabel,
        if (peakDeviationObservedAt != null)
          'peak_detected_at': peakDeviationObservedAt.toIso8601String(),
        if (recoveryObservedAt != null)
          'recovery_detected_at': recoveryObservedAt.toIso8601String(),
      },
    );
  }

  Future<void> _recordDfaEvent(double alpha1, int rrCount) async {
    await _saveHilEvent(
      eventName: 'dfa_5_minute_batch',
      details: 'Ringkasan pola jarak antardetak 5 menit selesai.',
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
    if (_sessionId == null) return false;
    final occurredAt = DateTime.now().toUtc();
    final eventDetails =
        '$details ${jsonEncode({...value, 'session_id': _sessionId})}';
    if (eventDetails.length > 300) {
      _showSaveError(
        'Event HIL tidak disimpan: detail melebihi batas 300 karakter.',
      );
      return false;
    }
    final response = await ApiService.createEvent({
      'event_type': 'hil_scenario',
      'run_id': _runId,
      'occurred_at': occurredAt.toIso8601String(),
      'details': eventDetails,
      'value': eventName,
      if (intensity != null) 'intensity': intensity,
      'unit': 'hil_live_monitor',
    });
    if (!response.success && mounted) {
      _showSaveError(response.message ?? 'Event HIL gagal disimpan.');
    }
    if (response.success && mounted) {
      setState(() {
        _sessionEvents.add({
          'event_name': eventName,
          'details': details,
          'occurred_at': occurredAt.toIso8601String(),
          'activity': _activity,
          if (value['hr_max'] is num) 'heart_rate_bpm': value['hr_max'],
          if (value['answer'] is String) 'answer': value['answer'],
          if (value['other'] is String) 'other': value['other'],
        });
      });
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
    if (!_isMonitoring || _isStoppingMonitoring) return;
    _isStoppingMonitoring = true;
    _timer?.cancel();
    _timer = null;
    final wasSimulation = _isSimulation;
    final repeatWasStopped = _isRecordingActivityRepeat;
    setState(() {
      _isMonitoring = false;
      _isSimulation = false;
      _isRecordingActivityRepeat = false;
      _latestStatus = 'Pemantauan HIL dihentikan.';
    });
    if (!wasSimulation) {
      await _saveHilEvent(
        eventName: 'live_recording_stopped',
        details: 'Pemantauan dihentikan oleh pengguna.',
        value: {'ctx': _activity, 'mode': _testMode},
      );
    }
    if (repeatWasStopped && !wasSimulation) {
      await _saveHilEvent(
        eventName: 'activity_repeat_insufficient',
        details: 'Rekaman ulang dihentikan sebelum selesai.',
        value: {
          'ctx': _activity,
          'answer': _reportedPreviousActivity ?? '',
          'samples': _activityRepeatReadings.length,
        },
      );
    }
    if (_ownsStream && _appState.wearableBridge.isStreaming) {
      await _appState.wearableBridge.stopStreaming();
    }
    _ownsStream = false;
    _isStoppingMonitoring = false;
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
            title: 'Pemantauan langsung',
            detail:
                'Bacaan HR diperiksa per detik. Saat ada deviasi, HR maksimum ditampilkan dan konteks sebelumnya ditanyakan. Hasil ini bukan diagnosis.',
          ),
          const SizedBox(height: 8),
          _pudalGuideCard(),
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
          _sectionTitle('Aktivitas yang sedang dilakukan'),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final option in _activityOptions)
                ChoiceChip(
                  key: Key('hil-live-activity-${option.$1}'),
                  label: Text(option.$2),
                  selected: _activity == option.$1,
                  onSelected: _isMonitoring ||
                          _isStartingMonitoring ||
                          _isStoppingMonitoring
                      ? null
                      : (_) => unawaited(_selectActivity(option.$1)),
                ),
            ],
          ),
          const SizedBox(height: 12),
          _infoCard(
            icon: Icons.equalizer,
            title:
                'Catatan pembanding pribadi · ${_activityOptions.firstWhere((option) => option.$1 == _activity).$2}',
            detail: baselineHr == null
                ? 'Belum ada catatan denyut untuk aktivitas ini. Pemantauan tetap bisa berjalan, tetapi perubahan tidak dapat dibandingkan.'
                : 'Catatan aktivitas ini digunakan sebagai pembanding deviasi.'
                    ' ${_matchingBaselines.length} catatan'
                    '${_hasMatureBaseline ? '' : ' (masih sementara)'}.',
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  key: const Key('hil-live-start'),
                  onPressed: _isMonitoring ||
                          _isStartingMonitoring ||
                          _isStoppingMonitoring
                      ? null
                      : _startMonitoring,
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
              onPressed: _isMonitoring ||
                      _isStartingMonitoring ||
                      _isStoppingMonitoring
                  ? null
                  : _startSimulation,
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
              title: 'HR per detik · ${_activityLabel(_activity)} (simulasi)',
              detail:
                  'Perubahan HR ditampilkan sebagai grafik garis terhadap baseline personal.',
            ),
          if (_isSimulation)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: HilLiveHrLineChart(
                chartKey: const Key('hil-live-simulation-hr-chart'),
                readings: _simulatedHrHistory,
                personalBaseline: _baselineMeanHr,
                activityAverage: null,
              ),
            ),
          if (_isRecordingActivityRepeat)
            _infoCard(
              key: const Key('hil-live-activity-repeat-recording'),
              icon: Icons.fiber_manual_record,
              title: 'Rekam ulang aktivitas',
              detail:
                  'Ulangi aktivitas yang Anda laporkan dengan aman. Pengukuran 30 detik sedang berjalan; rerata bacaan berkualitas akan menjadi pembanding sesi.',
            ),
          const SizedBox(height: 12),
          _infoCard(
            key: const Key('hil-live-analysis-node-guide'),
            icon: Icons.account_tree_outlined,
            title: 'Arti tahapan analisis',
            detail:
                '1. Polar H10 mengirim bacaan HR per detik. 2. Aplikasi memeriksa kualitas sensor. 3. HR maksimum bacaan dibandingkan dengan baseline aktivitas. 4. Saat ada deviasi, aplikasi menanyakan aktivitas atau konteks sebelumnya. Jawaban pengguna dicatat sebagai laporan, bukan bukti penyebab.',
          ),
          const SizedBox(height: 8),
          _infoCard(
            icon: bridge.isStreaming ? Icons.sensors : Icons.sensors_off,
            title: bridge.isStreaming && !bridge.isDemoDevice
                ? 'Polar H10 tersambung'
                : 'Pengukuran sensor tidak aktif',
            detail: bridge.isDemoDevice
                ? 'Sensor demo terdeteksi; tidak digunakan untuk analisis live HIL.'
                : bridge.isStreaming
                    ? 'Denyut saat ini ${bridge.heartRateBpm?.toString() ?? '-'} bpm · ${bridge.recentStreamReadings.length} bacaan terbaru.'
                    : bridge.error ??
                        'Sambungkan perangkat nyata untuk memulai pengukuran.',
          ),
          const SizedBox(height: 12),
          _sectionTitle('Hasil pemantauan'),
          _perSecondReadingsCard(),
          const SizedBox(height: 8),
          _sessionTimelineCard(),
          const SizedBox(height: 8),
          _infoCard(
            key: const Key('hil-live-zero-shot-insight'),
            icon: Icons.auto_awesome_outlined,
            title: 'Ringkasan otomatis',
            detail: _zeroShotInsight != null
                ? 'Ringkasan selesai. Hasil tersedia di bawah.'
                : _zeroShotInsightError ??
                    (_isSimulation
                        ? 'Ringkasan otomatis tidak tersedia untuk data simulasi.'
                        : 'Buat ringkasan setelah tersedia bacaan nyata dan catatan pribadi untuk aktivitas ini.'),
          ),
          if (!_isSimulation)
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                key: const Key('hil-live-zero-shot-analyze'),
                onPressed: _isGeneratingInsight ||
                        _hrObservationMaxima.isEmpty ||
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
                    : 'Buat ringkasan tes'),
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
              if (_latestMaxHr != null)
                'HR maksimum: ${_latestMaxHr!.toStringAsFixed(1)} bpm.',
              if (_recoveryLabel != null) 'Status: $_recoveryLabel.',
              if (_latestDetail != null) _latestDetail!,
            ].join(' '),
          ),
          const SizedBox(height: 8),
          _infoCard(
            key: const Key('hil-live-dfa-result'),
            icon: Icons.multiline_chart,
            title: 'Pola ritme jantung · batch 5 menit',
            detail: _latestDfaAlpha1 == null
                ? 'Belum ada hasil batch. ${_latestDfaRrCount == null ? 'Nilai dihitung setelah lima menit.' : '$_latestDfaRrCount interval RR valid terkumpul; minimal 64 interval diperlukan.'}'
                : 'Pola ritme jantung ${_latestDfaAlpha1!.toStringAsFixed(3)} dari $_latestDfaRrCount interval RR valid. ${_latestDfaComparison ?? ''} Ini hanya ringkasan pola, bukan diagnosis.',
          ),
          if (_isSavingClarification)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: LinearProgressIndicator(),
            ),
          const SizedBox(height: 12),
          Text(
            'Saat deviasi terdeteksi, popup menanyakan aktivitas atau konteks sebelumnya. Jawaban adalah laporan pengguna, bukan bukti penyebab. Hasil adalah observasi, bukan diagnosis.',
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
        onSelected: _isMonitoring || _isStoppingMonitoring
            ? null
            : (_) => setState(() => _testMode = mode),
      );

  Widget _sessionTimelineCard() => Card(
        key: const Key('hil-live-session-timeline'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Ringkasan kejadian dan waktunya (WIB)',
                style: AppTheme.font(size: 12, weight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              const Text(
                'Waktu rekaman, pilihan aktivitas, pertanyaan, dan jawaban dicatat terpisah.',
                key: Key('hil-live-timeline-explanation'),
              ),
              if (_sessionEvents.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child:
                      Text('Belum ada kejadian yang tersimpan untuk sesi ini.'),
                )
              else
                ..._sessionEvents.map((event) {
                  final time = DateTime.tryParse(
                    event['occurred_at']?.toString() ?? '',
                  );
                  final timestamp = time == null
                      ? 'Waktu tidak tersedia'
                      : formatHilWibDateTime(time);
                  final details = <String>[
                    'Aktivitas: ${_activityLabel(event['activity']?.toString() ?? _activity)}',
                    if (event['heart_rate_bpm'] is num)
                      'Denyut ${(event['heart_rate_bpm'] as num).toStringAsFixed(1)} bpm',
                    if (event['answer'] is String)
                      'Konteks: ${event['answer']}',
                    if (event['other'] is String) 'Hal lain: ${event['other']}',
                    if (event['hr_mean'] is num)
                      'Rerata rekaman ulang '
                          '${(event['hr_mean'] as num).toStringAsFixed(1)} bpm',
                    event['details']?.toString() ?? '',
                  ].where((part) => part.isNotEmpty).join(' · ');
                  return ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.schedule, size: 18),
                    title: Text(
                      '${_liveEventLabel(event['event_name']?.toString() ?? '')} · $timestamp',
                    ),
                    subtitle: Text(details),
                  );
                }),
            ],
          ),
        ),
      );

  Widget _perSecondReadingsCard() {
    final readings = _appState.wearableBridge.recentStreamReadings
        .where((reading) {
          final recordedAt =
              DateTime.tryParse(reading['recorded_at']?.toString() ?? '');
          return HilLiveAnalysis._hasAcceptableSignal(reading) &&
              recordedAt != null &&
              !recordedAt.toUtc().isBefore(
                    DateTime.now()
                        .toUtc()
                        .subtract(const Duration(seconds: 30)),
                  );
        })
        .toList()
        .reversed
        .take(30)
        .toList()
        .reversed
        .toList();
    final values = readings
        .map((reading) => reading['heart_rate_bpm'])
        .whereType<num>()
        .map((value) => value.toDouble())
        .toList();
    final maximum =
        values.isEmpty ? null : values.reduce((a, b) => math.max(a, b));
    final personalBaseline = _baselineMeanHr;
    return Card(
      key: const Key('hil-live-hr-per-second'),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'HR per detik · ${_activityLabel(_activity)} · 30 bacaan terbaru',
              style: AppTheme.font(
                size: 12,
                weight: FontWeight.w700,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              maximum == null
                  ? 'Belum ada bacaan sensor yang tersedia.'
                  : 'HR maksimum: ${maximum.toStringAsFixed(1)} bpm'
                      '${personalBaseline == null ? '' : ' · baseline personal ${personalBaseline.toStringAsFixed(1)} bpm'}',
            ),
            const SizedBox(height: 8),
            HilLiveHrLineChart(
              readings: values,
              personalBaseline: personalBaseline,
              activityAverage: _activityContextAverageHr,
            ),
            if (readings.isEmpty)
              const Text('Garis HR akan muncul saat sensor aktif.')
            else
              Text(
                'Grafik garis menampilkan ${values.length} bacaan berkualitas '
                'dalam 30 detik terakhir.',
              ),
            if (_activityContextAverageHr != null)
              Text(
                'Rerata aktivitas yang diulang: '
                '${_activityContextAverageHr!.toStringAsFixed(1)} bpm '
                '(pembanding sesi saja).',
                key: const Key('hil-live-activity-repeat-average'),
              ),
            if (_isRecordingActivityRepeat)
              Text(
                'Rekaman ulang berlangsung · '
                '${_activityRepeatReadings.length} bacaan berkualitas '
                'terkumpul dari 30 detik.',
                key: const Key('hil-live-activity-repeat-progress'),
              ),
          ],
        ),
      ),
    );
  }

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

  Widget _pudalGuideCard() => Card(
        key: const Key('hil-live-pudal-guide'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Alur PUDAL · persepsi hingga aksi',
                style: AppTheme.font(size: 12, weight: FontWeight.w700),
              ),
              const SizedBox(height: 10),
              const _PudalStage(
                title: 'Persepsi',
                detail:
                    'Lihat perubahan HR pada grafik garis, HR maksimum, dan baseline personal.',
                icon: Icons.visibility_outlined,
              ),
              const _PudalStage(
                title: 'Pemahaman',
                detail:
                    'Deviasi adalah perbedaan terhadap pembanding, bukan diagnosis atau bukti penyebab.',
                icon: Icons.lightbulb_outline,
              ),
              const _PudalStage(
                title: 'Keputusan',
                detail:
                    'Isi aktivitas/konteks sebelumnya dan informasi tambahan bila ada.',
                icon: Icons.fact_check_outlined,
              ),
              const _PudalStage(
                title: 'Aksi',
                detail:
                    'Pilih ulangi aktivitas dengan aman selama 30 detik, cukup, atau tidak diulang. Rerata rekaman ulang hanya menjadi pembanding sesi dan tidak mengubah baseline personal.',
                icon: Icons.directions_walk_outlined,
              ),
            ],
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
