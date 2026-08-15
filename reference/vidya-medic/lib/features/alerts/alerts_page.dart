import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/functional_colors.dart';
import '../../core/theme/htm_colors.dart';
import '../../core/theme/htm_typography.dart';
import '../../core/network/api_client.dart';
import '../../shared/models/models.dart';
import '../activity/symptom_bottom_sheet.dart';

// ─── Controller State ─────────────────────────────────────────────────────────

enum AlertsFilter { all, alert, deviation, recovering }

enum AlertsSort { newest, oldest, severity }

class AlertsState {
  final AlertsFilter filter;
  final AlertsSort sort;
  final Set<String> dismissedIds;
  final String? expandedId;
  final DateTime? startDate;
  final DateTime? endDate;

  const AlertsState({
    this.filter = AlertsFilter.all,
    this.sort = AlertsSort.newest,
    this.dismissedIds = const {},
    this.expandedId,
    this.startDate,
    this.endDate,
  });

  AlertsState copyWith({
    AlertsFilter? filter,
    AlertsSort? sort,
    Set<String>? dismissedIds,
    String? expandedId,
    bool clearExpanded = false,
    DateTime? startDate,
    DateTime? endDate,
    bool clearDate = false,
  }) {
    return AlertsState(
      filter: filter ?? this.filter,
      sort: sort ?? this.sort,
      dismissedIds: dismissedIds ?? this.dismissedIds,
      expandedId: clearExpanded ? null : (expandedId ?? this.expandedId),
      startDate: clearDate ? null : (startDate ?? this.startDate),
      endDate: clearDate ? null : (endDate ?? this.endDate),
    );
  }
}

class AlertsNotifier extends StateNotifier<AlertsState> {
  AlertsNotifier() : super(const AlertsState());

  void setFilter(AlertsFilter filter) => state = state.copyWith(filter: filter);
  void setSort(AlertsSort sort) => state = state.copyWith(sort: sort);

  void toggleExpand(String id) {
    if (state.expandedId == id) {
      state = state.copyWith(clearExpanded: true);
    } else {
      state = state.copyWith(expandedId: id);
    }
  }

  void dismiss(String id) {
    final updated = Set<String>.from(state.dismissedIds)..add(id);
    state = state.copyWith(dismissedIds: updated, clearExpanded: true);
  }

  void clearDismissed() => state = state.copyWith(dismissedIds: {});

  void setDateRange(DateTime start, DateTime end) {
    state = state.copyWith(startDate: start, endDate: end);
  }
  
  void clearDateRange() {
    state = state.copyWith(clearDate: true);
  }

  List<TrajectoryEvent> applyFilter(List<TrajectoryEvent> events) {
    var result = events.where((e) => !state.dismissedIds.contains(e.id));

    // Filter by Date
    if (state.startDate != null && state.endDate != null) {
      result = result.where((e) => 
        e.timestamp.isAfter(state.startDate!) && e.timestamp.isBefore(state.endDate!)
      );
    }

    switch (state.filter) {
      case AlertsFilter.alert:
        result = result.where((e) => e.type == 'alert');
        break;
      case AlertsFilter.deviation:
        result = result.where((e) => e.type == 'deviation');
        break;
      case AlertsFilter.recovering:
        result = result.where((e) => e.type == 'recovering');
        break;
      case AlertsFilter.all:
        break;
    }

    final list = result.toList();

    switch (state.sort) {
      case AlertsSort.newest:
        list.sort((a, b) => b.timestamp.compareTo(a.timestamp));
        break;
      case AlertsSort.oldest:
        list.sort((a, b) => a.timestamp.compareTo(b.timestamp));
        break;
      case AlertsSort.severity:
        list.sort((a, b) => b.magnitude.compareTo(a.magnitude));
        break;
    }

    return list;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

final alertsControllerProvider =
    StateNotifierProvider<AlertsNotifier, AlertsState>(
  (ref) => AlertsNotifier(),
);

// ─── Page ─────────────────────────────────────────────────────────────────────

class AlertsPage extends ConsumerWidget {
  const AlertsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;
    final htmColors = HtmColors.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final eventsAsync = ref.watch(eventsProvider);
    final alertsState = ref.watch(alertsControllerProvider);
    final controller = ref.read(alertsControllerProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 72,
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: Container(
          margin: const EdgeInsets.all(10),
          child: IconButton(
            icon: Icon(Icons.arrow_back_rounded, color: htmColors.ink, size: 20),
            padding: EdgeInsets.zero,
            onPressed: () {
              if (Navigator.of(context).canPop()) {
                Navigator.of(context).pop();
              } else {
                context.go('/home');
              }
            },
          ),
        ),
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
              "Peringatan & Anomali",
              style: HtmTypography.titleMedium?.copyWith(color: htmColors.ink),
            ),
            eventsAsync.when(
              data: (events) {
                final active = events.where((e) => e.type == 'alert' || e.type == 'deviation').length;
                return Text(
                  active > 0 ? "$active peringatan aktif" : "Tidak ada peringatan aktif",
                  style: TextStyle(fontSize: 11, color: active > 0 ? colors.alertRed : htmColors.muted),
                );
              },
              loading: () => Text("Memuat...", style: TextStyle(fontSize: 11, color: htmColors.muted)),
              error: (_, __) => Text("Gagal memuat", style: TextStyle(fontSize: 11, color: colors.alertRed)),
            ),
          ],
        ),
        actions: [
          // Date Filter Button
          Container(
            width: 36, height: 36,
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              color: alertsState.startDate != null ? colors.dataBlue.withValues(alpha: 0.1) : htmColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: alertsState.startDate != null ? colors.dataBlue : htmColors.hairline, width: 1),
            ),
            child: IconButton(
              onPressed: () async {
                if (alertsState.startDate != null) {
                  // Clear date if already set
                  controller.clearDateRange();
                  return;
                }
                final DateTimeRange? picked = await showDateRangePicker(
                  context: context,
                  firstDate: DateTime(2020),
                  lastDate: DateTime.now(),
                  builder: (context, child) {
                    return Theme(
                      data: Theme.of(context).copyWith(
                        colorScheme: ColorScheme.light(
                          primary: colors.dataBlue,
                          onPrimary: Colors.white,
                          surface: isDark ? const Color(0xFF1E293B) : Colors.white,
                        ),
                      ),
                      child: child!,
                    );
                  },
                );
                if (picked != null) {
                  final endOfDay = picked.end.add(const Duration(hours: 23, minutes: 59, seconds: 59));
                  controller.setDateRange(picked.start, endOfDay);
                }
              },
              icon: Icon(
                alertsState.startDate != null ? Icons.calendar_today_rounded : Icons.date_range_rounded, 
                color: alertsState.startDate != null ? colors.dataBlue : htmColors.ink, 
                size: 18
              ),
              padding: EdgeInsets.zero,
              tooltip: alertsState.startDate != null ? "Hapus Filter Tanggal" : "Filter Tanggal",
            ),
          ),
          // Sort Button
          Container(
            width: 36, height: 36,
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              color: htmColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: htmColors.hairline, width: 1),
            ),
            child: PopupMenuButton<AlertsSort>(
              icon: Icon(Icons.sort_rounded, color: htmColors.ink, size: 18),
              padding: EdgeInsets.zero,
              tooltip: "Urutkan",
              onSelected: controller.setSort,
              itemBuilder: (_) => [
                _buildSortItem(AlertsSort.newest, "Terbaru", alertsState.sort),
                _buildSortItem(AlertsSort.oldest, "Terlama", alertsState.sort),
                _buildSortItem(AlertsSort.severity, "Keparahan", alertsState.sort),
              ],
            ),
          ),
          Container(
            width: 36, height: 36,
            margin: const EdgeInsets.only(right: 12),
            decoration: BoxDecoration(
              color: htmColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: htmColors.hairline, width: 1),
            ),
            child: IconButton(
              onPressed: () => ref.invalidate(eventsProvider),
              icon: Icon(Icons.refresh_rounded, color: htmColors.ink, size: 18),
              padding: EdgeInsets.zero,
              tooltip: "Refresh",
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          _FilterBar(selected: alertsState.filter, onSelect: controller.setFilter, colors: colors, htmColors: htmColors),
          if (alertsState.startDate != null && alertsState.endDate != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: colors.dataBlue.withValues(alpha: 0.05),
              child: Row(
                children: [
                  Icon(Icons.event_available_rounded, size: 14, color: colors.dataBlue),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      "Difilter dari ${alertsState.startDate!.day}/${alertsState.startDate!.month} hingga ${alertsState.endDate!.day}/${alertsState.endDate!.month}",
                      style: TextStyle(fontSize: 11, color: colors.dataBlue, fontWeight: FontWeight.w600),
                    ),
                  ),
                  GestureDetector(
                    onTap: controller.clearDateRange,
                    child: Icon(Icons.close_rounded, size: 16, color: colors.dataBlue),
                  )
                ],
              ),
            ),
          Expanded(
            child: eventsAsync.when(
              loading: () => _LoadingState(htmColors: htmColors),
              error: (err, _) => _ErrorState(error: err.toString(), onRetry: () => ref.invalidate(eventsProvider), colors: colors),
              data: (allEvents) {
                final filtered = controller.applyFilter(allEvents);
                if (filtered.isEmpty) {
                  return _EmptyState(
                    filter: alertsState.filter,
                    hasDismissed: alertsState.dismissedIds.isNotEmpty,
                    onClearDismissed: controller.clearDismissed,
                    colors: colors,
                    htmColors: htmColors,
                  );
                }
                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                  itemCount: filtered.length,
                  itemBuilder: (context, i) {
                    final event = filtered[i];
                    final isExpanded = alertsState.expandedId == event.id;
                    return _AlertCard(
                      key: ValueKey(event.id),
                      event: event,
                      isExpanded: isExpanded,
                      colors: colors,
                      htmColors: htmColors,
                      isDark: isDark,
                      onToggle: () => controller.toggleExpand(event.id),
                      onDismiss: () => controller.dismiss(event.id),
                      onStatusUpdate: (status) async {
                        await ref.read(apiClientProvider).updateEventStatus(event.id, status);
                        ref.invalidate(eventsProvider);
                      },
                      onFalseAlarm: () => _confirmFalseAlarm(context, ref, event.id, controller),
                      onReportSymptom: () => showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (_) => const SymptomBottomSheet(),
                      ),
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

  PopupMenuItem<AlertsSort> _buildSortItem(AlertsSort value, String label, AlertsSort selected) {
    return PopupMenuItem(
      value: value,
      child: Row(
        children: [
          Icon(selected == value ? Icons.radio_button_checked : Icons.radio_button_off, size: 16, color: selected == value ? Colors.blue : Colors.grey),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(fontSize: 13)),
        ],
      ),
    );
  }

  void _confirmFalseAlarm(BuildContext context, WidgetRef ref, String eventId, AlertsNotifier ctrl) {
    HapticFeedback.mediumImpact();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text("Tandai False Alarm?", style: TextStyle(fontWeight: FontWeight.w500, fontSize: 16)),
        content: const Text("Peringatan ini akan ditandai sebagai false alarm dan dikirim ke tim penelitian untuk ditinjau. Data monitoring Anda tetap tersimpan.", style: TextStyle(fontSize: 13, height: 1.5)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Batal")),
          FilledButton(
            style: FilledButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
            onPressed: () async {
              HapticFeedback.lightImpact();
              Navigator.pop(ctx);
              final client = ref.read(apiClientProvider);
              await client.validateEvent(eventId, false);
              await client.updateEventStatus(eventId, 'Closed');
              ref.invalidate(eventsProvider);
              ctrl.dismiss(eventId);
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                  content: const Text("✓ Ditandai sebagai false alarm di server."),
                  behavior: SnackBarBehavior.floating,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ));
              }
            },
            child: const Text("Ya, Tandai"),
          ),
        ],
      ),
    );
  }
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

class _FilterBar extends StatelessWidget {
  final AlertsFilter selected;
  final ValueChanged<AlertsFilter> onSelect;
  final FunctionalColors colors;
  final HtmColors htmColors;

  const _FilterBar({required this.selected, required this.onSelect, required this.colors, required this.htmColors});

  @override
  Widget build(BuildContext context) {
    final filters = [
      (AlertsFilter.all, "Semua"),
      (AlertsFilter.alert, "Peringatan"),
      (AlertsFilter.deviation, "Deviasi"),
      (AlertsFilter.recovering, "Pemulihan"),
    ];
    return Container(
      height: 48,
      color: htmColors.surface,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        children: filters.map((f) {
          final isActive = selected == f.$1;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => onSelect(f.$1),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                decoration: BoxDecoration(
                  color: isActive ? colors.dataBlue : Colors.transparent,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: isActive ? colors.dataBlue : Colors.grey.withValues(alpha: 0.3), width: 1.5),
                ),
                child: Text(f.$2, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: isActive ? Colors.white : Colors.grey[600])),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ─── Alert Card ───────────────────────────────────────────────────────────────

class _AlertCard extends StatelessWidget {
  final TrajectoryEvent event;
  final bool isExpanded;
  final FunctionalColors colors;
  final HtmColors htmColors;
  final bool isDark;
  final VoidCallback onToggle;
  final VoidCallback onDismiss;
  final ValueChanged<String> onStatusUpdate;
  final VoidCallback onFalseAlarm;
  final VoidCallback onReportSymptom;

  const _AlertCard({
    super.key,
    required this.event,
    required this.isExpanded,
    required this.colors,
    required this.htmColors,
    required this.isDark,
    required this.onToggle,
    required this.onDismiss,
    required this.onStatusUpdate,
    required this.onFalseAlarm,
    required this.onReportSymptom,
  });

  Color get _typeColor {
    switch (event.type) {
      case 'alert': return colors.alertRed;
      case 'deviation': return colors.deviationOrange;
      case 'recovering': return colors.stableGreen;
      default: return colors.dataBlue;
    }
  }

  String get _typeLabel {
    switch (event.type) {
      case 'alert': return "PERINGATAN";
      case 'deviation': return "DEVIASI";
      case 'recovering': return "PEMULIHAN";
      default: return "STABIL";
    }
  }

  IconData get _typeIcon {
    switch (event.type) {
      case 'alert': return Icons.warning_amber_rounded;
      case 'deviation': return Icons.trending_up_rounded;
      case 'recovering': return Icons.healing_rounded;
      default: return Icons.check_circle_outline_rounded;
    }
  }

  String _formatTimestamp(DateTime ts) {
    final diff = DateTime.now().difference(ts);
    if (diff.inMinutes < 1) return "Baru saja";
    if (diff.inMinutes < 60) return "${diff.inMinutes} mnt lalu";
    if (diff.inHours < 24) return "${diff.inHours} jam lalu";
    if (diff.inDays < 7) return "${diff.inDays} hari lalu";
    return "${ts.day}/${ts.month}/${ts.year}";
  }

  @override
  Widget build(BuildContext context) {
    final typeColor = _typeColor;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GestureDetector(
        onTap: onToggle,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E293B) : Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: isExpanded ? typeColor.withValues(alpha: 0.5) : Colors.grey.withValues(alpha: 0.12), width: isExpanded ? 1.5 : 1),
            boxShadow: isDark ? [] : [BoxShadow(color: isExpanded ? typeColor.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.04), blurRadius: isExpanded ? 16 : 8, offset: const Offset(0, 3))],
          ),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    Container(
                      width: 42, height: 42,
                      decoration: BoxDecoration(color: typeColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(13)),
                      child: Icon(_typeIcon, color: typeColor, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(color: typeColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                                child: Text(_typeLabel, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: typeColor, letterSpacing: 0.8)),
                              ),
                              const SizedBox(width: 6),
                              Expanded(child: Text(_formatTimestamp(event.timestamp), style: TextStyle(fontSize: 10, color: Colors.grey[500]), overflow: TextOverflow.ellipsis)),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(event.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                          if (event.activity.isNotEmpty)
                            Text(event.activity, style: TextStyle(fontSize: 11, color: Colors.grey[500]), maxLines: 1, overflow: TextOverflow.ellipsis),
                        ],
                      ),
                    ),
                    // Metrics only shown if available from API
                    if (event.magnitude > 0 || event.durationMinutes > 0)
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          if (event.magnitude > 0)
                            Text("${event.magnitude.toStringAsFixed(1)} SD", style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: typeColor)),
                          if (event.durationMinutes > 0)
                            Text("${event.durationMinutes} mnt", style: TextStyle(fontSize: 10, color: Colors.grey[500])),
                        ],
                      ),
                    const SizedBox(width: 8),
                    Icon(isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded, size: 18, color: Colors.grey[400]),
                  ],
                ),
              ),
              if (isExpanded) ...[
                Divider(height: 1, color: Colors.grey.withValues(alpha: 0.1), indent: 16, endIndent: 16),
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Description from API — hanya tampil jika tidak kosong
                      if (event.description.isNotEmpty)
                        Text(event.description, style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[400] : Colors.grey[700], height: 1.55)),
                      const SizedBox(height: 12),
                      // Metric badges — hanya tampil jika nilai tersedia dari API
                      Row(
                        children: [
                          if (event.magnitude > 0)
                            Expanded(child: _MetricBadge(icon: Icons.straighten_rounded, label: "Magnitude", value: "${event.magnitude.toStringAsFixed(1)} SD", color: typeColor, isDark: isDark)),
                          if (event.durationMinutes > 0) ...[
                            const SizedBox(width: 8),
                            Expanded(child: _MetricBadge(icon: Icons.timer_outlined, label: "Durasi", value: "${event.durationMinutes} mnt", color: colors.attentionYellow, isDark: isDark)),
                          ],
                          if (event.recoveryStatus.isNotEmpty) ...[
                            const SizedBox(width: 8),
                            Expanded(child: _MetricBadge(icon: Icons.sync_problem_rounded, label: "Recovery", value: event.recoveryStatus, color: colors.alertRed, isDark: isDark)),
                          ],
                        ],
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8, runSpacing: 8,
                        children: [
                          _ActionChip(label: "Saya baik-baik saja", icon: Icons.sentiment_satisfied_alt_rounded, color: colors.stableGreen, onTap: () => onStatusUpdate('Closed')),
                          _ActionChip(label: "Laporkan gejala", icon: Icons.add_alert_outlined, color: colors.dataBlue, onTap: onReportSymptom),
                          _ActionChip(label: "False alarm", icon: Icons.flag_outlined, color: colors.inactiveGrey, onTap: onFalseAlarm),
                          _ActionChip(label: "Abaikan", icon: Icons.close_rounded, color: Colors.grey, onTap: onDismiss),
                        ],
                      ),
                      const SizedBox(height: 8),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Metric Badge ─────────────────────────────────────────────────────────────

class _MetricBadge extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final bool isDark;

  const _MetricBadge({required this.icon, required this.label, required this.value, required this.color, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.grey.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: color)),
          Text(label, style: const TextStyle(fontSize: 9, color: Colors.grey)),
        ],
      ),
    );
  }
}

// ─── Action Chip ─────────────────────────────────────────────────────────────

class _ActionChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _ActionChip({required this.label, required this.icon, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () { HapticFeedback.selectionClick(); onTap(); },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withValues(alpha: 0.25), width: 1),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 5),
            Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
          ],
        ),
      ),
    );
  }
}

// ─── State Widgets ────────────────────────────────────────────────────────────

class _LoadingState extends StatelessWidget {
  final HtmColors htmColors;
  const _LoadingState({required this.htmColors});

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        CircularProgressIndicator(color: htmColors.primary),
        const SizedBox(height: 16),
        Text("Memuat riwayat peringatan...", style: TextStyle(fontSize: 13, color: htmColors.muted)),
      ],
    ),
  );
}

class _ErrorState extends StatelessWidget {
  final String error;
  final VoidCallback onRetry;
  final FunctionalColors colors;

  const _ErrorState({required this.error, required this.onRetry, required this.colors});

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.cloud_off_rounded, size: 48, color: colors.alertRed),
          const SizedBox(height: 16),
          const Text("Gagal Memuat Peringatan", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 8),
          Text("Periksa koneksi internet Anda dan coba lagi.", style: TextStyle(fontSize: 12, color: Colors.grey[600]), textAlign: TextAlign.center),
          const SizedBox(height: 20),
          ElevatedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded, size: 16),
            label: const Text("Coba Lagi"),
            style: ElevatedButton.styleFrom(backgroundColor: colors.dataBlue, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          ),
        ],
      ),
    ),
  );
}

class _EmptyState extends StatelessWidget {
  final AlertsFilter filter;
  final bool hasDismissed;
  final VoidCallback onClearDismissed;
  final FunctionalColors colors;
  final HtmColors htmColors;

  const _EmptyState({required this.filter, required this.hasDismissed, required this.onClearDismissed, required this.colors, required this.htmColors});

  @override
  Widget build(BuildContext context) {
    final isFiltered = filter != AlertsFilter.all;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: colors.stableGreen.withValues(alpha: 0.1), shape: BoxShape.circle),
              child: Icon(Icons.check_circle_outline_rounded, size: 52, color: colors.stableGreen),
            ),
            const SizedBox(height: 20),
            Text(isFiltered ? "Tidak ada data untuk filter ini" : "Tidak Ada Peringatan Aktif", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17), textAlign: TextAlign.center),
            const SizedBox(height: 8),
            Text(
              isFiltered ? "Coba pilih filter lain atau lihat semua peringatan." : "Sistem tidak mendeteksi anomali trajectory. Lanjutkan aktivitas Anda seperti biasa.",
              style: TextStyle(fontSize: 12, color: Colors.grey[600], height: 1.5),
              textAlign: TextAlign.center,
            ),
            if (hasDismissed) ...[
              const SizedBox(height: 16),
              TextButton.icon(
                onPressed: onClearDismissed,
                icon: const Icon(Icons.restore_rounded, size: 16),
                label: const Text("Tampilkan yang diabaikan"),
                style: TextButton.styleFrom(foregroundColor: Colors.grey[600]),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
