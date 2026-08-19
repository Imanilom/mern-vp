import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../services/ble_service.dart';
import '../shared/models/models.dart';

class RealtimeChartWidget extends ConsumerStatefulWidget {
  const RealtimeChartWidget({super.key});

  @override
  ConsumerState<RealtimeChartWidget> createState() => _RealtimeChartWidgetState();
}

class _RealtimeChartWidgetState extends ConsumerState<RealtimeChartWidget> {
  final List<FlSpot> _hrSpots = [];
  double _timeX = 0;
  StreamSubscription<SensorReading>? _subscription;

  @override
  void initState() {
    super.initState();
    final bleService = ref.read(bleServiceProvider);
    
    // Dengarkan stream dari BleService
    _subscription = bleService.readingStream.listen((reading) {
      if (mounted) {
        setState(() {
          _timeX += 1;
          _hrSpots.add(FlSpot(_timeX, reading.heartRate.toDouble()));
          
          // Batasi maksimal 60 titik (sekitar 60 detik jika 1 Hz)
          if (_hrSpots.length > 60) {
            _hrSpots.removeAt(0);
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
        height: 220,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.withOpacity(0.2)),
        ),
        child: const Text('Menunggu stream data sensor...', style: TextStyle(color: Colors.grey)),
      );
    }

    final double minX = _hrSpots.first.x;
    final double maxX = _hrSpots.last.x;

    // Hitung minY dan maxY dinamis berdasarkan titik data aktual agar fluktuasi terlihat sangat jelas
    final yValues = _hrSpots.map((s) => s.y).toList();
    final double minYVal = yValues.reduce((a, b) => a < b ? a : b);
    final double maxYVal = yValues.reduce((a, b) => a > b ? a : b);
    final double range = maxYVal - minYVal;
    final double padding = range < 5 ? 4.0 : (range < 15 ? 5.0 : 8.0);

    final double minY = (minYVal - padding).clamp(30.0, 220.0);
    final double maxY = (maxYVal + padding).clamp(minY + 10.0, 220.0);
    final double gridInterval = ((maxY - minY) / 4).clamp(2.0, 50.0);

    return Container(
      height: 220,
      padding: const EdgeInsets.only(right: 16, left: 10, top: 20, bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Live Heart Rate (bpm)',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black54),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 10),
          Expanded(
            child: LineChart(
              LineChartData(
                minX: minX,
                maxX: maxX,
                minY: minY,
                maxY: maxY,
                lineBarsData: [
                  LineChartBarData(
                    spots: _hrSpots,
                    isCurved: true,
                    color: Colors.redAccent,
                    barWidth: 3,
                    isStrokeCapRound: true,
                    dotData: FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      color: Colors.redAccent.withOpacity(0.1),
                    ),
                  ),
                ],
                titlesData: FlTitlesData(
                  show: true,
                  topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 30,
                      getTitlesWidget: (value, meta) {
                        return Text(
                          value.toInt().toString(),
                          style: const TextStyle(fontSize: 10, color: Colors.grey),
                        );
                      },
                    ),
                  ),
                ),
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: gridInterval,
                  getDrawingHorizontalLine: (value) {
                    return FlLine(
                      color: Colors.grey.withOpacity(0.2),
                      strokeWidth: 1,
                      dashArray: [5, 5],
                    );
                  },
                ),
                borderData: FlBorderData(show: false),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
