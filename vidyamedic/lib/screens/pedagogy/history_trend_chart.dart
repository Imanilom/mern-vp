import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

enum HistoryChart { wearable, capar, polarCapar, streaming }

class ChartPoint {
  final DateTime time;
  final double value;

  const ChartPoint(this.time, this.value);
}

class TrendChartPainter extends CustomPainter {
  final List<ChartPoint> points;
  final Color color;

  const TrendChartPainter({required this.points, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    const left = 42.0;
    const right = 10.0;
    const top = 12.0;
    const bottom = 28.0;
    final chart =
        Rect.fromLTRB(left, top, size.width - right, size.height - bottom);
    final values = points.map((point) => point.value);
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
    final linePaint = Paint()
      ..color = color
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final labelStyle = AppTheme.font(size: 9, color: AppTheme.textMuted);

    for (var row = 0; row < 4; row++) {
      final fraction = row / 3;
      final y = chart.top + chart.height * fraction;
      canvas.drawLine(Offset(chart.left, y), Offset(chart.right, y), gridPaint);
      final value = maximum - range * fraction;
      _drawLabel(
          canvas, value.toStringAsFixed(1), Offset(0, y - 6), labelStyle);
    }

    final path = Path();
    for (var index = 0; index < points.length; index++) {
      final x = points.length == 1
          ? chart.center.dx
          : chart.left + chart.width * index / (points.length - 1);
      final y = chart.bottom -
          ((points[index].value - minimum) / range) * chart.height;
      if (index == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    canvas.drawPath(path, linePaint);
    final dotPaint = Paint()..color = color;
    for (var index = 0; index < points.length; index++) {
      final x = points.length == 1
          ? chart.center.dx
          : chart.left + chart.width * index / (points.length - 1);
      final y = chart.bottom -
          ((points[index].value - minimum) / range) * chart.height;
      canvas.drawCircle(Offset(x, y), 3, dotPaint);
    }

    _drawLabel(
      canvas,
      _dateLabel(points.first.time),
      Offset(chart.left, chart.bottom + 7),
      labelStyle,
    );
    final endPainter = TextPainter(
      text: TextSpan(text: _dateLabel(points.last.time), style: labelStyle),
      textDirection: TextDirection.ltr,
    )..layout();
    endPainter.paint(
        canvas, Offset(chart.right - endPainter.width, chart.bottom + 7));
  }

  void _drawLabel(Canvas canvas, String text, Offset offset, TextStyle style) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
    )..layout();
    painter.paint(canvas, offset);
  }

  String _dateLabel(DateTime date) =>
      '${date.toLocal().month.toString().padLeft(2, '0')}/'
      '${date.toLocal().day.toString().padLeft(2, '0')}';

  @override
  bool shouldRepaint(covariant TrendChartPainter oldDelegate) =>
      oldDelegate.points != points || oldDelegate.color != color;
}
