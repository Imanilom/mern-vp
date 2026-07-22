import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/functional_colors.dart';
import '../../core/theme/htm_colors.dart';
import '../../core/theme/htm_typography.dart';
import '../../core/ble/mock_ble_service.dart';
import '../../core/storage/offline_buffer_service.dart';
import '../../shared/models/models.dart';
import '../../shared/widgets/device_status_indicator.dart';
import '../activity/symptom_bottom_sheet.dart';
import '../../core/providers/activity_provider.dart';

class MonitoringPage extends ConsumerStatefulWidget {
  const MonitoringPage({super.key});

  @override
  ConsumerState<MonitoringPage> createState() => _MonitoringPageState();
}

class _MonitoringPageState extends ConsumerState<MonitoringPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final List<FlSpot> _hrSpots = [];
  final List<FlSpot> _rrSpots = [];
  final List<FlSpot> _rmssdSpots = [];
  final List<FlSpot> _dfaSpots = [];
  double _xValue = 0;
  bool _isMonitoring = true;
  SensorReading? _lastReading;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    // Tab switch tidak perlu rebuild seluruh halaman
    _tabController.addListener(() {
      if (_tabController.indexIsChanging) setState(() {});
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _addReading(SensorReading reading) {
    if (!_isMonitoring) return;
    _xValue += 1;
    const maxPoints = 20;
    if (_hrSpots.length >= maxPoints) {
      _hrSpots.removeAt(0);
      _rrSpots.removeAt(0);
      _rmssdSpots.removeAt(0);
      _dfaSpots.removeAt(0);
    }
    _hrSpots.add(FlSpot(_xValue, reading.heartRate.toDouble()));
    _rrSpots.add(FlSpot(_xValue, reading.rrInterval.toDouble()));
    _rmssdSpots.add(FlSpot(_xValue, reading.rmssd));
    _dfaSpots.add(FlSpot(_xValue, reading.dfaAlpha1));
  }



  @override
  Widget build(BuildContext context) {
    final colors =
        Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;
    final htmColors = HtmColors.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bufferService = ref.watch(offlineBufferProvider);
    final bleService = ref.watch(bleServiceProvider);

    // ref.listen: jalankan side-effect tanpa rebuild seluruh widget tree
    ref.listen<AsyncValue<SensorReading>>(currentSensorReadingProvider,
        (_, next) {
      next.whenData((reading) {
        if (_isMonitoring) {
          setState(() {
            _lastReading = reading;
            _addReading(reading);
          });
        }
      });
    });

    final tabTitles = [
      ("Heart Rate", "BPM"),
      ("RR Interval", "ms"),
      ("RMSSD (HRV)", "ms"),
      ("DFA Alpha-1", ""),
      ("Motion", "state"),
    ];

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
              "Monitoring Real-time",
              style: HtmTypography.titleMedium?.copyWith(color: htmColors.ink),
            ),
            Row(
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: (!bleService.isConnected)
                        ? Colors.grey
                        : (_isMonitoring
                            ? colors.stableGreen
                            : colors.inactiveGrey),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  !bleService.isConnected
                      ? "BELUM TERHUBUNG"
                      : (_isMonitoring
                          ? "LIVE • ${bleService.deviceName}"
                          : "PAUSED • ${bleService.deviceName}"),
                  style: HtmTypography.labelSmall.copyWith(color: htmColors.muted),
                ),
              ],
            ),
          ],
        ),
        actions: [
          Container(
            width: 36,
            height: 36,
            margin: const EdgeInsets.only(right: 12),
            decoration: BoxDecoration(
              color: htmColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: htmColors.hairline, width: 1),
            ),
            child: IconButton(
              onPressed: () => context.go('/alerts'),
              icon: Icon(Icons.notifications_none_rounded, color: htmColors.ink, size: 18),
              padding: EdgeInsets.zero,
              tooltip: "Peringatan",
            ),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          indicatorColor: htmColors.primary,
          indicatorWeight: 3,
          indicatorSize: TabBarIndicatorSize.label,
          dividerColor: Colors.transparent,
          labelColor: htmColors.ink,
          unselectedLabelColor: htmColors.muted,
          labelStyle: const TextStyle(
              fontWeight: FontWeight.w700, fontSize: 13),
          tabs: tabTitles
              .map((t) => Tab(text: t.$1))
              .toList(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            if (!bleService.isConnected) ...[
              const SizedBox(height: 40),
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      colors.deviationOrange.withValues(alpha: 0.12),
                      colors.deviationOrange.withValues(alpha: 0.03),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                      color: colors.deviationOrange.withValues(alpha: 0.25),
                      width: 1.5),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: colors.deviationOrange.withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.bluetooth_disabled_rounded,
                          color: colors.deviationOrange, size: 48),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      "Sensor Polar H10 Belum Terhubung",
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      "Untuk memulai monitoring denyut jantung secara real-time, harap hubungkan sensor dada Bluetooth Anda terlebih dahulu.",
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, color: Colors.grey, height: 1.5),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      onPressed: () => context.go('/profile'),
                      icon: const Icon(Icons.bluetooth_searching_rounded),
                      label: const Text("Hubungkan Sensor di Profil"),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: colors.dataBlue,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ],
                ),
              ),
            ] else ...[
              // Live Chart
              Container(
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E293B) : Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: isDark
                      ? []
                      : [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            tabTitles[_tabController.index].$1,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 15),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: _isMonitoring
                                  ? colors.stableGreen.withValues(alpha: 0.1)
                                  : Colors.grey.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 6,
                                  height: 6,
                                  decoration: BoxDecoration(
                                    color: _isMonitoring
                                        ? colors.stableGreen
                                        : Colors.grey,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  _isMonitoring ? "LIVE" : "PAUSED",
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: _isMonitoring
                                        ? colors.stableGreen
                                        : Colors.grey,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 12, 16, 16),
                      child: SizedBox(
                        height: 180,
                        child: LineChart(
                          LineChartData(
                            gridData: FlGridData(
                              show: true,
                              drawVerticalLine: false,
                              getDrawingHorizontalLine: (v) => FlLine(
                                color: Colors.grey.withValues(alpha: 0.1),
                                strokeWidth: 1,
                              ),
                            ),
                            titlesData: FlTitlesData(
                              leftTitles: AxisTitles(
                                sideTitles: SideTitles(
                                  showTitles: true,
                                  reservedSize: 34,
                                  getTitlesWidget: (v, m) => Text(
                                    v.toInt().toString(),
                                    style: TextStyle(
                                        fontSize: 9, color: Colors.grey[500]),
                                  ),
                                ),
                              ),
                              bottomTitles: const AxisTitles(
                                  sideTitles:
                                      SideTitles(showTitles: false)),
                              rightTitles: const AxisTitles(
                                  sideTitles:
                                      SideTitles(showTitles: false)),
                              topTitles: const AxisTitles(
                                  sideTitles:
                                      SideTitles(showTitles: false)),
                            ),
                            borderData: FlBorderData(show: false),
                            lineBarsData: [
                              LineChartBarData(
                                spots: _getSpotsForTab(_tabController.index),
                                isCurved: true,
                                curveSmoothness: 0.35,
                                color: colors.dataBlue,
                                barWidth: 2.5,
                                isStrokeCapRound: true,
                                dotData: const FlDotData(show: false),
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
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Quality metrics
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E293B) : Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: isDark
                      ? []
                      : [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      "Kualitas Data & Ingestion",
                      style: TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 14),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _QualityCell(
                            "Kualitas Sinyal",
                            bleService.isConnected
                                ? "${_lastReading?.signalQuality ?? bleService.signalQuality}%"
                                : "--%",
                            bleService.isConnected ? colors.stableGreen : Colors.grey),
                        _QualityCell(
                            "Missing Data",
                            bleService.isConnected ? "0.0%" : "--%",
                            bleService.isConnected ? colors.stableGreen : Colors.grey),
                        _QualityCell(
                            "Baterai Sensor",
                            bleService.isConnected
                                ? "${_lastReading?.battery ?? bleService.batteryLevel}%"
                                : "--%",
                            bleService.isConnected ? colors.stableGreen : Colors.grey),
                      ],
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Divider(
                          color: Colors.grey.withValues(alpha: 0.1)),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _QualityCell("Buffer Antrian",
                            "${bufferService.pendingCount}", colors.dataBlue),
                        _QualityCell(
                            "Sync Terakhir",
                            bleService.isConnected ? "Baru Saja" : "--:--",
                            Colors.grey),
                        _QualityCell(
                            "Belum Terkirim",
                            "${bufferService.pendingCount} rec",
                            colors.dataBlue),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Device indicator
              DeviceStatusIndicator(
                deviceName: bleService.deviceName,
                isConnected: bleService.isConnected,
                batteryLevel: bleService.batteryLevel,
                signalQuality: bleService.signalQuality,
              ),

              const SizedBox(height: 20),

              // Controls
              Row(
                children: [
                  Expanded(
                    child: _ControlButton(
                      label: _isMonitoring ? "Jeda" : "Lanjutkan",
                      icon: _isMonitoring
                          ? Icons.pause_rounded
                          : Icons.play_arrow_rounded,
                      primary: false,
                      colors: colors,
                      onTap: () =>
                          setState(() => _isMonitoring = !_isMonitoring),
                    ),
                  ),
                  const SizedBox(width: 10),
                  // Gap #3: Tombol Stop
                  _StopButton(colors: colors),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: _ControlButton(
                      label: "Tandai Kejadian",
                      icon: Icons.bookmark_add_rounded,
                      primary: true,
                      colors: colors,
                      onTap: () => showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (_) => const SymptomBottomSheet(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: isDark
                          ? const Color(0xFF334155)
                          : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: IconButton(
                      onPressed: () => context.go('/activity'),
                      icon: Icon(
                        Icons.directions_run_rounded,
                        color: Colors.grey[600],
                        size: 22,
                      ),
                      tooltip: "Ubah Aktivitas",
                    ),
                  ),
                ],
              ),
            ]
          ],
          ),
        ),
      );
    }



  List<FlSpot> _getSpotsForTab(int index) {
    switch (index) {
      case 0:
        return _hrSpots;
      case 1:
        return _rrSpots;
      case 2:
        return _rmssdSpots;
      case 3:
        return _dfaSpots;
      default:
        return [];
    }
  }
}

class _QualityCell extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _QualityCell(this.label, this.value, this.color);

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
              fontWeight: FontWeight.w800, fontSize: 16, color: color),
        ),
        const SizedBox(height: 2),
        Text(label,
            style: const TextStyle(fontSize: 10, color: Colors.grey)),
      ],
    );
  }
}

class _ControlButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool primary;
  final FunctionalColors colors;
  final VoidCallback onTap;

  const _ControlButton({
    required this.label,
    required this.icon,
    required this.primary,
    required this.colors,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 52,
        decoration: BoxDecoration(
          color: primary
              ? colors.dataBlue
              : (isDark
                  ? const Color(0xFF334155)
                  : const Color(0xFFF1F5F9)),
          borderRadius: BorderRadius.circular(14),
          boxShadow: primary
              ? [
                  BoxShadow(
                    color: colors.dataBlue.withValues(alpha: 0.3),
                    blurRadius: 14,
                    offset: const Offset(0, 5),
                  ),
                ]
              : [],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon,
                color: primary ? Colors.white : Colors.grey[600],
                size: 18),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: primary ? Colors.white : Colors.grey[700],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Stop Button ─────────────────────────────────────────────────────────────
class _StopButton extends ConsumerWidget {
  final FunctionalColors colors;
  const _StopButton({required this.colors});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: () => _confirmStop(context, ref),
      child: Container(
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          color: colors.alertRed.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: colors.alertRed.withValues(alpha: 0.35), width: 1.5),
        ),
        child: Icon(Icons.stop_rounded, color: colors.alertRed, size: 22),
      ),
    );
  }

  void _confirmStop(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text("Hentikan Monitoring?",
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        content: const Text(
          "Sesi monitoring akan dihentikan dan koneksi sensor dada akan terputus. Data lokal yang tersisa akan disinkronkan ke server.",
          style: TextStyle(fontSize: 13, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Batal"),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: colors.alertRed,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              
              // Disconnect BLE
              await ref.read(bleServiceProvider).disconnect();
              
              // Update home page provider monitoring status
              ref.read(isMonitoringActiveProvider.notifier).state = false;
              
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: const Text("✓ Monitoring dihentikan. Sensor terputus."),
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                );
                context.go('/home');
              }
            },
            child: const Text("Ya, Hentikan"),
          ),
        ],
      ),
    );
  }
}
