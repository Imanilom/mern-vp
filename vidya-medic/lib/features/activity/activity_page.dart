import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/functional_colors.dart';
import '../../core/theme/htm_colors.dart';
import '../../core/theme/htm_typography.dart';
import '../../core/network/api_client.dart';
import '../../shared/models/models.dart';
import '../../shared/widgets/activity_selector.dart';
import 'symptom_bottom_sheet.dart';
import '../../core/providers/activity_provider.dart';
import '../../core/ble/mock_ble_service.dart';

class ActivityPage extends ConsumerStatefulWidget {
  const ActivityPage({super.key});

  @override
  ConsumerState<ActivityPage> createState() => _ActivityPageState();
}

class _ActivityPageState extends ConsumerState<ActivityPage> {
  Timer? _liveTimer;

  @override
  void initState() {
    super.initState();
    // Live timer: update setiap detik agar durasi berjalan real-time
    _liveTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _liveTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors =
        Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;
    final htmColors = HtmColors.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final apiClient = ref.watch(apiClientProvider);

    final activeActivity = ref.watch(activeActivityProvider);
    final startedTime = ref.watch(activityStartTimeProvider);
    final duration = DateTime.now().difference(startedTime);
    final hours = duration.inHours;
    final mins = duration.inMinutes.remainder(60);

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
              "Konteks Aktivitas",
              style: HtmTypography.titleMedium?.copyWith(color: htmColors.ink),
            ),
            Text(
              "Pelabelan untuk personalized baseline yang akurat",
              style: TextStyle(
                fontSize: 11,
                color: Colors.white.withValues(alpha: 0.65),
              ),
            ),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        children: [

                // Current activity card
                _CurrentActivityCard(
                  activityName: activeActivity.name,
                  hours: hours,
                  mins: mins,
                  colors: colors,
                  isDark: isDark,
                  onEnd: () => ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: const Text("Aktivitas saat ini diakhiri"),
                      behavior: SnackBarBehavior.floating,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),

                const SizedBox(height: 24),

                // Section label
                Text(
                  "PILIH AKTIVITAS",
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                    color: Colors.grey[500],
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  "Pilih aktivitas yang sedang dilakukan saat ini",
                  style:
                      TextStyle(fontSize: 12, color: Colors.grey[600]),
                ),
                const SizedBox(height: 14),

                FutureBuilder<List<ActivityItem>>(
                  future: apiClient.getActivities(),
                  builder: (context, snapshot) {
                    if (!snapshot.hasData) {
                      return const Center(
                          child: CircularProgressIndicator());
                    }
                    return ActivitySelectorGrid(
                      activities: snapshot.data!,
                      selectedActivityId: activeActivity.id,
                      onSelect: (item) async {
                        // Jangan konfirmasi jika pilihan sama
                        if (item.id == activeActivity.id) return;

                        final confirm = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(22)),
                            contentPadding: const EdgeInsets.fromLTRB(
                                24, 20, 24, 0),
                            actionsPadding: const EdgeInsets.fromLTRB(
                                16, 8, 16, 16),
                            title: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: colors.attentionYellow
                                        .withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Icon(
                                    Icons.swap_horiz_rounded,
                                    color: colors.attentionYellow,
                                    size: 20,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                const Text(
                                  "Ubah Aktivitas?",
                                  style: TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                            content: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const SizedBox(height: 4),
                                Text(
                                  "Aktivitas saat ini akan dihentikan dan diganti.",
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: Colors.grey[600],
                                    height: 1.5,
                                  ),
                                ),
                                const SizedBox(height: 16),
                                // Dari → ke
                                Container(
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: isDark
                                        ? const Color(0xFF1E293B)
                                        : const Color(0xFFF8FAFC),
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(
                                      color: Colors.grey
                                          .withValues(alpha: 0.12),
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              "Saat ini",
                                              style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w600,
                                                color: Colors.grey[500],
                                                letterSpacing: 0.8,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              activeActivity.name,
                                              style: const TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Icon(
                                        Icons.arrow_forward_rounded,
                                        size: 18,
                                        color: colors.dataBlue,
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.end,
                                          children: [
                                            Text(
                                              "Baru",
                                              style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w600,
                                                color: Colors.grey[500],
                                                letterSpacing: 0.8,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              item.name,
                                              style: TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w700,
                                                color: colors.dataBlue,
                                              ),
                                              textAlign: TextAlign.end,
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 16),
                              ],
                            ),
                            actions: [
                              TextButton(
                                onPressed: () =>
                                    Navigator.pop(ctx, false),
                                style: TextButton.styleFrom(
                                  foregroundColor: Colors.grey[600],
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 20, vertical: 12),
                                ),
                                child: const Text("Batal"),
                              ),
                              FilledButton(
                                onPressed: () =>
                                    Navigator.pop(ctx, true),
                                style: FilledButton.styleFrom(
                                  backgroundColor: colors.dataBlue,
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 24, vertical: 12),
                                  shape: RoundedRectangleBorder(
                                    borderRadius:
                                        BorderRadius.circular(12),
                                  ),
                                ),
                                child: const Text("Ya, Ubah"),
                              ),
                            ],
                          ),
                        );

                        if (confirm == true) {
                          ref.read(activeActivityProvider.notifier).state = item;
                          ref.read(activityStartTimeProvider.notifier).state = DateTime.now();
                          ref.read(bleServiceProvider).updateMotionState(item.name);
                          await ref.read(apiClientProvider).pushActivity(activityName: item.name);
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                    "✓ Aktivitas diubah ke: ${item.name}"),
                                behavior: SnackBarBehavior.floating,
                                backgroundColor: colors.stableGreen,
                                shape: RoundedRectangleBorder(
                                    borderRadius:
                                        BorderRadius.circular(12)),
                              ),
                            );
                          }
                        }
                      },
                    );
                  },
                ),

                const SizedBox(height: 24),

                // Koreksi aktivitas sebelumnya
                _CorrectionCard(colors: colors, isDark: isDark),

                const SizedBox(height: 16),

                // Report symptom
                GestureDetector(
                  onTap: () => showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => const SymptomBottomSheet(),
                  ),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isDark
                          ? const Color(0xFF1E293B)
                          : Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: isDark
                          ? []
                          : [
                              BoxShadow(
                                color:
                                    Colors.black.withValues(alpha: 0.04),
                                blurRadius: 10,
                                offset: const Offset(0, 3),
                              ),
                            ],
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: colors.deviationOrange
                                .withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Icon(
                            Icons.add_alert_outlined,
                            color: colors.deviationOrange,
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                "Laporkan Gejala Saat Ini",
                                style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 14),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                "Nyeri dada, pusing, sesak napas, atau tidak nyaman",
                                style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.grey[600]),
                              ),
                            ],
                          ),
                        ),
                        Icon(Icons.arrow_forward_ios_rounded,
                            size: 14, color: Colors.grey[400]),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        }
}

class _CurrentActivityCard extends StatelessWidget {
  final String activityName;
  final int hours;
  final int mins;
  final FunctionalColors colors;
  final bool isDark;
  final VoidCallback onEnd;

  const _CurrentActivityCard({
    required this.activityName,
    required this.hours,
    required this.mins,
    required this.colors,
    required this.isDark,
    required this.onEnd,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            colors.dataBlue,
            colors.dataBlue.withValues(alpha: 0.75),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: colors.dataBlue.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.laptop_chromebook_rounded,
                color: Colors.white, size: 28),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "AKTIVITAS AKTIF",
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                    color: Colors.white.withValues(alpha: 0.65),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  activityName,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  "Durasi: ${hours}j ${mins}m",
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white.withValues(alpha: 0.7),
                  ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: onEnd,
            child: Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                "Akhiri",
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Koreksi Aktivitas Sebelumnya ────────────────────────────────────────────
// Menggunakan ConsumerWidget agar dapat membaca eventsProvider dari backend
class _CorrectionCard extends ConsumerWidget {
  final FunctionalColors colors;
  final bool isDark;
  const _CorrectionCard({required this.colors, required this.isDark});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsAsync = ref.watch(eventsProvider);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(16),
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
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: colors.modelPurple.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.edit_note_rounded,
                    color: colors.modelPurple, size: 18),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  "Koreksi Aktivitas Sebelumnya",
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            "Pilih aktivitas yang ingin dikoreksi:",
            style: TextStyle(fontSize: 11, color: Colors.grey[500]),
          ),
          const SizedBox(height: 8),
          // Data koreksi diambil dari events backend (3 event terbaru)
          eventsAsync.when(
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
            error: (_, __) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                "Gagal memuat riwayat aktivitas",
                style: TextStyle(fontSize: 11, color: Colors.grey[500]),
              ),
            ),
            data: (events) {
              if (events.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Center(
                    child: Column(
                      children: [
                        Icon(Icons.history_toggle_off_rounded,
                            size: 32, color: Colors.grey[400]),
                        const SizedBox(height: 6),
                        Text(
                          "Belum ada riwayat aktivitas",
                          style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                        ),
                      ],
                    ),
                  ),
                );
              }

              // Ambil 3 event terbaru sebagai kandidat koreksi
              final recentEvents = events.take(3).toList();

              return Column(
                children: recentEvents.map((event) {
                  // Format timestamp
                  final ts = event.timestamp;
                  final timeStr =
                      "${ts.hour.toString().padLeft(2, '0')}:${ts.minute.toString().padLeft(2, '0')}";
                  final dateStr =
                      "${ts.day}/${ts.month}/${ts.year}";
                  final durationLabel = event.durationMinutes > 0
                      ? " • ${event.durationMinutes}m"
                      : "";
                  final displayTime = "$dateStr $timeStr$durationLabel";
                  final activityName = event.activity.isNotEmpty
                      ? event.activity
                      : event.title;

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: InkWell(
                      onTap: () =>
                          _showCorrectionDialog(context, displayTime, activityName),
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: isDark
                              ? Colors.white.withValues(alpha: 0.05)
                              : Colors.grey.withValues(alpha: 0.06),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.access_time_rounded,
                                size: 14, color: Colors.grey[500]),
                            const SizedBox(width: 8),
                            Text(
                              displayTime,
                              style: TextStyle(
                                  fontSize: 11, color: Colors.grey[500]),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                activityName,
                                style: const TextStyle(
                                    fontSize: 13, fontWeight: FontWeight.w600),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Icon(Icons.edit_rounded,
                                size: 14, color: colors.modelPurple),
                          ],
                        ),
                      ),
                    ),
                  );
                }).toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  void _showCorrectionDialog(
      BuildContext context, String time, String currentName) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text("Koreksi Label Aktivitas",
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Periode: $time",
                style: TextStyle(fontSize: 12, color: Colors.grey[600])),
            const SizedBox(height: 4),
            Text("Label saat ini: $currentName",
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),
            const Text("Pilih label yang benar:",
                style: TextStyle(fontSize: 12)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                "Tidur",
                "Duduk",
                "Duduk Bekerja",
                "Berdiri",
                "Berjalan",
                "Makan",
                "Olahraga",
              ]
                  .map((a) => ActionChip(
                        label: Text(a, style: const TextStyle(fontSize: 12)),
                        onPressed: () {
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text("✓ Label diubah ke: $a"),
                              behavior: SnackBarBehavior.floating,
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12)),
                            ),
                          );
                        },
                      ))
                  .toList(),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Batal"),
          ),
        ],
      ),
    );
  }
}

