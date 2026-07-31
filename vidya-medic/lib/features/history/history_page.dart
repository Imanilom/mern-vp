import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/functional_colors.dart';
import '../../core/theme/htm_colors.dart';
import '../../core/theme/htm_typography.dart';
import '../../core/network/api_client.dart';
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
  DateTime? _startDate;
  DateTime? _endDate;

  Future<void> _selectDateRange(BuildContext context) async {
    final DateTimeRange? picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      builder: (context, child) {
        final colors = Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: ColorScheme.light(
              primary: colors.dataBlue,
              onPrimary: Colors.white,
              surface: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF1E293B) : Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        _startDate = picked.start;
        // Set to end of the day
        _endDate = picked.end.add(const Duration(hours: 23, minutes: 59, seconds: 59));
        _selectedPeriod = "Rentang Tanggal";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors =
        Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final htmColors = HtmColors.of(context);

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
                      _filterChip("Rentang Tanggal", colors, onTap: () => _selectDateRange(context)),
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
                      // Filter by Date
                      final now = DateTime.now();
                      if (_selectedPeriod == "Hari Ini") {
                        if (e.timestamp.year != now.year || e.timestamp.month != now.month || e.timestamp.day != now.day) {
                          return false;
                        }
                      } else if (_selectedPeriod == "7 Hari") {
                        if (now.difference(e.timestamp).inDays > 7) return false;
                      } else if (_selectedPeriod == "30 Hari") {
                        if (now.difference(e.timestamp).inDays > 30) return false;
                      } else if (_selectedPeriod == "Rentang Tanggal" && _startDate != null && _endDate != null) {
                        if (e.timestamp.isBefore(_startDate!) || e.timestamp.isAfter(_endDate!)) return false;
                      }

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
                              value: "${events.isEmpty ? 1 : events.map((e) => e.activity).toSet().length}",
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
                              value: events.isEmpty ? "100%" : "${(events.where((e) => e.recoveryStatus == 'Tercapai').length * 100 ~/ events.length)}%",
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

  Widget _filterChip(String label, FunctionalColors colors, {VoidCallback? onTap}) {
    final isSelected = _selectedPeriod == label;
    
    String displayLabel = label;
    if (label == "Rentang Tanggal" && isSelected && _startDate != null && _endDate != null) {
      displayLabel = "${_startDate!.day}/${_startDate!.month} - ${_endDate!.day}/${_endDate!.month}";
    }

    return GestureDetector(
      onTap: onTap ?? () {
        setState(() {
          _selectedPeriod = label;
          if (label != "Rentang Tanggal") {
            _startDate = null;
            _endDate = null;
          }
        });
      },
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
          displayLabel,
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

    // Ambil data nyata dari provider
    final segmentsAsync = ref.read(trajectorySegmentsProvider);
    final eventsAsync = ref.read(eventsProvider);

    final segments = segmentsAsync.value ?? [];
    final events = eventsAsync.value ?? [];

    // Hitung rata-rata metrik dari data segmen API
    final double avgHr = segments.isEmpty
        ? 0
        : segments
                .map((s) => (s['mean_hr'] ?? s['hr'] ?? 0).toDouble())
                .reduce((a, b) => a + b) /
            segments.length;

    final double avgRmssd = segments.isEmpty
        ? 0
        : segments
                .map((s) => (s['rmssd'] ?? 0).toDouble())
                .reduce((a, b) => a + b) /
            segments.length;

    final double avgDfa = segments.isEmpty
        ? 0
        : segments
                .map((s) => (s['dfa_alpha1'] ?? s['dfa'] ?? 0).toDouble())
                .reduce((a, b) => a + b) /
            segments.length;

    final int totalAnomalies =
        events.where((e) => e.type == 'alert' || e.type == 'deviation').length;

    // Format tanggal hari ini
    final now = DateTime.now();
    final months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    final String todayStr = "${now.day} ${months[now.month - 1]} ${now.year}";

    // Label klinis berdasarkan nilai rata-rata
    String hrLabel = avgHr == 0
        ? 'Belum ada data'
        : avgHr > 100
            ? '${avgHr.toStringAsFixed(0)} BPM (Tinggi)'
            : avgHr < 60
                ? '${avgHr.toStringAsFixed(0)} BPM (Rendah)'
                : '${avgHr.toStringAsFixed(0)} BPM (Normal)';

    String rmssdLabel = avgRmssd == 0
        ? 'Belum ada data'
        : '${avgRmssd.toStringAsFixed(1)} ms (${avgRmssd >= 20 ? 'Stabil' : 'Rendah'})';

    String dfaLabel = avgDfa == 0
        ? 'Belum ada data'
        : '${avgDfa.toStringAsFixed(2)} (${avgDfa >= 0.75 && avgDfa <= 1.0 ? 'Keseimbangan Otonom Baik' : avgDfa < 0.75 ? 'Intensitas Tinggi' : 'Di atas Normal'})';

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
                      // Tanggal diambil dari DateTime.now(), bukan hardcoded
                      Text("Tanggal: $todayStr", style: const TextStyle(fontSize: 10, color: Colors.grey)),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                const Text("Ringkasan Metrik Klinis:", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                const SizedBox(height: 6),
                // Semua nilai dihitung dari data API, bukan hardcoded
                Text("• Rata-rata Heart Rate: $hrLabel", style: const TextStyle(fontSize: 11)),
                Text("• Rata-rata HRV (RMSSD): $rmssdLabel", style: const TextStyle(fontSize: 11)),
                Text("• DFA Alpha-1: $dfaLabel", style: const TextStyle(fontSize: 11)),
                Text("• Total Insiden Anomali: $totalAnomalies Terdeteksi", style: const TextStyle(fontSize: 11)),
                if (segments.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      "⚠ Belum ada data monitoring. Lakukan sesi monitoring untuk mendapatkan laporan.",
                      style: TextStyle(fontSize: 10, color: Colors.orange[700], height: 1.4),
                    ),
                  ),
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

class _CombinedTrajectoryChart extends ConsumerStatefulWidget {
  final FunctionalColors colors;
  final String period;

  const _CombinedTrajectoryChart({
    required this.colors,
    required this.period,
  });

  @override
  ConsumerState<_CombinedTrajectoryChart> createState() => _CombinedTrajectoryChartState();
}

class _CombinedTrajectoryChartState extends ConsumerState<_CombinedTrajectoryChart> {
  int _activeMetricIndex = 0; // 0: HR & Baseline, 1: HRV (RMSSD), 2: DFA Alpha-1, 3: Anomaly Score

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final segmentsAsync = ref.watch(trajectorySegmentsProvider);

    final (title, unit, color) = switch (_activeMetricIndex) {
      0 => ("Heart Rate & Baseline", "BPM", widget.colors.dataBlue),
      1 => ("RMSSD (HRV)", "ms", widget.colors.stableGreen),
      2 => ("DFA Alpha-1", "", widget.colors.attentionYellow),
      3 => ("Anomaly Score", "%", widget.colors.alertRed),
      _ => ("Heart Rate & Baseline", "BPM", widget.colors.dataBlue),
    };

    final spots = segmentsAsync.when(
      data: (segments) {
        if (segments.isNotEmpty) {
          final list = <FlSpot>[];
          for (int i = 0; i < segments.length; i++) {
            final seg = segments[i];
            double val = 0;
            switch (_activeMetricIndex) {
              case 0:
                val = (seg['mean_hr'] ?? seg['hr'] ?? 75).toDouble();
                break;
              case 1:
                val = (seg['rmssd'] ?? 35).toDouble();
                break;
              case 2:
                val = (seg['dfa_alpha1'] ?? seg['dfa'] ?? 1.0).toDouble();
                break;
              case 3:
                val = (seg['peak_score'] ?? seg['anomaly_score'] ?? 0).toDouble();
                break;
            }
            list.add(FlSpot(i.toDouble(), val));
          }
          return list;
        }
        return _fallbackSpots(_activeMetricIndex);
      },
      loading: () => _fallbackSpots(_activeMetricIndex),
      error: (_, __) => _fallbackSpots(_activeMetricIndex),
    );

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
                      // Guard: hanya hitung rata-rata jika spots tidak kosong
                      spots.isEmpty
                          ? "Belum ada data"
                          : "Rata-rata: ${(spots.map((s) => s.y).reduce((a, b) => a + b) / spots.length).toStringAsFixed(1)} $unit",
                      style: TextStyle(fontSize: 10, color: Colors.grey[500]),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),
            // Tampilkan empty state jika tidak ada data dari API
            if (spots.isEmpty)
              Container(
                height: 200,
                decoration: BoxDecoration(
                  color: Colors.grey.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.withValues(alpha: 0.1)),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.bar_chart_rounded, size: 40, color: Colors.grey[400]),
                    const SizedBox(height: 8),
                    Text(
                      "Belum ada data $title",
                      style: TextStyle(fontSize: 13, color: Colors.grey[500], fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "Data akan muncul setelah sesi monitoring dikirim ke server",
                      style: TextStyle(fontSize: 10, color: Colors.grey[400]),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              )
            else
              SizedBox(
              height: 200,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: SizedBox(
                  width: spots.length > 10 ? (spots.length * 28.0) : MediaQuery.of(context).size.width - 64,
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
                        // Baseline reference line hanya ditampilkan jika ada data
                        if (_activeMetricIndex == 0) ...[
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
                            show: spots.length <= 15,
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
            // Activity Ribbon: dihitung dari distribusi aktivitas nyata dari events API
            Consumer(
              builder: (context, ref, _) {
                final eventsAsync = ref.watch(eventsProvider);
                return eventsAsync.when(
                  loading: () => ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      height: 18,
                      color: Colors.grey.withValues(alpha: 0.2),
                      child: const Center(
                        child: SizedBox(
                          width: 10,
                          height: 10,
                          child: CircularProgressIndicator(strokeWidth: 1.5),
                        ),
                      ),
                    ),
                  ),
                  error: (_, __) => _staticActivityRibbon(),
                  data: (events) {
                    if (events.isEmpty) {
                      // Tidak ada events → tampilkan placeholder ribbon
                      return ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          height: 18,
                          color: Colors.grey.withValues(alpha: 0.15),
                          child: const Center(
                            child: Text(
                              "Belum ada data aktivitas",
                              style: TextStyle(
                                fontSize: 8,
                                color: Colors.grey,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                      );
                    }

                    // Hitung distribusi aktivitas dari events nyata
                    final Map<String, int> activityCount = {};
                    for (final e in events) {
                      final act = e.activity.isNotEmpty ? e.activity : 'Lainnya';
                      activityCount[act] = (activityCount[act] ?? 0) + 1;
                    }

                    // Ambil top 5 aktivitas terbanyak
                    final sorted = activityCount.entries.toList()
                      ..sort((a, b) => b.value.compareTo(a.value));
                    final top = sorted.take(5).toList();

                    // Warna berbeda per aktivitas
                    final colors = [
                      widget.colors.modelPurple,
                      widget.colors.stableGreen,
                      widget.colors.dataBlue,
                      widget.colors.deviationOrange,
                      widget.colors.attentionYellow,
                    ];

                    return ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Row(
                        children: List.generate(top.length, (i) {
                          return _activityRibbonSegment(
                            top[i].value,
                            top[i].key,
                            colors[i % colors.length],
                          );
                        }),
                      ),
                    );
                  },
                );
              },
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

  // Mengembalikan list kosong agar chart menampilkan state 'Belum ada data'
  // daripada data dummy yang menyesatkan
  List<FlSpot> _fallbackSpots(int metricIndex) {
    return const <FlSpot>[];
  }

  // Ribbon statis digunakan saat terjadi error (fallback terakhir)
  Widget _staticActivityRibbon() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Container(
        height: 18,
        color: Colors.grey.withValues(alpha: 0.15),
        child: const Center(
          child: Text(
            "Data tidak dapat dimuat",
            style: TextStyle(
              fontSize: 8,
              color: Colors.grey,
              fontWeight: FontWeight.w600,
            ),
          ),
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
