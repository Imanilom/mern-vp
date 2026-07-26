import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/functional_colors.dart';
import '../../core/theme/htm_colors.dart';
import '../../core/theme/htm_typography.dart';
import '../../core/network/api_client.dart';
import '../activity/symptom_bottom_sheet.dart';

class AlertsPage extends ConsumerWidget {
  const AlertsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors =
        Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;
    final htmColors = HtmColors.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final eventsAsync = ref.watch(eventsProvider);
    final profileAsync = ref.watch(profileProvider);

    final latestEvent = eventsAsync.value?.firstOrNull;
    final eventTitle = latestEvent?.title ?? "Trajectory Deviation";
    final eventActivity = latestEvent?.activity ?? "Aktivitas Umum";
    final magnitudeStr = latestEvent != null ? "${latestEvent.magnitude.toStringAsFixed(1)} SD" : "2.4 SD";
    final durationStr = latestEvent != null ? "${latestEvent.durationMinutes} mnt" : "11 mnt";
    final recoveryStr = latestEvent?.recoveryStatus ?? "Belum";

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 80,
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: Container(
          margin: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(10),
          ),
          child: IconButton(
            icon: const Icon(Icons.arrow_back_rounded, color: Colors.white, size: 18),
            padding: EdgeInsets.zero,
            onPressed: () {
              if (Navigator.of(context).canPop()) {
                Navigator.of(context).pop();
              } else {
                context.go('/home');
              }
            },
            tooltip: "Kembali",
          ),
        ),
        flexibleSpace: Container(
          decoration: BoxDecoration(
            color: htmColors.surface,
            border: Border(bottom: BorderSide(color: htmColors.hairline, width: 1)),
          ),
        ),
        foregroundColor: htmColors.ink,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.warning_amber_rounded,
                  color: Colors.white, size: 20),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  eventTitle,
                  style: HtmTypography.titleMedium?.copyWith(color: htmColors.ink),
                ),
                Text(
                  "Status Real-time • $eventActivity",
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.white.withValues(alpha: 0.75),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 100),
        children: [
                // Narrative description
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: htmColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: htmColors.hairline, width: 1),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        "Penjelasan Perubahan Trajectory",
                        style: TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 14),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        latestEvent?.description ??
                            "Terjadi peningkatan heart rate yang signifikan di atas rentang baseline aktivitas Anda. Sistem mendeteksi perubahan pola ini dari analisis trajectory jangka pendek.",
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark ? Colors.grey[400] : Colors.grey[700],
                          height: 1.55,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 12),

                // Detail metrics row
                Row(
                  children: [
                    _DetailBadge(
                        label: "Magnitude",
                        value: magnitudeStr,
                        icon: Icons.straighten_rounded,
                        color: colors.deviationOrange),
                    const SizedBox(width: 10),
                    _DetailBadge(
                        label: "Durasi",
                        value: durationStr,
                        icon: Icons.timer_outlined,
                        color: colors.attentionYellow),
                    const SizedBox(width: 10),
                    _DetailBadge(
                        label: "Recovery",
                        value: recoveryStr,
                        icon: Icons.sync_problem_rounded,
                        color: colors.alertRed),
                  ],
                ),

                const SizedBox(height: 24),

                const Text(
                  "Bagaimana kondisi Anda saat ini?",
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                ),
                const SizedBox(height: 12),

                // Action buttons
                _ResponseButton(
                  label: "Saya merasa baik-baik saja",
                  icon: Icons.sentiment_satisfied_alt_rounded,
                  color: colors.stableGreen,
                  primary: true,
                  onTap: () async {
                    if (latestEvent != null) {
                      await ref.read(apiClientProvider).updateEventStatus(latestEvent.id, 'Closed');
                      ref.invalidate(eventsProvider);
                    }
                    if (context.mounted) {
                      _respond(context, "Tanggapan berhasil dikirim ke server");
                    }
                  },
                ),
                const SizedBox(height: 10),
                _ResponseButton(
                  label: "Tambahkan Gejala yang Dirasakan",
                  icon: Icons.add_alert_outlined,
                  color: colors.dataBlue,
                  primary: false,
                  onTap: () => showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => const SymptomBottomSheet(),
                  ),
                ),
                const SizedBox(height: 10),
                _ResponseButton(
                  label: "Istirahat & Ukur Ulang (15 mnt)",
                  icon: Icons.self_improvement_rounded,
                  color: colors.attentionYellow,
                  primary: false,
                  onTap: () =>
                      _respond(context, "Pengingat istirahat diaktifkan (15 menit)"),
                ),
                const SizedBox(height: 10),
                _ResponseButton(
                  label: "Hubungi Petugas Penelitian",
                  icon: Icons.phone_outlined,
                  color: colors.alertRed,
                  primary: false,
                  onTap: () {
                    final staffContact = profileAsync.value?.staffContact ?? "+62 812-3456-7890";
                    _respond(context, "Menghubungi petugas: $staffContact...");
                  },
                ),
                const SizedBox(height: 10),
                _ResponseButton(
                  label: "Tandai sebagai False Alarm",
                  icon: Icons.flag_outlined,
                  color: colors.inactiveGrey,
                  primary: false,
                  onTap: () => _confirmFalseAlarm(context, ref, latestEvent?.id),
                ),

                const SizedBox(height: 28),

                // Disclaimer
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isDark
                        ? Colors.grey.withValues(alpha: 0.08)
                        : Colors.grey.withValues(alpha: 0.07),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.info_outline_rounded,
                          size: 18, color: Colors.grey[500]),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          "Informasi ini bersumber dari analisis sistem, bukan diagnosis medis. Untuk peringatan risiko tinggi, segera ikuti prosedur yang ditentukan tenaga medis atau penyelenggara studi.",
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey[600],
                            height: 1.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
        ],
      ),
    );
  }

  void _respond(BuildContext context, String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        behavior: SnackBarBehavior.floating,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  void _confirmFalseAlarm(BuildContext context, WidgetRef ref, String? eventId) {
    HapticFeedback.mediumImpact();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text("Tandai False Alarm?",
            style: TextStyle(fontWeight: FontWeight.w500, fontSize: 16)),
        content: const Text(
          "Peringatan ini akan ditandai sebagai false alarm dan dikirim ke tim penelitian untuk ditinjau. Data monitoring Anda tetap tersimpan.",
          style: TextStyle(fontSize: 13, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Batal"),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () async {
              HapticFeedback.lightImpact();
              Navigator.pop(ctx);
              if (eventId != null && eventId.isNotEmpty) {
                final client = ref.read(apiClientProvider);
                await client.validateEvent(eventId, false);
                await client.updateEventStatus(eventId, 'Closed');
                ref.invalidate(eventsProvider);
              }
              if (context.mounted) {
                _respond(context, "✓ Ditandai sebagai false alarm di server.");
              }
            },
            child: const Text("Ya, Tandai"),
          ),
        ],
      ),
    );
  }
}

class _DetailBadge extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _DetailBadge({
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
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E293B) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: isDark
              ? []
              : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(height: 6),
            Text(
              value,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(fontSize: 10, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }
}

class _ResponseButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final bool primary;
  final VoidCallback onTap;

  const _ResponseButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.primary,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
        decoration: BoxDecoration(
          color: primary
              ? color
              : (isDark ? const Color(0xFF1E293B) : Colors.white),
          borderRadius: BorderRadius.circular(16),
          border: primary
              ? null
              : Border.all(color: Colors.grey.withValues(alpha: 0.15), width: 1.5),
          boxShadow: primary
              ? [
                  BoxShadow(
                    color: color.withValues(alpha: 0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ]
              : [],
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: primary
                    ? Colors.white.withValues(alpha: 0.25)
                    : color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon,
                  color: primary ? Colors.white : color, size: 18),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: primary ? Colors.white : null,
                ),
              ),
            ),
            Icon(
              Icons.arrow_forward_ios_rounded,
              size: 13,
              color: primary
                  ? Colors.white.withValues(alpha: 0.7)
                  : Colors.grey[400],
            ),
          ],
        ),
      ),
    );
  }
}
