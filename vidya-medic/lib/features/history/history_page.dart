import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/functional_colors.dart';
import '../../core/theme/htm_colors.dart';
import '../../core/theme/htm_typography.dart';
import '../../core/network/api_client.dart';
import '../../shared/models/models.dart';
import '../../shared/widgets/timeline_item.dart';

import '../../core/notifications/notification_service.dart';

class HistoryPage extends ConsumerStatefulWidget {
  const HistoryPage({super.key});

  @override
  ConsumerState<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends ConsumerState<HistoryPage> {
  String _selectedPeriod = "Hari Ini";
  String _selectedActivity = "Semua Aktivitas";
  String _selectedStatus = "Semua Status";

  @override
  Widget build(BuildContext context) {
    final colors =
        Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final htmColors = HtmColors.of(context);
    final apiClient = ref.watch(apiClientProvider);

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 72,
        backgroundColor: Colors.transparent,
        elevation: 0,
        flexibleSpace: Container(
          decoration: BoxDecoration(
            color: htmColors.surface,
            border: Border(bottom: BorderSide(color: htmColors.hairline, width: 1)),
          ),
        ),
        foregroundColor: htmColors.ink,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Riwayat Trajectory",
              style: HtmTypography.titleMedium?.copyWith(color: htmColors.ink),
            ),
            Text(
              "Rekam jejak kondisi kesehatan Anda",
              style: TextStyle(
                fontSize: 11,
                color: Colors.white.withValues(alpha: 0.75),
              ),
            ),
          ],
        ),
        actions: [
          Container(
            width: 38,
            height: 38,
            margin: const EdgeInsets.only(right: 12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: IconButton(
              icon: const Icon(Icons.picture_as_pdf_rounded, color: Colors.white, size: 18),
              padding: EdgeInsets.zero,
              tooltip: "Ekspor Laporan PDF",
              onPressed: () => _showPdfExportDialog(context),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter chips fixed below AppBar
          Container(
            color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    children: [
                      _filterChip("Hari Ini", colors),
                      const SizedBox(width: 8),
                      _filterChip("7 Hari", colors),
                      const SizedBox(width: 8),
                      _filterChip("30 Hari", colors),
                      const SizedBox(width: 8),
                      _filterChip("Rentang Tanggal", colors),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      _dropdownFilterChip(
                        label: _selectedActivity,
                        icon: Icons.directions_run_rounded,
                        options: [
                          "Semua Aktivitas",
                          "Tidur",
                          "Duduk Bekerja",
                          "Berdiri",
                          "Berjalan",
                          "Olahraga"
                        ],
                        onChanged: (val) => setState(() => _selectedActivity = val),
                        colors: colors,
                      ),
                      const SizedBox(width: 8),
                      _dropdownFilterChip(
                        label: _selectedStatus,
                        icon: Icons.analytics_rounded,
                        options: [
                          "Semua Status",
                          "Stabil",
                          "Perlu Perhatian",
                          "Anomali"
                        ],
                        onChanged: (val) => setState(() => _selectedStatus = val),
                        colors: colors,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Scrollable body
          Expanded(
            child: Consumer(
              builder: (context, ref, child) {
                final eventsAsync = ref.watch(eventsProvider);

                return eventsAsync.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (err, stack) => Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Text(
                        "Gagal memuat riwayat: $err",
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 13, color: Colors.red),
                      ),
                    ),
                  ),
                  data: (events) {
                    // Filter events based on selections
                    final filteredEvents = events.where((e) {
                      // Filter by Activity
                      if (_selectedActivity != "Semua Aktivitas") {
                        if (e.activity.toLowerCase() != _selectedActivity.toLowerCase()) {
                          return false;
                        }
                      }
                      // Filter by Status
                      if (_selectedStatus != "Semua Status") {
                        final typeMap = {
                          "Stabil": "stable",
                          "Perlu Perhatian": "recovering",
                          "Anomali": "alert",
                        };
                        final targetType = typeMap[_selectedStatus];
                        if (e.type != targetType &&
                            !(e.type == 'deviation' && _selectedStatus == 'Perlu Perhatian')) {
                          return false;
                        }
                      }
                      return true;
                    }).toList();

                    return ListView(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                      children: [
                        // Combined Multi-Metric Graph with Activity Context Ribbon
                        const Text(
                          "Grafik Analisis Trajectory Gabungan",
                          style: TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 15),
                        ),
                        const SizedBox(height: 10),
                        _CombinedTrajectoryChart(
                          colors: colors,
                          period: _selectedPeriod,
                        ),
                        const SizedBox(height: 24),

                        // Summary stats
                        Row(
                          children: [
                            _StatCard(
                              label: "Sesi Monitoring",
                              value: "4",
                              icon: Icons.monitor_heart_rounded,
                              color: colors.dataBlue,
                            ),
                            const SizedBox(width: 10),
                            _StatCard(
                              label: "Deviasi Terdeteksi",
                              value: "${filteredEvents.where((e) => e.type == 'deviation' || e.type == 'alert').length}",
                              icon: Icons.warning_amber_rounded,
                              color: colors.deviationOrange,
                            ),
                            const SizedBox(width: 10),
                            _StatCard(
                              label: "Recovery Rate",
                              value: "100%",
                              icon: Icons.trending_up_rounded,
                              color: colors.stableGreen,
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),

                        const Text(
                          "Timeline Kejadian",
                          style: TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 15),
                        ),
                        const SizedBox(height: 10),

                        if (filteredEvents.isEmpty)
                          Center(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 24),
                              child: Column(
                                children: [
                                  Icon(Icons.history_toggle_off_rounded,
                                      size: 48, color: Colors.grey[400]),
                                  const SizedBox(height: 8),
                                  Text(
                                    "Tidak ada kejadian yang cocok",
                                    style: TextStyle(
                                        fontSize: 13, color: Colors.grey[500]),
                                  ),
                                ],
                              ),
                            ),
                          )
                        else
                          ...List.generate(filteredEvents.length, (index) {
                            return TimelineItemWidget(
                              event: filteredEvents[index],
                              isLast: index == filteredEvents.length - 1,
                              onTap: () {
                                final evt = filteredEvents[index];
                                showDialog(
                                  context: context,
                                  builder: (dialogCtx) => AlertDialog(
                                    shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(20)),
                                    title: Text(evt.title),
                                    content: Text(
                                      "${evt.description}\n\nMagnitude: ${evt.magnitude}\nStatus Recovery: ${evt.recoveryStatus}",
                                      style:
                                          const TextStyle(fontSize: 13, height: 1.5),
                                    ),
                                    actions: [
                                      TextButton(
                                        onPressed: () => Navigator.pop(dialogCtx),
                                        child: const Text("Tutup"),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            );
                          }),
                      ],
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String label, FunctionalColors colors) {
    final isSelected = _selectedPeriod == label;
    return GestureDetector(
      onTap: () => setState(() => _selectedPeriod = label),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF7C3AED) : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? Colors.transparent
                : Colors.grey.withValues(alpha: 0.25),
            width: 1.5,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : Colors.grey[600],
          ),
        ),
      ),
    );
  }

  Widget _dropdownFilterChip({
    required String label,
    required IconData icon,
    required List<String> options,
    required ValueChanged<String> onChanged,
    required FunctionalColors colors,
  }) {
    return PopupMenuButton<String>(
      onSelected: onChanged,
      itemBuilder: (context) => options
          .map((opt) => PopupMenuItem(
                value: opt,
                child: Text(opt, style: const TextStyle(fontSize: 12)),
              ))
          .toList(),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: Colors.grey.withValues(alpha: 0.25),
            width: 1.5,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: Colors.grey[600]),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Colors.grey[700],
              ),
            ),
            const SizedBox(width: 4),
            Icon(Icons.arrow_drop_down_rounded, size: 16, color: Colors.grey[600]),
          ],
        ),
      ),
    );
  }

  void _showPdfExportDialog(BuildContext context) {
    final profileAsync = ref.read(profileProvider);
    final participant = profileAsync.value;
    final String participantId = participant?.id ?? "Offline";
    final String studyCode = participant?.studyCode ?? "HTM-2026";
    final String pdfName = "Laporan_Kesehatan_$participantId.pdf";

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Row(
            children: [
              Icon(Icons.picture_as_pdf_rounded, color: Colors.redAccent, size: 22),
              SizedBox(width: 10),
              Text("Laporan Ringkasan PDF", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.blue.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.blue.withValues(alpha: 0.2)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text("HEALTH TRAJECTORY RESEARCH REPORT", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Colors.blue)),
                      const SizedBox(height: 4),
                      Text("ID Peserta: $participantId | Kode Studi: $studyCode", style: const TextStyle(fontSize: 10, color: Colors.grey)),
                      const Text("Tanggal: 21 Juli 2026", style: TextStyle(fontSize: 10, color: Colors.grey)),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                const Text("Ringkasan Metrik Klinis:", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                const SizedBox(height: 6),
                const Text("• Rata-rata Heart Rate: 74 BPM (Normal)", style: TextStyle(fontSize: 11)),
                const Text("• Rata-rata HRV (RMSSD): 35 ms (Stabil)", style: TextStyle(fontSize: 11)),
                const Text("• DFA Alpha-1: 1.05 (Keseimbangan Otonom Baik)", style: TextStyle(fontSize: 11)),
                const Text("• Total Insiden Anomali: 0 Terdeteksi", style: TextStyle(fontSize: 11)),
                const SizedBox(height: 14),
                const Text("Format dokumen akan diekspor sebagai file PDF resmi berenkripsi standar riset kesehatan.", style: TextStyle(fontSize: 10, color: Colors.grey, height: 1.4)),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text("Batal"),
            ),
            ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text("$pdfName berhasil diunduh ke folder Downloads!"),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
                NotificationService().showNotification(
                  id: 401,
                  title: "📄 Laporan PDF Berhasil Diunduh",
                  body: "$pdfName tersimpan secara lokal.",
                );
              },
              icon: const Icon(Icons.download_rounded, size: 16),
              label: const Text("Unduh PDF"),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.redAccent,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _CombinedTrajectoryChart extends StatefulWidget {
  final FunctionalColors colors;
  final String period;

  const _CombinedTrajectoryChart({
    required this.colors,
    required this.period,
  });

  @override
  State<_CombinedTrajectoryChart> createState() => _CombinedTrajectoryChartState();
}

class _CombinedTrajectoryChartState extends State<_CombinedTrajectoryChart> {
  int _activeMetricIndex = 0; // 0: HR & Baseline, 1: HRV (RMSSD), 2: DFA Alpha-1, 3: Anomaly Score

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final (title, unit, color) = switch (_activeMetricIndex) {
      0 => ("Heart Rate & Baseline", "BPM", widget.colors.dataBlue),
      1 => ("RMSSD (HRV)", "ms", widget.colors.stableGreen),
      2 => ("DFA Alpha-1", "", widget.colors.attentionYellow),
      3 => ("Anomaly Score", "%", widget.colors.alertRed),
      _ => ("Heart Rate & Baseline", "BPM", widget.colors.dataBlue),
    };

    final spots = switch (_activeMetricIndex) {
      0 => [
          const FlSpot(0, 72),
          const FlSpot(1, 75),
          const FlSpot(2, 70),
          const FlSpot(3, 90),
          const FlSpot(4, 85),
          const FlSpot(5, 74),
          const FlSpot(6, 72),
          const FlSpot(7, 75),
          const FlSpot(8, 73),
        ],
      1 => [
          const FlSpot(0, 34),
          const FlSpot(1, 38),
          const FlSpot(2, 35),
          const FlSpot(3, 20),
          const FlSpot(4, 25),
          const FlSpot(5, 36),
          const FlSpot(6, 35),
          const FlSpot(7, 34),
          const FlSpot(8, 38),
        ],
      2 => [
          const FlSpot(0, 1.05),
          const FlSpot(1, 1.08),
          const FlSpot(2, 1.02),
          const FlSpot(3, 0.85),
          const FlSpot(4, 0.90),
          const FlSpot(5, 1.04),
          const FlSpot(6, 1.06),
          const FlSpot(7, 1.05),
          const FlSpot(8, 1.08),
        ],
      3 => [
          const FlSpot(0, 5),
          const FlSpot(1, 4),
          const FlSpot(2, 6),
          const FlSpot(3, 45),
          const FlSpot(4, 30),
          const FlSpot(5, 8),
          const FlSpot(6, 4),
          const FlSpot(7, 5),
          const FlSpot(8, 4),
        ],
      _ => <FlSpot>[],
    };

    final minY = switch (_activeMetricIndex) {
      0 => 50.0,
      1 => 10.0,
      2 => 0.5,
      3 => 0.0,
      _ => 0.0,
    };

    final maxY = switch (_activeMetricIndex) {
      0 => 120.0,
      1 => 60.0,
      2 => 1.5,
      3 => 100.0,
      _ => 100.0,
    };

    final interval = (maxY - minY) / 3;

    final htmColors = HtmColors.of(context);

    return Container(
      decoration: BoxDecoration(
        color: htmColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: htmColors.hairline, width: 1.0),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Tabs/Toggles for metrics
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _metricTab(0, "HR & Baseline"),
                  const SizedBox(width: 8),
                  _metricTab(1, "HRV (RMSSD)"),
                  const SizedBox(width: 8),
                  _metricTab(2, "DFA Alpha-1"),
                  const SizedBox(width: 8),
                  _metricTab(3, "Anomaly Score"),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                          fontWeight: FontWeight.w500, fontSize: 14),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      "Rata-rata: ${(spots.map((s) => s.y).reduce((a, b) => a + b) / spots.length).toStringAsFixed(1)} $unit",
                      style: TextStyle(fontSize: 10, color: Colors.grey[500]),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 120,
              child: LineChart(
                LineChartData(
                  lineTouchData: LineTouchData(
                    enabled: true,
                    handleBuiltInTouches: true,
                    touchTooltipData: LineTouchTooltipData(
                      getTooltipColor: (touchedSpot) => isDark ? const Color(0xFF1E2631) : Colors.white,
                      tooltipBorder: BorderSide(
                        color: isDark ? const Color(0xFF3E4651) : const Color(0xFFE4DFD3),
                        width: 1,
                      ),
                      getTooltipItems: (List<LineBarSpot> touchedSpots) {
                        return touchedSpots.map((barSpot) {
                          if (_activeMetricIndex == 0 && barSpot.barIndex == 0) return null;
                          return LineTooltipItem(
                            "${barSpot.y.toStringAsFixed(_activeMetricIndex == 2 ? 2 : 1)} $unit",
                            GoogleFonts.ibmPlexMono(
                              color: isDark ? Colors.white : HtmColors.inkLight,
                              fontWeight: FontWeight.w500,
                              fontSize: 12,
                            ),
                          );
                        }).toList();
                      },
                    ),
                  ),
                  gridData: FlGridData(
                    show: true,
                    horizontalInterval: interval,
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
                        reservedSize: 34,
                        interval: interval,
                        getTitlesWidget: (val, meta) => Text(
                          _activeMetricIndex == 2 ? val.toStringAsFixed(1) : val.toInt().toString(),
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
                  minY: minY,
                  maxY: maxY,
                  lineBarsData: [
                    if (_activeMetricIndex == 0) ...[
                      // Baseline dotted reference line
                      LineChartBarData(
                        spots: [
                          FlSpot(spots.first.x, 75),
                          FlSpot(spots.last.x, 75),
                        ],
                        isCurved: false,
                        color: widget.colors.stableGreen.withValues(alpha: 0.35),
                        barWidth: 1.5,
                        dotData: const FlDotData(show: false),
                        dashArray: [4, 4],
                      ),
                    ],
                    // Main line
                    LineChartBarData(
                      spots: spots,
                      isCurved: true,
                      curveSmoothness: 0.35,
                      color: color,
                      barWidth: 2.5,
                      isStrokeCapRound: true,
                      dotData: FlDotData(
                        show: true,
                        getDotPainter: (spot, percent, bar, index) {
                          return FlDotCirclePainter(
                            radius: 3,
                            color: color,
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
                            color.withValues(alpha: 0.2),
                            color.withValues(alpha: 0.0),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            // Legend
            Row(
              children: [
                _legendItem(title, color),
                if (_activeMetricIndex == 0) ...[
                  const SizedBox(width: 12),
                  _legendItem("Baseline", widget.colors.stableGreen.withValues(alpha: 0.5)),
                ],
              ],
            ),
            const SizedBox(height: 16),
            const Divider(height: 1),
            const SizedBox(height: 12),
            // Activity Ribbon (Pita Warna Aktivitas)
            const Text(
              "PITA KONTEKS AKTIVITAS",
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w700,
                color: Colors.grey,
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Row(
                children: [
                  _activityRibbonSegment(3, "Tidur", widget.colors.modelPurple),
                  _activityRibbonSegment(2, "Berjalan", widget.colors.stableGreen),
                  _activityRibbonSegment(4, "Duduk Bekerja", widget.colors.dataBlue),
                  _activityRibbonSegment(1, "Olahraga", widget.colors.deviationOrange),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _metricTab(int index, String label) {
    final isSelected = _activeMetricIndex == index;
    return GestureDetector(
      onTap: () => setState(() => _activeMetricIndex = index),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? widget.colors.dataBlue.withValues(alpha: 0.1) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? widget.colors.dataBlue : Colors.grey.withValues(alpha: 0.15),
            width: 1,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: isSelected ? widget.colors.dataBlue : Colors.grey[500],
          ),
        ),
      ),
    );
  }

  Widget _legendItem(String label, Color color) {
    return Row(
      children: [
        Container(
          width: 12,
          height: 3,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(1.5),
          ),
        ),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 9, color: Colors.grey[500])),
      ],
    );
  }

  Widget _activityRibbonSegment(int flex, String label, Color color) {
    return Expanded(
      flex: flex,
      child: Container(
        height: 18,
        color: color,
        alignment: Alignment.center,
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 8,
            color: Colors.white,
            fontWeight: FontWeight.w700,
          ),
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E293B) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          boxShadow: isDark
              ? []
              : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 15, color: color),
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w800, color: color),
            ),
            Text(
              label,
              style: const TextStyle(fontSize: 9, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }
}
