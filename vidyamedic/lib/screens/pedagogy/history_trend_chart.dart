import 'dart:math' as math;

import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

enum HistoryChart { wearable, demo, capar, polarCapar, streaming }

class ChartPoint {
  final DateTime time;
  final double value;
  final String? activity;

  const ChartPoint(this.time, this.value, {this.activity});
}

class TrendChartPainter extends CustomPainter {
  final List<ChartPoint> points;
  final Color color;
  final String yAxisLabel;

  const TrendChartPainter({
    required this.points,
    required this.color,
    this.yAxisLabel = 'HR (bpm)',
  });

  @override
  void paint(Canvas canvas, Size size) {
    const left = 42.0;
    const right = 10.0;
    const top = 12.0;
    const bottom = 40.0;
    final chart =
        Rect.fromLTRB(left, top, size.width - right, size.height - bottom);
    final values = points.map((point) => point.value);
    final firstTime = points.first.time.millisecondsSinceEpoch;
    final lastTime = points.last.time.millisecondsSinceEpoch;
    final timeRange = lastTime - firstTime;
    var minimum = values.reduce((a, b) => a < b ? a : b);
    var maximum = values.reduce((a, b) => a > b ? a : b);
    if (minimum == maximum) {
      minimum -= 1;
      maximum += 1;
    }
    final range = maximum - minimum;
    final gridPaint = Paint()
      ..color = AppTheme.borderLight
      ..strokeWidth = 1;
    final labelStyle = AppTheme.font(size: 9, color: AppTheme.textMuted);

    Offset pointOffset(int index) {
      final point = points[index];
      final timeOffset = timeRange == 0
          ? 0.5
          : (point.time.millisecondsSinceEpoch - firstTime) / timeRange;
      final x = chart.left + chart.width * timeOffset;
      final y = chart.bottom - ((point.value - minimum) / range) * chart.height;
      return Offset(x, y);
    }

    for (var row = 0; row < 4; row++) {
      final fraction = row / 3;
      final y = chart.top + chart.height * fraction;
      canvas.drawLine(Offset(chart.left, y), Offset(chart.right, y), gridPaint);
      final value = maximum - range * fraction;
      _drawLabel(
          canvas, value.toStringAsFixed(1), Offset(0, y - 6), labelStyle);
    }

    for (var index = 1; index < points.length; index++) {
      final currentActivity =
          points[index].activity ?? points[index - 1].activity;
      final linePaint = Paint()
        ..color = _activityColor(currentActivity, color)
        ..strokeWidth = 2.5
        ..strokeCap = StrokeCap.round;
      canvas.drawLine(pointOffset(index - 1), pointOffset(index), linePaint);
    }
    for (var index = 0; index < points.length; index++) {
      canvas.drawCircle(
        pointOffset(index),
        3,
        Paint()..color = _activityColor(points[index].activity, color),
      );
    }

    final middleTime = DateTime.fromMillisecondsSinceEpoch(
      firstTime + (timeRange ~/ 2),
    );
    final tickLabels = [
      (chart.left, _timeLabel(points.first.time, points.last.time)),
      (
        chart.center.dx,
        _timeLabel(middleTime, points.last.time),
      ),
      (chart.right, _timeLabel(points.last.time, points.last.time)),
    ];
    for (final (x, label) in tickLabels) {
      final painter = TextPainter(
        text: TextSpan(text: label, style: labelStyle),
        textDirection: TextDirection.ltr,
      )..layout();
      painter.paint(
        canvas,
        Offset(
          (x - painter.width / 2)
              .clamp(chart.left, chart.right - painter.width)
              .toDouble(),
          chart.bottom + 5,
        ),
      );
    }
    final xAxisTitle = TextPainter(
      text: TextSpan(
        text: 'Waktu',
        style: AppTheme.font(
          size: 9,
          weight: FontWeight.w700,
          color: AppTheme.textSecondary,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    xAxisTitle.paint(
      canvas,
      Offset(chart.center.dx - xAxisTitle.width / 2, chart.bottom + 20),
    );
    final yAxisTitle = TextPainter(
      text: TextSpan(
        text: yAxisLabel,
        style: AppTheme.font(
          size: 9,
          weight: FontWeight.w700,
          color: AppTheme.textSecondary,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    canvas.save();
    canvas.translate(9, chart.center.dy);
    canvas.rotate(-math.pi / 2);
    yAxisTitle.paint(
      canvas,
      Offset(-yAxisTitle.width / 2, -yAxisTitle.height / 2),
    );
    canvas.restore();
  }

  void _drawLabel(Canvas canvas, String text, Offset offset, TextStyle style) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
    )..layout();
    painter.paint(canvas, offset);
  }

  String _timeLabel(DateTime date, DateTime lastDate) {
    final local = date.toLocal();
    final lastLocal = lastDate.toLocal();
    if (local.year == lastLocal.year &&
        local.month == lastLocal.month &&
        local.day == lastLocal.day) {
      return '${local.hour.toString().padLeft(2, '0')}:'
          '${local.minute.toString().padLeft(2, '0')}';
    }
    return '${local.day.toString().padLeft(2, '0')}/'
        '${local.month.toString().padLeft(2, '0')}';
  }

  Color _activityColor(String? activity, Color fallback) {
    final normalized = activity?.trim().toLowerCase();
    return switch (normalized) {
      'rest' || 'sitting' || 'duduk' || 'istirahat' => AppTheme.primary,
      'standing' || 'berdiri' => AppTheme.statusOrange,
      'walking' || 'light' || 'berjalan' => const Color(0xFF7257C8),
      'running' ||
      'exercise' ||
      'moderate' ||
      'intense' ||
      'olahraga' =>
        AppTheme.statusRed,
      _ => fallback,
    };
  }

  @override
  bool shouldRepaint(covariant TrendChartPainter oldDelegate) =>
      oldDelegate.points != points ||
      oldDelegate.color != color ||
      oldDelegate.yAxisLabel != yAxisLabel;
}
