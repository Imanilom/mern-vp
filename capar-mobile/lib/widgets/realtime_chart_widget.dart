import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';

import '../services/ble_service.dart';
import '../shared/models/models.dart';
import '../theme/app_colors.dart';

enum ChartViewMode { hr, rr, ecg, dual }

class RealtimeChartWidget extends ConsumerStatefulWidget {
  const RealtimeChartWidget({super.key});

  @override
  ConsumerState<RealtimeChartWidget> createState() =>
      _RealtimeChartWidgetState();
}

class _RealtimeChartWidgetState extends ConsumerState<RealtimeChartWidget> {
  final List<FlSpot> _hrSpots = [];
  final List<FlSpot> _rrSpots = [];
  final List<FlSpot> _ecgSpots = [];
  final List<SensorReading> _ecgLog = [];
  double _timeX = 0;
  StreamSubscription<SensorReading>? _subscription;
  ChartViewMode _viewMode = ChartViewMode.hr;

  int _latestHr = 0;
  int _latestRr = 0;
  double _latestEcg = 0;
  int _prevHr = 0;
  int _prevRr = 0;
  int _ecgWindowSize = 60;

  @override
  void initState() {
    super.initState();
    final bleService = ref.read(bleServiceProvider);

    _subscription = bleService.readingStream.listen((reading) {
      if (mounted) {
        setState(() {
          _timeX += 1;
          _prevHr = _latestHr;
          _prevRr = _latestRr;
          _latestHr = reading.heartRate;
          _latestRr = reading.rrInterval;
          _latestEcg = reading.ecg.clamp(-1.0, 1.0);

          _hrSpots.add(FlSpot(_timeX, reading.heartRate.toDouble()));
          _rrSpots.add(FlSpot(_timeX, reading.rrInterval.toDouble()));
          _ecgSpots.add(FlSpot(_timeX, _latestEcg));
          _ecgLog.add(reading);

          // Simpan maksimal 60 titik (sekitar 60 detik)
          if (_hrSpots.length > 60) {
            _hrSpots.removeAt(0);
          }
          if (_rrSpots.length > 60) {
            _rrSpots.removeAt(0);
          }
          if (_ecgSpots.length > 60) {
            _ecgSpots.removeAt(0);
          }
          if (_ecgLog.length > 20) {
            _ecgLog.removeAt(0);
          }
        });
      }
    });
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_hrSpots.isEmpty) {
      return Container(
        height: 240,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.line),
        ),
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: AppColors.teal,
              ),
            ),
            SizedBox(height: 12),
            Text(
              'Menunggu stream data sensor Polar H10...',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.gray,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }

    final int hrDelta = _prevHr > 0 ? (_latestHr - _prevHr) : 0;
    final int rrDelta = _prevRr > 0 ? (_latestRr - _prevRr) : 0;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Header Controls & Live Metrics Badges ───────────────────────────
          Row(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'STREAMING SINYAL JANTUNG REAL-TIME',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: AppColors.teal,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Text(
                        _viewMode == ChartViewMode.rr
                            ? '$_latestRr ms'
                            : (_viewMode == ChartViewMode.ecg
                                  ? _latestEcg.toStringAsFixed(4)
                                  : '$_latestHr BPM'),
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: _viewMode == ChartViewMode.rr
                              ? AppColors.teal
                              : (_viewMode == ChartViewMode.ecg
                                    ? AppColors.purple
                                    : AppColors.red),
                        ),
                      ),
                      const SizedBox(width: 6),
                      _buildDeltaBadge(
                        _viewMode == ChartViewMode.rr ? rrDelta : hrDelta,
                        _viewMode == ChartViewMode.rr ? 'ms' : 'bpm',
                      ),
                    ],
                  ),
                ],
              ),
              const Spacer(),
              // Mode Selector Tabs
              Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  color: AppColors.graySoft,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    _buildModeTab('HR', ChartViewMode.hr),
                    _buildModeTab('RR ms', ChartViewMode.rr),
                    _buildModeTab('ECG', ChartViewMode.ecg),
                    _buildModeTab('Dual', ChartViewMode.dual),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // ── Realtime Line Chart ─────────────────────────────────────────────
          SizedBox(
            height: 170,
            child: _viewMode == ChartViewMode.rr
                ? _buildRRChart()
                : (_viewMode == ChartViewMode.ecg
                      ? _buildECGChart()
                      : (_viewMode == ChartViewMode.dual
                            ? _buildDualChart()
                            : _buildHRChart())),
          ),

          if (_viewMode == ChartViewMode.ecg) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(
                  Icons.zoom_in_rounded,
                  size: 15,
                  color: AppColors.purple,
                ),
                const SizedBox(width: 4),
                const Text(
                  'Zoom',
                  style: TextStyle(
                    fontSize: 10,
                    color: AppColors.gray,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Expanded(
                  child: Slider(
                    value: _ecgWindowSize.toDouble(),
                    min: 10,
                    max: 60,
                    divisions: 10,
                    activeColor: AppColors.purple,
                    label: '$_ecgWindowSize titik',
                    onChanged: (value) =>
                        setState(() => _ecgWindowSize = value.round()),
                  ),
                ),
                Text(
                  '$_ecgWindowSize titik',
                  style: const TextStyle(fontSize: 10, color: AppColors.gray),
                ),
              ],
            ),
          ],

          const SizedBox(height: 8),
          // Subtext Indicator
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _viewMode == ChartViewMode.ecg
                    ? 'ECG range: -1..1 · ${_ecgSpots.length} sampel'
                    : 'Live Window: ${_hrSpots.length} detik',
                style: const TextStyle(
                  fontSize: 10,
                  color: AppColors.gray,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Row(
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      color: AppColors.green,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Text(
                    'Polar H10 Streaming (1 Hz)',
                    style: TextStyle(
                      fontSize: 10,
                      color: AppColors.green,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ],
          ),

          if (_viewMode == ChartViewMode.ecg) _buildEcgLogger(),
        ],
      ),
    );
  }

  Widget _buildModeTab(String label, ChartViewMode mode) {
    final bool isSelected = _viewMode == mode;
    return GestureDetector(
      onTap: () => setState(() => _viewMode = mode),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.surface : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 4,
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 10.5,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color: isSelected ? AppColors.navy : AppColors.gray,
          ),
        ),
      ),
    );
  }

  Widget _buildDeltaBadge(int delta, String unit) {
    if (delta == 0) return const SizedBox.shrink();
    final bool isUp = delta > 0;
    final color = isUp ? AppColors.red : AppColors.green;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isUp ? Icons.arrow_drop_up_rounded : Icons.arrow_drop_down_rounded,
            size: 14,
            color: color,
          ),
          Text(
            '${isUp ? "+$delta" : delta} $unit',
            style: TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  // ── HR Chart Builder (High-Sensitivity Scaling) ───────────────────────────
  Widget _buildHRChart() {
    final double minX = _hrSpots.first.x;
    final double maxX = _hrSpots.last.x;

    final yValues = _hrSpots.map((s) => s.y).toList();
    final double minYVal = yValues.reduce((a, b) => a < b ? a : b);
    final double maxYVal = yValues.reduce((a, b) => a > b ? a : b);
    final double range = maxYVal - minYVal;

    // TIGHT PADDING agar riak naik turun 1-2 BPM terlihat sangat jelas!
    final double padding = range < 3 ? 1.5 : (range < 8 ? 2.5 : 4.0);
    final double minY = (minYVal - padding).clamp(30.0, 220.0);
    final double maxY = (maxYVal + padding).clamp(minY + 4.0, 220.0);
    final double gridInterval = ((maxY - minY) / 4).clamp(1.0, 50.0);

    return LineChart(
      LineChartData(
        minX: minX,
        maxX: maxX,
        minY: minY,
        maxY: maxY,
        lineBarsData: [
          LineChartBarData(
            spots: _hrSpots,
            isCurved: true,
            curveSmoothness: 0.25,
            color: AppColors.red,
            barWidth: 2.5,
            isStrokeCapRound: true,
            dotData: FlDotData(
              show: true,
              checkToShowDot: (spot, barData) => spot.x == maxX,
              getDotPainter: (spot, percent, barData, index) =>
                  FlDotCirclePainter(
                    radius: 4.5,
                    color: AppColors.red,
                    strokeWidth: 2,
                    strokeColor: Colors.white,
                  ),
            ),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                colors: [
                  AppColors.red.withValues(alpha: 0.25),
                  AppColors.red.withValues(alpha: 0.01),
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),
        ],
        titlesData: FlTitlesData(
          show: true,
          topTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          rightTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          bottomTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 28,
              getTitlesWidget: (val, meta) => Text(
                val.toInt().toString(),
                style: const TextStyle(
                  fontSize: 9.5,
                  color: AppColors.gray,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval: gridInterval,
          getDrawingHorizontalLine: (val) =>
              FlLine(color: AppColors.line, strokeWidth: 1, dashArray: [4, 4]),
        ),
        borderData: FlBorderData(show: false),
      ),
    );
  }

  // ── RR Tachogram Chart Builder (High-Frequency Oscillation) ────────────────
  Widget _buildRRChart() {
    final double minX = _rrSpots.first.x;
    final double maxX = _rrSpots.last.x;

    final yValues = _rrSpots.map((s) => s.y).toList();
    final double minYVal = yValues.reduce((a, b) => a < b ? a : b);
    final double maxYVal = yValues.reduce((a, b) => a > b ? a : b);
    final double range = maxYVal - minYVal;

    // Sensitive padding for RR Tachogram ms ripples
    final double padding = range < 20 ? 12.0 : (range < 60 ? 25.0 : 40.0);
    final double minY = (minYVal - padding).clamp(300.0, 1800.0);
    final double maxY = (maxYVal + padding).clamp(minY + 30.0, 1800.0);
    final double gridInterval = ((maxY - minY) / 4).clamp(5.0, 200.0);

    return LineChart(
      LineChartData(
        minX: minX,
        maxX: maxX,
        minY: minY,
        maxY: maxY,
        lineBarsData: [
          LineChartBarData(
            spots: _rrSpots,
            isCurved: true,
            curveSmoothness: 0.3,
            color: AppColors.teal,
            barWidth: 2.5,
            isStrokeCapRound: true,
            dotData: FlDotData(
              show: true,
              checkToShowDot: (spot, barData) => spot.x == maxX,
              getDotPainter: (spot, percent, barData, index) =>
                  FlDotCirclePainter(
                    radius: 4.5,
                    color: AppColors.teal,
                    strokeWidth: 2,
                    strokeColor: Colors.white,
                  ),
            ),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                colors: [
                  AppColors.teal.withValues(alpha: 0.25),
                  AppColors.teal.withValues(alpha: 0.01),
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),
        ],
        titlesData: FlTitlesData(
          show: true,
          topTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          rightTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          bottomTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 32,
              getTitlesWidget: (val, meta) => Text(
                val.toInt().toString(),
                style: const TextStyle(
                  fontSize: 9.5,
                  color: AppColors.gray,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval: gridInterval,
          getDrawingHorizontalLine: (val) =>
              FlLine(color: AppColors.line, strokeWidth: 1, dashArray: [4, 4]),
        ),
        borderData: FlBorderData(show: false),
      ),
    );
  }

  Widget _buildECGChart() {
    final visibleSpots = _ecgSpots.length > _ecgWindowSize
        ? _ecgSpots.sublist(_ecgSpots.length - _ecgWindowSize)
        : _ecgSpots;
    final minX = visibleSpots.first.x;
    final maxX = visibleSpots.last.x;

    return LineChart(
      LineChartData(
        minX: minX,
        maxX: maxX,
        minY: -1,
        maxY: 1,
        lineBarsData: [
          LineChartBarData(
            spots: visibleSpots,
            isCurved: false,
            color: AppColors.purple,
            barWidth: 1.8,
            dotData: const FlDotData(show: false),
          ),
        ],
        extraLinesData: ExtraLinesData(
          horizontalLines: [
            HorizontalLine(
              y: 1,
              color: AppColors.red,
              strokeWidth: 1,
              dashArray: [4, 4],
            ),
            HorizontalLine(
              y: -1,
              color: AppColors.red,
              strokeWidth: 1,
              dashArray: [4, 4],
            ),
          ],
        ),
        titlesData: FlTitlesData(
          show: true,
          topTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          rightTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          bottomTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 28,
              interval: 0.5,
              getTitlesWidget: (value, meta) => Text(
                value.toStringAsFixed(1),
                style: const TextStyle(
                  fontSize: 9.5,
                  color: AppColors.gray,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval: 0.5,
          getDrawingHorizontalLine: (value) =>
              FlLine(color: AppColors.line, strokeWidth: 1, dashArray: [4, 4]),
        ),
        borderData: FlBorderData(show: false),
      ),
    );
  }

  Widget _buildEcgLogger() {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.purpleSoft,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.purple.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'ECG LOGGER',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: AppColors.purple,
                ),
              ),
              Text(
                '${_ecgLog.length} sampel · range -1..1',
                style: const TextStyle(fontSize: 9.5, color: AppColors.gray),
              ),
            ],
          ),
          const SizedBox(height: 5),
          ..._ecgLog.reversed
              .take(5)
              .map(
                (reading) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        TimeOfDay.fromDateTime(
                          reading.timestamp,
                        ).format(context),
                        style: const TextStyle(
                          fontSize: 9.5,
                          color: AppColors.gray,
                        ),
                      ),
                      Text(
                        reading.ecg.toStringAsFixed(4),
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: AppColors.purple,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
        ],
      ),
    );
  }

  // ── Dual Overlay Chart Builder (HR Red + RR Teal) ───────────────────────────
  Widget _buildDualChart() {
    final double minX = _hrSpots.first.x;
    final double maxX = _hrSpots.last.x;

    // Normalisasikan RR agar berskala seimbang dengan HR (RR ms / 10)
    final dualRRSpots = _rrSpots.map((s) => FlSpot(s.x, s.y / 10.0)).toList();

    final yHR = _hrSpots.map((s) => s.y).toList();
    final yRR = dualRRSpots.map((s) => s.y).toList();
    final allY = [...yHR, ...yRR];

    final double minYVal = allY.reduce((a, b) => a < b ? a : b);
    final double maxYVal = allY.reduce((a, b) => a > b ? a : b);
    final double range = maxYVal - minYVal;
    final double padding = range < 5 ? 2.0 : 4.0;

    final double minY = (minYVal - padding).clamp(20.0, 200.0);
    final double maxY = (maxYVal + padding).clamp(minY + 6.0, 200.0);

    return LineChart(
      LineChartData(
        minX: minX,
        maxX: maxX,
        minY: minY,
        maxY: maxY,
        lineBarsData: [
          // HR Trace (Red)
          LineChartBarData(
            spots: _hrSpots,
            isCurved: true,
            color: AppColors.red,
            barWidth: 2.2,
            dotData: const FlDotData(show: false),
          ),
          // RR Trace / 10 (Teal)
          LineChartBarData(
            spots: dualRRSpots,
            isCurved: true,
            color: AppColors.teal,
            barWidth: 2.2,
            dotData: const FlDotData(show: false),
          ),
        ],
        titlesData: FlTitlesData(
          show: true,
          topTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          rightTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          bottomTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 28,
              getTitlesWidget: (val, meta) => Text(
                val.toInt().toString(),
                style: const TextStyle(
                  fontSize: 9.5,
                  color: AppColors.gray,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          getDrawingHorizontalLine: (val) =>
              FlLine(color: AppColors.line, strokeWidth: 1, dashArray: [4, 4]),
        ),
        borderData: FlBorderData(show: false),
      ),
    );
  }
}
