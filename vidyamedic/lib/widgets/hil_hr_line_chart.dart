import 'dart:math' as math;

import 'package:flutter/material.dart';

class HilHrLineChart extends StatelessWidget {
  const HilHrLineChart({
    required this.readings,
    required this.personalBaseline,
    required this.activityAverage,
    this.chartKey = const Key('hil-hr-line-chart'),
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
          painter: _HilHrChartPainter(
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

class _HilHrChartPainter extends CustomPainter {
  const _HilHrChartPainter({
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
      _drawLabel(
        canvas,
        'Menunggu bacaan HR',
        Offset(left, size.height / 2),
        11,
        textColor,
      );
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
        canvas,
        value.toStringAsFixed(0),
        Offset(0, y - 6),
        9,
        textColor,
      );
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
    canvas.drawCircle(Offset(peakX, peakY), 4, Paint()..color = lineColor);
    _drawLabel(
      canvas,
      'Sekarang',
      Offset(plot.right - 42, plot.bottom + 5),
      8,
      textColor,
    );
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
  bool shouldRepaint(covariant _HilHrChartPainter oldDelegate) =>
      oldDelegate.readings != readings ||
      oldDelegate.personalBaseline != personalBaseline ||
      oldDelegate.activityAverage != activityAverage ||
      oldDelegate.textColor != textColor ||
      oldDelegate.gridColor != gridColor ||
      oldDelegate.lineColor != lineColor;
}
