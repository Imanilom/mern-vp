import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../core/theme/functional_colors.dart';
import '../../core/theme/htm_colors.dart';
import '../../core/theme/htm_spacing.dart';
import '../../core/theme/htm_typography.dart';

class MiniTrajectoryChart extends StatelessWidget {
  final List<FlSpot> spots;
  final String title;

  const MiniTrajectoryChart({
    super.key,
    required this.spots,
    this.title = "Trajectory 6 Jam Terakhir",
  });

  @override
  Widget build(BuildContext context) {
    final colors =
        Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;
    final htmColors = HtmColors.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final effectiveSpots = spots.isNotEmpty
        ? spots
        : const [
            FlSpot(0, 72),
            FlSpot(1, 75),
            FlSpot(2, 70),
            FlSpot(3, 90),
            FlSpot(4, 85),
            FlSpot(5, 74),
            FlSpot(6, 72),
          ];

    return Container(
      decoration: BoxDecoration(
        color: htmColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: htmColors.hairline, width: 1),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 14),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      "Terakhir diperbarui: 09:42",
                      style: TextStyle(fontSize: 10, color: Colors.grey[500]),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: colors.stableGreen.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: colors.stableGreen,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        "Stabil",
                        style: TextStyle(
                          fontSize: 11,
                          color: colors.stableGreen,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 110,
              child: LineChart(
                LineChartData(
                  gridData: FlGridData(
                    show: true,
                    horizontalInterval: 20,
                    getDrawingHorizontalLine: (value) => FlLine(
                      color: Colors.grey.withValues(alpha: 0.1),
                      strokeWidth: 1,
                    ),
                    drawVerticalLine: false,
                  ),
                  titlesData: FlTitlesData(
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 30,
                        interval: 20,
                        getTitlesWidget: (val, meta) => Text(
                          val.toInt().toString(),
                          style: TextStyle(
                              fontSize: 9, color: Colors.grey[500]),
                        ),
                      ),
                    ),
                    bottomTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(
                        sideTitles: SideTitles(showTitles: false)),
                  ),
                  borderData: FlBorderData(show: false),
                  minY: 50,
                  maxY: 120,
                  lineBarsData: [
                    // Baseline reference line
                    LineChartBarData(
                      spots: [
                        FlSpot(effectiveSpots.first.x, 75),
                        FlSpot(effectiveSpots.last.x, 75),
                      ],
                      isCurved: false,
                      color: colors.stableGreen.withValues(alpha: 0.3),
                      barWidth: 1,
                      dotData: const FlDotData(show: false),
                      dashArray: [4, 4],
                    ),
                    // Main trajectory
                    LineChartBarData(
                      spots: effectiveSpots,
                      isCurved: true,
                      curveSmoothness: 0.35,
                      color: colors.dataBlue,
                      barWidth: 2.5,
                      isStrokeCapRound: true,
                      dotData: FlDotData(
                        show: true,
                        getDotPainter: (spot, percent, bar, index) {
                          final isAnomaly = spot.y > 85;
                          return FlDotCirclePainter(
                            radius: isAnomaly ? 4 : 2.5,
                            color: isAnomaly
                                ? colors.deviationOrange
                                : colors.dataBlue,
                            strokeWidth: 1.5,
                            strokeColor: Colors.white,
                          );
                        },
                      ),
                      belowBarData: BarAreaData(
                        show: true,
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            colors.dataBlue.withValues(alpha: 0.2),
                            colors.dataBlue.withValues(alpha: 0.0),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                _legendItem(context, "Trajectory HR", colors.dataBlue),
                const SizedBox(width: 16),
                _legendItem(context, "Baseline", colors.stableGreen),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _legendItem(BuildContext context, String label, Color color) {
    return Row(
      children: [
        Container(
          width: 16,
          height: 3,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 5),
        Text(label,
            style: TextStyle(fontSize: 10, color: Colors.grey[500])),
      ],
    );
  }
}
