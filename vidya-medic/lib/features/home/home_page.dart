import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../core/theme/functional_colors.dart';
import '../../core/theme/htm_colors.dart';
import '../../core/theme/htm_spacing.dart';
import '../../core/theme/htm_typography.dart';
import '../../core/storage/offline_buffer_service.dart';
import '../../core/ble/mock_ble_service.dart';
import '../../core/network/api_client.dart';
import '../../shared/widgets/status_chip.dart';
import '../../shared/widgets/metric_card.dart';
import '../../shared/widgets/mini_trajectory_chart.dart';
import '../activity/symptom_bottom_sheet.dart';
import '../../core/providers/activity_provider.dart';

// Provider: health status saat ini (dihubungkan dengan data events backend)
final healthStatusProvider = Provider<HealthStatusType>((ref) {
  final profileAsync = ref.watch(profileProvider);
  if (profileAsync.value == null) return HealthStatusType.stable;

  final eventsAsync = ref.watch(eventsProvider);
  return eventsAsync.when(
    data: (events) {
      if (events.isEmpty) return HealthStatusType.stable;
      final latestEvent = events.first;
      switch (latestEvent.type) {
        case 'alert':
          return HealthStatusType.alert;
        case 'deviation':
          return HealthStatusType.deviation;
        case 'recovering':
          return HealthStatusType.attention;
        case 'stable':
        default:
          return HealthStatusType.stable;
      }
    },
    loading: () => HealthStatusType.stable,
    error: (_, __) => HealthStatusType.stable,
  );
});

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;
    final bleService = ref.watch(bleServiceProvider);
    final isMonitoring = ref.watch(isMonitoringActiveProvider) && bleService.isConnected;
    final healthStatus = ref.watch(healthStatusProvider);
    final bufferService = ref.watch(offlineBufferProvider);
    final profileAsync = ref.watch(profileProvider);

    final startedTime = ref.watch(activityStartTimeProvider);
    final String startedTimeStr = "${startedTime.hour.toString().padLeft(2, '0')}:${startedTime.minute.toString().padLeft(2, '0')}";

    final String greeting;
    final hour = DateTime.now().hour;
    if (hour >= 4 && hour < 11) {
      greeting = "Selamat pagi";
    } else if (hour >= 11 && hour < 15) {
      greeting = "Selamat siang";
    } else if (hour >= 15 && hour < 18) {
      greeting = "Selamat sore";
    } else {
      greeting = "Selamat malam";
    }

    final htmColors = HtmColors.of(context);

    return Scaffold(
      backgroundColor: htmColors.canvas,
      appBar: AppBar(
        toolbarHeight: 72,
        automaticallyImplyLeading: false,
        backgroundColor: Colors.transparent,
        elevation: 0,
        flexibleSpace: Container(
          decoration: BoxDecoration(
            color: htmColors.surface,
            border: Border(bottom: BorderSide(color: htmColors.hairline, width: 1)),
          ),
        ),
        title: Row(
          children: [
            Image.asset(
              'assets/images/htm_logo_text.png',
              height: 28,
              fit: BoxFit.contain,
              errorBuilder: (context, error, stackTrace) => const SizedBox.shrink(),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  profileAsync.when(
                    data: (profile) => Text(
                      "$greeting, ${profile.name}",
                      style: HtmTypography.titleMedium?.copyWith(color: htmColors.ink),
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                    loading: () => Text(
                      "$greeting, ...",
                      style: HtmTypography.titleMedium?.copyWith(color: htmColors.ink),
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                    error: (_, _) => Text(
                      "$greeting, Peserta",
                      style: HtmTypography.titleMedium?.copyWith(color: htmColors.ink),
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                  ),
                  Text(
                    bleService.isConnected
                        ? "Monitoring aktif sejak $startedTimeStr"
                        : "Sensor belum terhubung",
                    style: HtmTypography.labelSmall.copyWith(color: htmColors.muted),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          _appBarAction(
            context,
            icon: Icons.notifications_none_rounded,
            onTap: () => context.push('/alerts'),
            color: htmColors.surface,
          ),
          const SizedBox(width: 8),
          _appBarAction(
            context,
            icon: Icons.person_outline_rounded,
            onTap: () => context.go('/profile'),
            color: htmColors.surface,
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(profileProvider);
          ref.invalidate(eventsProvider);
          await ref.read(profileProvider.future).catchError((_) => null);
          await ref.read(eventsProvider.future).catchError((_) => null);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          children: [
                  _OfflineSyncBanner(bufferService: bufferService),
                  _HealthStatusCard(colors: colors, status: healthStatus),
                  const SizedBox(height: 16),

                  // Section label
                  _sectionLabel(context, "Parameter Real-time"),
                  const SizedBox(height: 10),

                  // Metric grid — isolated widget, hanya bagian ini yang rebuild tiap sensor tick
                  _LiveMetricGrid(colors: colors),

                  const SizedBox(height: 20),
                  _sectionLabel(context, "Trajectory 6 Jam Terakhir"),
                  const SizedBox(height: 10),

                  const MiniTrajectoryChart(
                    spots: [
                      FlSpot(0, 72),
                      FlSpot(1, 74),
                      FlSpot(2, 70),
                      FlSpot(3, 94),
                      FlSpot(4, 88),
                      FlSpot(5, 75),
                      FlSpot(6, 73),
                    ],
                  ),

                  const SizedBox(height: 20),
                  _sectionLabel(context, "Aksi Cepat"),
                  const SizedBox(height: 10),

                  // Action buttons
                  _QuickActions(
                    colors: colors,
                    isMonitoring: isMonitoring,
                    onToggleMonitoring: () async {
                      if (!bleService.isConnected) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text("Silakan hubungkan sensor Polar H10 terlebih dahulu di Profil"),
                            behavior: SnackBarBehavior.floating,
                          ),
                        );
                        context.go('/profile');
                      } else {
                        final currentVal = ref.read(isMonitoringActiveProvider);
                        if (currentVal) {
                          await ref.read(bleServiceProvider).disconnect();
                          ref.read(isMonitoringActiveProvider.notifier).state = false;
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text("✓ Monitoring dihentikan. Sensor terputus."),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          }
                        } else {
                          ref.read(isMonitoringActiveProvider.notifier).state = true;
                        }
                      }
                    },
                  ),
                ],
        ),
      ),
    );
  }

  Widget _appBarAction(BuildContext context, {required IconData icon, required VoidCallback onTap, required Color color}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: HtmColors.of(context).hairline, width: 1),
        ),
        child: Icon(icon, color: HtmColors.of(context).ink, size: 20),
      ),
    );
  }

  Widget _sectionLabel(BuildContext context, String label) {
    return Text(
      label,
      style: HtmTypography.titleMedium?.copyWith(color: HtmColors.of(context).ink),
    );
  }
}

class _HealthStatusCard extends StatelessWidget {
  final FunctionalColors colors;
  final HealthStatusType status;

  const _HealthStatusCard({required this.colors, required this.status});

  @override
  Widget build(BuildContext context) {
    // Mapping dinamis per status
    final config = switch (status) {
      HealthStatusType.stable => (
          borderColor: colors.stableGreen,
          gradientColor: colors.stableGreen,
          icon: Icons.check_circle_rounded,
          iconColor: colors.stableGreen,
          title: "Kondisi Stabil",
          subtitle: "Tidak ada deviasi terdeteksi",
          description:
              "Tidak ditemukan deviasi atau perubahan yang memerlukan perhatian medis saat ini. Sesuai baseline aktivitas duduk bekerja.",
        ),
      HealthStatusType.attention => (
          borderColor: colors.attentionYellow,
          gradientColor: colors.attentionYellow,
          icon: Icons.warning_amber_rounded,
          iconColor: colors.attentionYellow,
          title: "Perlu Perhatian",
          subtitle: "Terdapat perubahan ringan",
          description:
              "Terdeteksi perubahan pola heart rate di atas rentang baseline. Sistem sedang memantau lebih saksama.",
        ),
      HealthStatusType.deviation => (
          borderColor: colors.deviationOrange,
          gradientColor: colors.deviationOrange,
          icon: Icons.warning_rounded,
          iconColor: colors.deviationOrange,
          title: "Deviasi Terdeteksi",
          subtitle: "Terdapat penyimpangan data",
          description:
              "Terdeteksi penyimpangan data dari personalized baseline Anda. Harap kurangi intensitas aktivitas.",
        ),
      HealthStatusType.alert => (
          borderColor: colors.alertRed,
          gradientColor: colors.alertRed,
          icon: Icons.error_rounded,
          iconColor: colors.alertRed,
          title: "Anomali Terdeteksi",
          subtitle: "Diperlukan tindakan segera",
          description:
              "Terjadi deviasi signifikan dari baseline Anda. Periksa peringatan dan ikuti prosedur yang ditentukan.",
        ),
      HealthStatusType.noData => (
          borderColor: colors.inactiveGrey,
          gradientColor: colors.inactiveGrey,
          icon: Icons.hourglass_empty_rounded,
          iconColor: colors.inactiveGrey,
          title: "Data Belum Cukup",
          subtitle: "Sedang mengumpulkan data",
          description:
              "Sistem sedang membangun baseline Anda. Tetap kenakan sensor dan lanjutkan aktivitas normal.",
        ),
    };

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            config.gradientColor.withValues(alpha: 0.08),
            config.gradientColor.withValues(alpha: 0.03),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
            color: config.borderColor.withValues(alpha: 0.25), width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "STATUS KONDISI SAAT INI",
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                    color: Colors.grey[500],
                  ),
                ),
                StatusChip(status: status),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: config.iconColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(config.icon, color: config.iconColor, size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        config.title,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: config.iconColor,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        config.subtitle,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: config.gradientColor.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                config.description,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[700],
                  height: 1.5,
                ),
              ),
            ),
            const SizedBox(height: 12),
            GestureDetector(
              onTap: () => context.push('/alerts'),
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: colors.deviationOrange,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    "1 deviasi lama belum ditindaklanjuti",
                    style: TextStyle(
                      fontSize: 12,
                      color: colors.deviationOrange,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(Icons.arrow_forward_ios_rounded,
                      size: 11, color: colors.deviationOrange),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MetricGridSkeleton extends StatelessWidget {
  const _MetricGridSkeleton();

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      childAspectRatio: 1.5,
      children: List.generate(
        6,
        (index) => Container(
          decoration: BoxDecoration(
            color: Colors.grey.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
          ),
        ),
      ),
    );
  }
}

class _QuickActions extends ConsumerWidget {
  final FunctionalColors colors;
  final bool isMonitoring;
  final VoidCallback onToggleMonitoring;

  const _QuickActions({
    required this.colors,
    required this.isMonitoring,
    required this.onToggleMonitoring,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      children: [
        // Baris 1: Mulai/Hentikan Monitoring (prominent)
        GestureDetector(
          onTap: onToggleMonitoring,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            height: 52,
            width: double.infinity,
            decoration: BoxDecoration(
              color: isMonitoring
                  ? colors.alertRed.withValues(alpha: 0.1)
                  : colors.stableGreen,
              borderRadius: BorderRadius.circular(14),
              border: isMonitoring
                  ? Border.all(
                      color: colors.alertRed.withValues(alpha: 0.4), width: 1.5)
                  : null,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  isMonitoring
                      ? Icons.pause_circle_outline_rounded
                      : Icons.play_circle_outline_rounded,
                  color: isMonitoring ? colors.alertRed : Colors.white,
                  size: 22,
                ),
                const SizedBox(width: 8),
                Text(
                  isMonitoring ? "Hentikan Monitoring" : "Mulai Monitoring",
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: isMonitoring ? colors.alertRed : Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        // Baris 2: Aksi lainnya
        Row(
          children: [
            Expanded(
              child: _quickActionBtn(
                context: context,
                label: "Ubah Aktivitas",
                icon: Icons.edit_calendar_rounded,
                primary: true,
                colors: colors,
                onTap: () => context.go('/activity'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _quickActionBtn(
                context: context,
                label: "Tambah Gejala",
                icon: Icons.add_alert_outlined,
                primary: false,
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
                color: colors.dataBlue.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14),
              ),
              child: IconButton(
                onPressed: () async {
                  HapticFeedback.mediumImpact();
                  final buffer = ref.read(offlineBufferProvider);
                  if (buffer.pendingCount == 0) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text("Semua data sudah sinkron"),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                    return;
                  }
                  
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text("Sedang menyinkronkan data..."),
                      behavior: SnackBarBehavior.floating,
                      duration: Duration(seconds: 1),
                    ),
                  );
                  
                  await buffer.syncPendingData();
                  
                  if (context.mounted) {
                    HapticFeedback.lightImpact();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: const Text("Data berhasil disinkronisasi ke server"),
                        behavior: SnackBarBehavior.floating,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                    );
                  }
                },
                icon:
                    Icon(Icons.sync_rounded, color: colors.dataBlue, size: 22),
                tooltip: "Sinkronkan Data",
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _quickActionBtn({
    required BuildContext context,
    required String label,
    required IconData icon,
    required bool primary,
    required FunctionalColors colors,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 52,
        decoration: BoxDecoration(
          color: primary ? colors.dataBlue : Colors.transparent,
          borderRadius: BorderRadius.circular(14),
          border: primary
              ? null
              : Border.all(
                  color: colors.dataBlue.withValues(alpha: 0.3), width: 1.5),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon,
                color: primary ? Colors.white : colors.dataBlue, size: 18),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: primary ? Colors.white : colors.dataBlue,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Widget terpisah: hanya grid ini yang rebuild tiap sensor tick ───────────
class _LiveMetricGrid extends ConsumerWidget {
  final FunctionalColors colors;
  const _LiveMetricGrid({required this.colors});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bleService = ref.watch(bleServiceProvider);
    final activeActivity = ref.watch(activeActivityProvider);

    if (!bleService.isConnected) {
      return GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.5,
        children: [
          MetricCard(
            title: "Heart Rate",
            value: "--",
            unit: "BPM",
            icon: Icons.favorite_border_rounded,
            color: Colors.grey,
          ),
          MetricCard(
            title: "RR Interval",
            value: "--",
            unit: "ms",
            icon: Icons.graphic_eq_rounded,
            color: Colors.grey,
          ),
          MetricCard(
            title: "RMSSD (HRV)",
            value: "--",
            unit: "ms",
            icon: Icons.timeline_rounded,
            color: Colors.grey,
          ),
          MetricCard(
            title: "DFA Alpha-1",
            value: "--",
            unit: "",
            icon: Icons.show_chart_rounded,
            color: Colors.grey,
          ),
          MetricCard(
            title: "Aktivitas",
            value: activeActivity.name,
            unit: "",
            icon: Icons.directions_walk_rounded,
            color: Colors.grey,
          ),
          MetricCard(
            title: "Kualitas Sinyal",
            value: "--",
            unit: "%",
            icon: Icons.wifi_tethering_rounded,
            color: Colors.grey,
          ),
        ],
      );
    }

    final sensorAsync = ref.watch(currentSensorReadingProvider);
    return sensorAsync.when(
      data: (reading) => GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.5,
        children: [
          MetricCard(
            title: "Heart Rate",
            value: "${reading.heartRate}",
            unit: "BPM",
            icon: Icons.favorite_rounded,
            color: colors.dataBlue,
            trend: "+2",
          ),
          MetricCard(
            title: "RR Interval",
            value: "${reading.rrInterval}",
            unit: "ms",
            icon: Icons.graphic_eq_rounded,
            color: colors.dataBlue,
          ),
          MetricCard(
            title: "RMSSD (HRV)",
            value: "${reading.rmssd}",
            unit: "ms",
            icon: Icons.timeline_rounded,
            color: colors.stableGreen,
            trend: "Normal",
            trendPositive: true,
          ),
          MetricCard(
            title: "DFA Alpha-1",
            value: "${reading.dfaAlpha1}",
            unit: "",
            icon: Icons.show_chart_rounded,
            color: colors.stableGreen,
          ),
          MetricCard(
            title: "Aktivitas",
            value: reading.motionState,
            unit: "",
            icon: Icons.directions_walk_rounded,
            color: colors.dataBlue,
          ),
          MetricCard(
            title: "Kualitas Sinyal",
            value: "${reading.signalQuality}",
            unit: "%",
            icon: Icons.wifi_tethering_rounded,
            color: colors.stableGreen,
            trendPositive: true,
          ),
        ],
      ),
      loading: () => const _MetricGridSkeleton(),
      error: (_, _) => const SizedBox(),
    );
  }
}

class _OfflineSyncBanner extends StatefulWidget {
  final OfflineBufferService bufferService;
  const _OfflineSyncBanner({required this.bufferService});

  @override
  State<_OfflineSyncBanner> createState() => _OfflineSyncBannerState();
}

class _OfflineSyncBannerState extends State<_OfflineSyncBanner> {
  bool _isSyncing = false;

  @override
  Widget build(BuildContext context) {
    final pendingCount = widget.bufferService.pendingCount;
    if (pendingCount == 0 && !_isSyncing) return const SizedBox.shrink();

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: HtmColors.attention.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: HtmColors.attention.withValues(alpha: 0.3),
          width: 1.0,
        ),
      ),
      child: Row(
        children: [
          Icon(
            _isSyncing ? Icons.sync : Icons.cloud_off_rounded,
            color: HtmColors.attention,
            size: 18,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              _isSyncing
                  ? "Menyinkronkan data..."
                  : "$pendingCount data tersimpan offline",
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: HtmColors.inkLight,
              ),
            ),
          ),
          if (!_isSyncing)
            TextButton(
              onPressed: () async {
                HapticFeedback.mediumImpact();
                setState(() => _isSyncing = true);
                await widget.bufferService.syncPendingData();
                if (context.mounted) {
                  setState(() => _isSyncing = false);
                  HapticFeedback.lightImpact();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: const Text("Data berhasil disinkronisasi ke server"),
                      behavior: SnackBarBehavior.floating,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  );
                }
              },
              style: TextButton.styleFrom(
                foregroundColor: HtmColors.attention,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text("Sinkronkan"),
            )
          else
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: HtmColors.attention,
              ),
            ),
        ],
      ),
    );
  }
}
