import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

class HilBaselineHistoryScreen extends StatelessWidget {
  const HilBaselineHistoryScreen({
    super.key,
    required this.baselineContexts,
  });

  static const _activities = <(String, String, Color)>[
    ('Duduk', 'sitting', AppTheme.primary),
    ('Berdiri', 'standing', Color(0xFF16805D)),
    ('Berjalan', 'walking', Color(0xFFE18A2D)),
  ];

  final List<Map<String, dynamic>> baselineContexts;

  List<Map<String, dynamic>> _history(Map<String, dynamic> context) {
    final history = context['history'];
    if (history is! List) return const [];
    return history.whereType<Map>().map(Map<String, dynamic>.from).toList()
      ..sort((a, b) =>
          (a['date']?.toString() ?? '').compareTo(b['date']?.toString() ?? ''));
  }

  List<Map<String, dynamic>> _windows(Map<String, dynamic> day) {
    final windows = day['windows'];
    if (windows is! List) return const [];
    return windows.whereType<Map>().map(Map<String, dynamic>.from).toList()
      ..sort((a, b) => (_windowTime(a)?.millisecondsSinceEpoch ?? 0)
          .compareTo(_windowTime(b)?.millisecondsSinceEpoch ?? 0));
  }

  DateTime? _windowTime(Map<String, dynamic> window) {
    final value = window['window_start'] ?? window['recorded_at'];
    if (value is num) {
      return DateTime.fromMillisecondsSinceEpoch(value.toInt());
    }
    return DateTime.tryParse(value?.toString() ?? '');
  }

  List<_BaselinePoint> _points() {
    final points = <_BaselinePoint>[];
    for (final (_, activity, color) in _activities) {
      for (final context in baselineContexts.where(
        (item) => item['activity']?.toString() == activity,
      )) {
        for (final day in _history(context)) {
          final windows = _windows(day);
          if (windows.isNotEmpty) {
            for (final window in windows) {
              final hr = _map(window['features'])['mean_hr'];
              final time = _windowTime(window);
              if (window['quality_passed'] == true &&
                  hr is num &&
                  time != null) {
                points.add(
                  _BaselinePoint(activity, color, time, hr.toDouble()),
                );
              }
            }
            continue;
          }
          final hr = _map(_map(day['feature_stats'])['mean_hr'])['mean'];
          final time = DateTime.tryParse(day['date']?.toString() ?? '');
          if (hr is num && time != null) {
            points.add(
              _BaselinePoint(activity, color, time, hr.toDouble()),
            );
          }
        }
      }
    }
    return points..sort((a, b) => a.time.compareTo(b.time));
  }

  Map<String, dynamic> _map(dynamic value) =>
      value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

  String _dateLabel(String value) {
    final parts = value.split('-');
    return parts.length == 3 ? '${parts[2]}/${parts[1]}/${parts[0]}' : value;
  }

  String _format(dynamic value, {int decimals = 1}) =>
      value is num ? value.toStringAsFixed(decimals) : '—';

  String _windowDetail(Map<String, dynamic> window) {
    final features = _map(window['features']);
    return [
      if (features['mean_hr'] is num) 'HR ${_format(features['mean_hr'])} bpm',
      if (features['mean_rr'] is num) 'RR ${_format(features['mean_rr'])} ms',
      if (features['rmssd'] is num) 'RMSSD ${_format(features['rmssd'])} ms',
      if (features['sdnn'] is num) 'SDNN ${_format(features['sdnn'])} ms',
      if (features['dfa_alpha1'] is num)
        'DFA ${_format(features['dfa_alpha1'], decimals: 3)}',
      if (features['motion_intensity'] is num)
        'Gerak ${_format(features['motion_intensity'], decimals: 2)}',
    ].join(' · ');
  }

  String _windowClock(Map<String, dynamic> window) {
    final time = _windowTime(window)?.toLocal();
    if (time == null) return 'Waktu tidak tersedia';
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }

  Widget _chart(List<_BaselinePoint> points) {
    return Card(
      key: const Key('hil-baseline-longitudinal-card'),
      child: Padding(
        padding: const EdgeInsets.all(13),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Grafik longitudinal HR baseline',
              style: AppTheme.font(size: 14, weight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              'Setiap titik mewakili rata-rata HR satu window 1 menit yang lolos kualitas.',
              style: AppTheme.font(size: 10.5, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 8),
            if (points.isEmpty)
              const SizedBox(
                height: 170,
                child: Center(
                  child: Text(
                    'Belum ada window HR yang lolos kualitas untuk ditampilkan.',
                    textAlign: TextAlign.center,
                  ),
                ),
              )
            else
              SizedBox(
                key: const Key('hil-baseline-longitudinal-chart'),
                height: 210,
                width: double.infinity,
                child: CustomPaint(
                  painter: _BaselineHistoryChartPainter(points),
                ),
              ),
            const SizedBox(height: 5),
            Wrap(
              spacing: 12,
              children: _activities
                  .map(
                    (activity) => Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 9,
                          height: 9,
                          decoration: BoxDecoration(
                            color: activity.$3,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(activity.$1, style: AppTheme.font(size: 9.5)),
                      ],
                    ),
                  )
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _activityCard(
    (String, String, Color) activity,
    Map<String, dynamic> context,
  ) {
    final history = _history(context).reversed.toList();
    final stats = _map(context['feature_stats']);
    final meanHr = _map(stats['mean_hr'])['mean'];
    final readiness = _map(context['scenario_readiness']);
    final validWindows =
        (readiness['valid_window_count'] as num?)?.toInt() ?? 0;
    final totalWindows = (context['segment_count'] as num?)?.toInt() ?? 0;

    return Card(
      key: Key('hil-baseline-history-activity-${activity.$2}'),
      margin: const EdgeInsets.only(bottom: 9),
      child: ExpansionTile(
        leading: Icon(Icons.monitor_heart_outlined, color: activity.$3),
        title: Text(activity.$1,
            style: AppTheme.font(size: 13, weight: FontWeight.w800)),
        subtitle: Text(
          'HR baseline ${_format(meanHr)} bpm · $validWindows/$totalWindows window lolos kualitas',
          style: AppTheme.font(size: 10, color: AppTheme.textSecondary),
        ),
        children: [
          if (history.isEmpty)
            const ListTile(
              title: Text('Belum ada ringkasan harian.'),
            )
          else
            ...history.map((day) {
              final date = day['date']?.toString() ?? '';
              final windows = _windows(day);
              final valid = (day['valid_window_count'] as num?)?.toInt() ?? 0;
              final total = (day['segment_count'] as num?)?.toInt() ?? 0;
              final dailyHr =
                  _map(_map(day['feature_stats'])['mean_hr'])['mean'];
              return ExpansionTile(
                key: Key('hil-baseline-history-day-${activity.$2}-$date'),
                tilePadding: const EdgeInsets.only(left: 14, right: 12),
                title: Text(_dateLabel(date),
                    style: AppTheme.font(size: 11, weight: FontWeight.w700)),
                subtitle: Text(
                  '$valid/$total window lolos kualitas · HR rata-rata ${_format(dailyHr)} bpm',
                  style: AppTheme.font(size: 9.5),
                ),
                children: windows.isEmpty
                    ? const [
                        ListTile(
                          title: Text(
                            'Detail window belum tersedia untuk data riwayat ini.',
                          ),
                        ),
                      ]
                    : windows
                        .map(
                          (window) => ListTile(
                            key: Key(
                              'hil-baseline-window-${activity.$2}-${_windowTime(window)?.millisecondsSinceEpoch ?? date}',
                            ),
                            dense: true,
                            contentPadding:
                                const EdgeInsets.symmetric(horizontal: 20),
                            leading: Icon(
                              window['quality_passed'] == true
                                  ? Icons.check_circle_outline
                                  : Icons.warning_amber_rounded,
                              color: window['quality_passed'] == true
                                  ? AppTheme.statusGreen
                                  : AppTheme.statusOrange,
                              size: 18,
                            ),
                            title: Text(
                              _windowClock(window),
                              style: AppTheme.font(
                                  size: 10, weight: FontWeight.w700),
                            ),
                            subtitle: Text(
                              '${_windowDetail(window).isEmpty ? 'Metrik tidak tersedia' : _windowDetail(window)}\n'
                              'Mutu sinyal ${_format(_map(window['quality'])['q_signal'], decimals: 2)} · '
                              'kelengkapan ${_format(_map(window['quality'])['q_complete'], decimals: 2)} · '
                              '${window['quality_passed'] == true ? 'Lolos' : 'Tidak lolos'}',
                              style: AppTheme.font(
                                size: 9,
                                color: AppTheme.textSecondary,
                              ),
                            ),
                            isThreeLine: true,
                          ),
                        )
                        .toList(),
              );
            }),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final points = _points();
    final existing = {
      for (final context in baselineContexts)
        context['activity']?.toString(): context,
    };

    return Scaffold(
      appBar: AppBar(title: const Text('Riwayat baseline HIL')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Ringkasan baseline yang terbentuk',
            style: AppTheme.font(size: 19, weight: FontWeight.w800),
          ),
          const SizedBox(height: 5),
          Text(
            'Baseline diringkas per aktivitas. Buka tanggal untuk melihat kembali setiap window, nilai HR, metrik yang tersedia, dan status kualitasnya.',
            style: AppTheme.font(
              size: 11,
              color: AppTheme.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 10),
          _chart(points),
          const SizedBox(height: 5),
          if (baselineContexts.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(14),
                child: Text('Belum ada baseline HIL yang tersimpan.'),
              ),
            )
          else
            ..._activities
                .where((activity) => existing.containsKey(activity.$2))
                .map((activity) =>
                    _activityCard(activity, existing[activity.$2]!)),
          const SizedBox(height: 8),
          Text(
            'Window yang tidak lolos kualitas tetap ditampilkan dalam rincian, tetapi tidak digunakan sebagai titik pada grafik atau perhitungan baseline.',
            style: AppTheme.font(
              size: 10,
              color: AppTheme.textMuted,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}

class _BaselinePoint {
  const _BaselinePoint(
    this.activity,
    this.color,
    this.time,
    this.value,
  );

  final String activity;
  final Color color;
  final DateTime time;
  final double value;
}

class _BaselineHistoryChartPainter extends CustomPainter {
  const _BaselineHistoryChartPainter(this.points);

  final List<_BaselinePoint> points;

  @override
  void paint(Canvas canvas, Size size) {
    const left = 36.0;
    const right = 8.0;
    const top = 10.0;
    const bottom = 28.0;
    final chart = Rect.fromLTRB(
      left,
      top,
      math.max(left + 1, size.width - right),
      math.max(top + 1, size.height - bottom),
    );
    final values = points.map((point) => point.value).toList();
    final minHr = values.reduce(math.min);
    final maxHr = values.reduce(math.max);
    final spread = math.max(maxHr - minHr, 1);
    final firstTime = points.first.time.millisecondsSinceEpoch;
    final lastTime = points.last.time.millisecondsSinceEpoch;
    final timeSpread = math.max(lastTime - firstTime, 1);
    final gridPaint = Paint()
      ..color = AppTheme.borderLight
      ..strokeWidth = 1;
    final labelStyle = AppTheme.font(size: 8.5, color: AppTheme.textMuted);

    for (var index = 0; index < 4; index++) {
      final y = chart.top + chart.height * index / 3;
      canvas.drawLine(Offset(chart.left, y), Offset(chart.right, y), gridPaint);
      final value = maxHr - spread * index / 3;
      final text = TextPainter(
        text: TextSpan(text: value.toStringAsFixed(0), style: labelStyle),
        textDirection: TextDirection.ltr,
      )..layout();
      text.paint(canvas, Offset(0, y - text.height / 2));
    }

    for (final activity in HilBaselineHistoryScreen._activities) {
      final activityPoints =
          points.where((point) => point.activity == activity.$2).toList();
      if (activityPoints.isEmpty) continue;
      final path = Path();
      _BaselinePoint? previous;
      for (final point in activityPoints) {
        final x = chart.left +
            chart.width *
                (point.time.millisecondsSinceEpoch - firstTime) /
                timeSpread;
        final y = chart.bottom - chart.height * (point.value - minHr) / spread;
        if (previous == null ||
            point.time.difference(previous.time) >
                const Duration(seconds: 90)) {
          path.moveTo(x, y);
        } else {
          path.lineTo(x, y);
        }
        canvas.drawCircle(Offset(x, y), 2.2, Paint()..color = point.color);
        previous = point;
      }
      canvas.drawPath(
        path,
        Paint()
          ..color = activity.$3
          ..strokeWidth = 1.8
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round,
      );
    }

    final firstLabel = _date(firstTime);
    final lastLabel = _date(lastTime);
    for (final entry in [
      (firstLabel, chart.left),
      (lastLabel, chart.right),
    ]) {
      final text = TextPainter(
        text: TextSpan(text: entry.$1, style: labelStyle),
        textDirection: TextDirection.ltr,
      )..layout();
      final x = entry.$2 == chart.left
          ? chart.left
          : math.max(chart.left, chart.right - text.width);
      text.paint(canvas, Offset(x, chart.bottom + 5));
    }
  }

  String _date(int milliseconds) {
    final date = DateTime.fromMillisecondsSinceEpoch(milliseconds).toLocal();
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}';
  }

  @override
  bool shouldRepaint(covariant _BaselineHistoryChartPainter oldDelegate) =>
      oldDelegate.points != points;
}
