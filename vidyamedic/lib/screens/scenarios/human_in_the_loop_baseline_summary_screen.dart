import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

class HumanInTheLoopBaselineSummaryScreen extends StatelessWidget {
  const HumanInTheLoopBaselineSummaryScreen({
    super.key,
    required this.stageResults,
    required this.existingBaselineContexts,
  });

  static const _activities = <(String, String)>[
    ('Duduk', 'sitting'),
    ('Berdiri', 'standing'),
    ('Berjalan', 'walking'),
  ];

  static const _metricKeys = <(String, String, int)>[
    ('HR rata-rata (bpm)', 'mean_hr', 1),
    ('RR rata-rata (ms)', 'mean_rr', 1),
    ('RMSSD (ms)', 'rmssd', 1),
    ('DFA α1', 'dfa_alpha1', 3),
  ];

  final List<Map<String, dynamic>> stageResults;
  final List<Map<String, dynamic>> existingBaselineContexts;

  String _normalizeActivity(dynamic value) =>
      value?.toString().trim().toLowerCase() ?? '';

  bool _matchesActivity(dynamic value, String activity) {
    final normalized = _normalizeActivity(value);
    return switch (activity) {
      'sitting' => const {'sitting', 'duduk', 'rest'}.contains(normalized),
      'standing' => const {'standing', 'berdiri'}.contains(normalized),
      'walking' => const {'walking', 'berjalan', 'light'}.contains(normalized),
      _ => false,
    };
  }

  List<Map<String, dynamic>> _readings(Map<String, dynamic> stage) {
    final source = stage['recorded_readings'];
    if (source is! List) return const [];
    return source.whereType<Map>().map(Map<String, dynamic>.from).toList()
      ..sort((a, b) => (DateTime.tryParse(
                    a['recorded_at']?.toString() ?? '',
                  ) ??
                  DateTime.fromMillisecondsSinceEpoch(0))
              .compareTo(
            DateTime.tryParse(b['recorded_at']?.toString() ?? '') ??
                DateTime.fromMillisecondsSinceEpoch(0),
          ));
  }

  List<Map<String, dynamic>> _recordedStages() => stageResults
      .where(
        (stage) => stage['skipped'] != true && stage['incomplete'] != true,
      )
      .toList();

  double? _average(Iterable<num> values) {
    final numbers = values.map((value) => value.toDouble()).toList();
    if (numbers.isEmpty) return null;
    return numbers.reduce((a, b) => a + b) / numbers.length;
  }

  Map<String, double?> _oldBaseline(String activity) {
    final contexts = existingBaselineContexts
        .where((context) => _matchesActivity(context['activity'], activity))
        .toList();
    final featureValues = <String, List<double>>{};
    for (final context in contexts) {
      final stats = context['feature_stats'];
      if (stats is! Map) continue;
      for (final (_, key, _) in _metricKeys) {
        final feature = stats[key];
        if (feature is Map && feature['mean'] is num) {
          (featureValues[key] ??= []).add((feature['mean'] as num).toDouble());
        }
      }
    }
    return {
      for (final (_, key, _) in _metricKeys)
        key: _average(featureValues[key] ?? const <double>[]),
    };
  }

  List<double> _rrIntervals(List<Map<String, dynamic>> readings) => readings
      .map((reading) => reading['rr_interval_ms'])
      .whereType<num>()
      .map((value) => value.toDouble())
      .where((value) => value >= 300 && value <= 2000)
      .toList();

  double? _rmssd(List<double> intervals) {
    if (intervals.length < 2) return null;
    var sumSquares = 0.0;
    for (var index = 1; index < intervals.length; index++) {
      final difference = intervals[index] - intervals[index - 1];
      sumSquares += difference * difference;
    }
    return math.sqrt(sumSquares / (intervals.length - 1));
  }

  double? _dfaAlpha1(List<double> intervals) {
    if (intervals.length < 64) return null;
    final mean = _average(intervals);
    if (mean == null) return null;
    var runningSum = 0.0;
    final integrated = intervals.map((value) {
      runningSum += value - mean;
      return runningSum;
    }).toList();
    final sizes = List<int>.generate(13, (index) => index + 4);
    final fluctuations = <double>[];
    for (final size in sizes) {
      final segmentCount = integrated.length ~/ size;
      if (segmentCount == 0) return null;
      var fluctuationSum = 0.0;
      for (var segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
        final start = segmentIndex * size;
        var sumX = 0.0;
        var sumY = 0.0;
        var sumXY = 0.0;
        var sumX2 = 0.0;
        for (var index = 0; index < size; index++) {
          final x = index.toDouble();
          final y = integrated[start + index];
          sumX += x;
          sumY += y;
          sumXY += x * y;
          sumX2 += x * x;
        }
        final denominator = size * sumX2 - sumX * sumX;
        if (denominator == 0) return null;
        final slope = (size * sumXY - sumX * sumY) / denominator;
        final intercept = (sumY - slope * sumX) / size;
        var squaredDeviation = 0.0;
        for (var index = 0; index < size; index++) {
          final residual =
              integrated[start + index] - (slope * index + intercept);
          squaredDeviation += residual * residual;
        }
        fluctuationSum += math.sqrt(squaredDeviation / size);
      }
      final fluctuation = fluctuationSum / segmentCount;
      if (!fluctuation.isFinite || fluctuation <= 0) return null;
      fluctuations.add(fluctuation);
    }

    final logSizes = sizes.map(math.log).toList();
    final logFluctuations = fluctuations.map(math.log).toList();
    final count = logSizes.length.toDouble();
    final sumX = logSizes.reduce((a, b) => a + b);
    final sumY = logFluctuations.reduce((a, b) => a + b);
    var sumXY = 0.0;
    var sumX2 = 0.0;
    for (var index = 0; index < logSizes.length; index++) {
      sumXY += logSizes[index] * logFluctuations[index];
      sumX2 += logSizes[index] * logSizes[index];
    }
    final denominator = count * sumX2 - sumX * sumX;
    if (denominator == 0) return null;
    final alpha = (count * sumXY - sumX * sumY) / denominator;
    return alpha.isFinite ? alpha : null;
  }

  Map<String, double?> _newBaseline(String activity) {
    final stage = _recordedStages().where((item) {
      return _matchesActivity(item['activity'], activity);
    }).firstOrNull;
    if (stage == null) {
      return {for (final (_, key, _) in _metricKeys) key: null};
    }
    final readings = _readings(stage);
    final intervals = _rrIntervals(readings);
    return {
      'mean_hr': _average(
        readings.map((reading) => reading['heart_rate_bpm']).whereType<num>(),
      ),
      'mean_rr': _average(intervals),
      'rmssd': _rmssd(intervals),
      'dfa_alpha1': _dfaAlpha1(intervals),
    };
  }

  String _format(dynamic value, int decimals) =>
      value is num ? value.toStringAsFixed(decimals) : 'Belum tersedia';

  String _timePeriodLabel(String period) => switch (period) {
        'morning' => 'pagi',
        'afternoon' => 'siang/sore',
        'evening' => 'malam',
        'night' => 'malam dini hari',
        _ => period,
      };

  int _timePeriodOrder(String period) => switch (period) {
        'morning' => 0,
        'afternoon' => 1,
        'evening' => 2,
        'night' => 3,
        _ => 4,
      };

  Color _activityColor(String activity) => switch (activity) {
        'sitting' => AppTheme.primary,
        'standing' => const Color(0xFF16805D),
        'walking' => const Color(0xFFE18A2D),
        _ => AppTheme.textMuted,
      };

  @override
  Widget build(BuildContext context) {
    final stages = _recordedStages();
    final plotPoints = <_HeartRatePoint>[];
    for (final activity in _activities) {
      final stage = stages.where((item) => item['activity'] == activity.$2);
      if (stage.isEmpty) continue;
      for (final reading in _readings(stage.first)) {
        final hr = reading['heart_rate_bpm'];
        if (hr is num) {
          plotPoints.add(_HeartRatePoint(activity.$2, hr.toDouble()));
        }
      }
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Ringkasan baseline')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Baseline lama dan hasil rekaman baru',
            style: AppTheme.font(size: 20, weight: FontWeight.w800),
          ),
          const SizedBox(height: 5),
          Text(
            'Baseline tersimpan dirata-ratakan dari seluruh periode waktu pada aktivitas yang sama. Data sesi baru ditampilkan terpisah dan tidak menggantikan baseline lama.',
            style: AppTheme.font(
              size: 11.5,
              color: AppTheme.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 12),
          ..._activities.map((activity) {
            final old = _oldBaseline(activity.$2);
            final recent = _newBaseline(activity.$2);
            final periods = existingBaselineContexts
                .where(
                    (item) => _matchesActivity(item['activity'], activity.$2))
                .map((item) => item['time_period']?.toString())
                .whereType<String>()
                .toSet()
                .toList()
              ..sort((left, right) =>
                  _timePeriodOrder(left).compareTo(_timePeriodOrder(right)));
            return _activitySummaryCard(
              label: activity.$1,
              old: old,
              recent: recent,
              oldPeriods: periods,
            );
          }),
          const SizedBox(height: 8),
          _chartCard(plotPoints),
          const SizedBox(height: 12),
          Text(
            'Metrik dihitung dari data sensor yang tersedia. DFA α1 hanya ditampilkan jika tersedia minimal 64 interval RR yang valid. Nilai yang tidak terkumpul tidak ditaksir; ringkasan ini bukan diagnosis.',
            style: AppTheme.font(
              size: 10.5,
              color: AppTheme.textMuted,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _activitySummaryCard({
    required String label,
    required Map<String, double?> old,
    required Map<String, double?> recent,
    required List<String> oldPeriods,
  }) {
    return Card(
      key: Key('hil-summary-${label.toLowerCase()}'),
      margin: const EdgeInsets.only(bottom: 9),
      child: Padding(
        padding: const EdgeInsets.all(13),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: AppTheme.font(size: 14, weight: FontWeight.w800)),
            if (oldPeriods.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(
                'Rata-rata baseline lama: ${oldPeriods.map(_timePeriodLabel).join(', ')}',
                style: AppTheme.font(size: 9.5, color: AppTheme.textSecondary),
              ),
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                const Expanded(flex: 2, child: SizedBox()),
                Expanded(
                  flex: 3,
                  child: Text(
                    oldPeriods.isEmpty
                        ? 'Baseline lama · belum ada'
                        : 'Baseline lama',
                    style: AppTheme.font(size: 9.5, weight: FontWeight.w700),
                  ),
                ),
                Expanded(
                  flex: 3,
                  child: Text(
                    'Rekaman baru',
                    style: AppTheme.font(size: 9.5, weight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            const Divider(height: 12),
            ..._metricKeys.map((metric) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: Text(
                          metric.$1,
                          style: AppTheme.font(
                            size: 10,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ),
                      Expanded(
                        flex: 3,
                        child: Text(
                          _format(old[metric.$2], metric.$3),
                          style:
                              AppTheme.font(size: 10, weight: FontWeight.w600),
                        ),
                      ),
                      Expanded(
                        flex: 3,
                        child: Text(
                          _format(recent[metric.$2], metric.$3),
                          style:
                              AppTheme.font(size: 10, weight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                )),
          ],
        ),
      ),
    );
  }

  Widget _chartCard(List<_HeartRatePoint> points) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(13),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Grafik HR seluruh konteks',
              style: AppTheme.font(size: 14, weight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              'Pembacaan HR selama rekaman Duduk, Berdiri, dan Berjalan.',
              style: AppTheme.font(size: 10.5, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 8),
            if (points.length < 2)
              Container(
                height: 150,
                alignment: Alignment.center,
                child: Text(
                  'Grafik belum tersedia karena titik HR sesi belum cukup.',
                  textAlign: TextAlign.center,
                  style: AppTheme.font(
                    size: 11,
                    color: AppTheme.textMuted,
                  ),
                ),
              )
            else
              SizedBox(
                key: const Key('hil-baseline-context-chart'),
                height: 205,
                width: double.infinity,
                child: CustomPaint(
                  painter: _ContextHeartRatePainter(
                    points: points,
                    activities: _activities.map((item) => item.$2).toList(),
                    colors: {
                      for (final activity in _activities)
                        activity.$2: _activityColor(activity.$2),
                    },
                  ),
                ),
              ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 12,
              runSpacing: 6,
              children: _activities
                  .map(
                    (activity) => _legendItem(
                      activity.$1,
                      _activityColor(activity.$2),
                    ),
                  )
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _legendItem(String label, Color color) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(label, style: AppTheme.font(size: 9.5)),
        ],
      );
}

class _HeartRatePoint {
  const _HeartRatePoint(this.activity, this.value);

  final String activity;
  final double value;
}

class _ContextHeartRatePainter extends CustomPainter {
  const _ContextHeartRatePainter({
    required this.points,
    required this.activities,
    required this.colors,
  });

  final List<_HeartRatePoint> points;
  final List<String> activities;
  final Map<String, Color> colors;

  @override
  void paint(Canvas canvas, Size size) {
    const left = 34.0;
    const right = 8.0;
    const top = 8.0;
    const bottom = 28.0;
    final chart = Rect.fromLTRB(
      left,
      top,
      math.max(left + 1, size.width - right),
      math.max(top + 1, size.height - bottom),
    );
    final hrValues = points.map((point) => point.value).toList();
    final minHr = hrValues.reduce(math.min);
    final maxHr = hrValues.reduce(math.max);
    final spread = math.max(maxHr - minHr, 1);
    final gridPaint = Paint()
      ..color = AppTheme.borderLight
      ..strokeWidth = 1;
    final labelStyle = AppTheme.font(size: 8.5, color: AppTheme.textMuted);

    for (var line = 0; line < 4; line++) {
      final y = chart.top + chart.height * line / 3;
      canvas.drawLine(Offset(chart.left, y), Offset(chart.right, y), gridPaint);
      final value = maxHr - spread * line / 3;
      final text = TextPainter(
        text: TextSpan(text: value.toStringAsFixed(0), style: labelStyle),
        textDirection: TextDirection.ltr,
      )..layout();
      text.paint(canvas, Offset(0, y - text.height / 2));
    }

    var firstPointIndex = 0;
    for (final activity in activities) {
      final activityPoints =
          points.where((point) => point.activity == activity).toList();
      if (activityPoints.isEmpty) continue;
      final path = Path();
      for (var index = 0; index < activityPoints.length; index++) {
        final pointIndex = firstPointIndex + index;
        final x = chart.left +
            chart.width *
                (points.length == 1 ? 0 : pointIndex / (points.length - 1));
        final y = chart.bottom -
            chart.height * (activityPoints[index].value - minHr) / spread;
        if (index == 0) {
          path.moveTo(x, y);
        } else {
          path.lineTo(x, y);
        }
      }
      canvas.drawPath(
        path,
        Paint()
          ..color = colors[activity] ?? AppTheme.primary
          ..strokeWidth = 2
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round,
      );
      firstPointIndex += activityPoints.length;

      final label = switch (activity) {
        'sitting' => 'Duduk',
        'standing' => 'Berdiri',
        'walking' => 'Berjalan',
        _ => activity,
      };
      final text = TextPainter(
        text: TextSpan(text: label, style: labelStyle),
        textDirection: TextDirection.ltr,
      )..layout();
      final centerX = chart.left +
          chart.width *
              ((firstPointIndex - activityPoints.length / 2) /
                  math.max(points.length - 1, 1));
      text.paint(
        canvas,
        Offset(
          (centerX - text.width / 2)
              .clamp(chart.left, chart.right - text.width)
              .toDouble(),
          chart.bottom + 5,
        ),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _ContextHeartRatePainter oldDelegate) =>
      oldDelegate.points != points ||
      oldDelegate.activities != activities ||
      oldDelegate.colors != colors;
}
