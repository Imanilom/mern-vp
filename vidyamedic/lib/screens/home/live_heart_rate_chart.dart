import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';

class LiveHeartRateChart extends StatelessWidget {
  const LiveHeartRateChart({
    super.key,
    required this.readings,
    required this.isStreaming,
    this.darkBackground = false,
  });

  final List<Map<String, dynamic>> readings;
  final bool isStreaming;
  final bool darkBackground;

  List<double> get _heartRates => readings
      .where((reading) => reading['is_simulated'] != true)
      .map((reading) => reading['heart_rate_bpm'])
      .whereType<num>()
      .map((value) => value.toDouble())
      .where((value) => value >= 20 && value <= 250)
      .toList();

  @override
  Widget build(BuildContext context) {
    final heartRates = _heartRates;
    final foregroundColor =
        darkBackground ? Colors.white : AppTheme.textSecondary;
    final mutedColor = darkBackground ? Colors.white70 : AppTheme.textMuted;
    final lineColor = darkBackground ? Colors.white : AppTheme.primary;
    final fillColor = darkBackground
        ? Colors.white.withValues(alpha: 0.12)
        : AppTheme.primary.withValues(alpha: 0.1);
    final gridColor = darkBackground
        ? Colors.white.withValues(alpha: 0.18)
        : AppTheme.borderLight;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              isStreaming ? Icons.graphic_eq_rounded : Icons.show_chart_rounded,
              size: 15,
              color: isStreaming ? AppTheme.primary : mutedColor,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                isStreaming
                    ? 'Grafik streaming Polar H10'
                    : 'Grafik riwayat wearable',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: foregroundColor,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '${heartRates.length} sampel',
              style: TextStyle(
                color: mutedColor,
                fontSize: 9.5,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (heartRates.length < 2)
          SizedBox(
            height: 50,
            child: Center(
              child: Text(
                isStreaming
                    ? 'Menunggu data denyut berikutnya dari sensor…'
                    : 'Grafik akan muncul setelah rekaman nyata tersedia.',
                style: TextStyle(
                  color: mutedColor,
                  fontSize: 10,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          )
        else
          SizedBox(
            height: 70,
            width: double.infinity,
            child: CustomPaint(
              key: const ValueKey('heart-rate-line-chart'),
              painter: _HeartRatePainter(
                heartRates: heartRates,
                lineColor: lineColor,
                fillColor: fillColor,
                gridColor: gridColor,
              ),
            ),
          ),
      ],
    );
  }
}

class _HeartRatePainter extends CustomPainter {
  const _HeartRatePainter({
    required this.heartRates,
    required this.lineColor,
    required this.fillColor,
    required this.gridColor,
  });

  final List<double> heartRates;
  final Color lineColor;
  final Color fillColor;
  final Color gridColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (heartRates.length < 2 || size.isEmpty) return;

    final gridPaint = Paint()
      ..color = gridColor
      ..strokeWidth = 0.7;
    for (var row = 0; row < 3; row++) {
      final y = size.height * row / 2;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    final minRate = heartRates.reduce(math.min);
    final maxRate = heartRates.reduce(math.max);
    final range = math.max(maxRate - minRate, 1);
    final points = <Offset>[
      for (var index = 0; index < heartRates.length; index++)
        Offset(
          size.width * index / (heartRates.length - 1),
          size.height -
              (heartRates[index] - minRate) / range * size.height * 0.82 -
              size.height * 0.09,
        ),
    ];
    final linePath = Path()..moveTo(points.first.dx, points.first.dy);
    for (final point in points.skip(1)) {
      linePath.lineTo(point.dx, point.dy);
    }

    final fillPath = Path.from(linePath)
      ..lineTo(points.last.dx, size.height)
      ..lineTo(points.first.dx, size.height)
      ..close();
    canvas.drawPath(fillPath, Paint()..color = fillColor);
    canvas.drawPath(
      linePath,
      Paint()
        ..color = lineColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    canvas.drawCircle(
      points.last,
      3,
      Paint()..color = lineColor,
    );
  }

  @override
  bool shouldRepaint(covariant _HeartRatePainter oldDelegate) {
    return oldDelegate.heartRates != heartRates ||
        oldDelegate.lineColor != lineColor ||
        oldDelegate.fillColor != fillColor ||
        oldDelegate.gridColor != gridColor;
  }
}
