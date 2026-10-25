import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../profile/wearable_pairing_screen.dart';
import 'live_heart_rate_chart.dart';

class WearableMonitoringCard extends StatelessWidget {
  const WearableMonitoringCard({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final wearable = state.wearable;
    final bridge = state.wearableBridge;
    final isLive = bridge.isStreaming && !bridge.isDemoDevice;
    final readings = [
      ...state.personalChatWearableHistory,
      ...state.wearableSamples,
      if (isLive) ...state.liveStreamReadings,
    ];
    final uniqueReadings = <String, Map<String, dynamic>>{};
    for (final reading in readings) {
      if (reading['is_simulated'] == true ||
          reading['heart_rate_bpm'] is! num) {
        continue;
      }
      uniqueReadings['${reading['recorded_at']}:${reading['heart_rate_bpm']}'] =
          reading;
    }
    final heartRateReadings = uniqueReadings.values.toList()
      ..sort((first, second) {
        final firstTime =
            DateTime.tryParse(first['recorded_at']?.toString() ?? '');
        final secondTime =
            DateTime.tryParse(second['recorded_at']?.toString() ?? '');
        if (firstTime == null || secondTime == null) return 0;
        return firstTime.compareTo(secondTime);
      });

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppTheme.borderLight),
        boxShadow: AppTheme.shadowSoft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Monitoring wearable',
                  style: TextStyle(
                    color: AppTheme.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _statusLabel(
                wearable.isSimulated
                    ? 'DEMO'
                    : isLive
                        ? 'STREAMING'
                        : bridge.isConnected
                            ? 'TERHUBUNG'
                            : 'OFFLINE',
                demo: wearable.isSimulated,
                connected: bridge.isConnected,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(
                isLive
                    ? Icons.sensors_rounded
                    : bridge.isConnected
                        ? Icons.bluetooth_connected_rounded
                        : Icons.bluetooth_disabled_rounded,
                size: 16,
                color: AppTheme.primary,
              ),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  bridge.isConnected
                      ? bridge.deviceName
                      : wearable.hasServerSamples
                          ? wearable.deviceName
                          : 'Wearable belum tersedia',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTheme.font(
                      size: 13,
                      weight: FontWeight.w800,
                      color: AppTheme.textPrimary),
                ),
              ),
              if (bridge.isUploading) ...[
                const SizedBox(width: 8),
                const SizedBox(
                  width: 13,
                  height: 13,
                  child: CircularProgressIndicator(
                      strokeWidth: 1.5, color: AppTheme.primary),
                ),
              ],
            ],
          ),
          const SizedBox(height: 3),
          Text(
            isLive
                ? bridge.lastHeartRateAt == null
                    ? 'Streaming aktif · menunggu bacaan'
                    : 'Bacaan terakhir ${TimeOfDay.fromDateTime(bridge.lastHeartRateAt!).format(context)}:${bridge.lastHeartRateAt!.second.toString().padLeft(2, '0')}'
                : wearable.lastSync == null
                    ? 'Belum ada waktu sinkronisasi'
                    : 'Sinkron terakhir ${TimeOfDay.fromDateTime(wearable.lastSync!.toLocal()).format(context)}',
            style: AppTheme.font(size: 10.5, color: AppTheme.textMuted),
          ),
          const SizedBox(height: 12),
          LiveHeartRateChart(
            readings: heartRateReadings,
            isStreaming: isLive,
            darkBackground: false,
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Text(
                  wearable.isSimulated
                      ? 'Data sintetis untuk demonstrasi, bukan pengukuran tubuh.'
                      : isLive
                          ? '${bridge.sessionReadingCount} bacaan dalam sesi'
                          : bridge.isConnected
                              ? 'Streaming belum dimulai'
                              : wearable.hasServerSamples
                                  ? 'Riwayat tersimpan tersedia'
                                  : 'Hubungkan Polar H10 untuk mulai merekam',
                  style:
                      AppTheme.font(size: 9.5, color: AppTheme.textSecondary),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          if (bridge.error != null) ...[
            const SizedBox(height: 5),
            Text(
              bridge.error!,
              style: AppTheme.font(size: 9, color: AppTheme.statusRed),
            ),
          ],
          if (!isLive)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (_) => const WearablePairingScreen()),
                ),
                icon: const Icon(Icons.bluetooth_searching_rounded, size: 15),
                label: Text(bridge.isConnected
                    ? 'Atur streaming Polar H10'
                    : 'Hubungkan / mulai streaming'),
                style: TextButton.styleFrom(
                  foregroundColor: AppTheme.primary,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                  textStyle: AppTheme.font(size: 10, weight: FontWeight.w700),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _statusLabel(
    String value, {
    required bool demo,
    required bool connected,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: connected
            ? AppTheme.primarySoft
            : demo
                ? AppTheme.statusYellowBg
                : AppTheme.fieldFill,
        borderRadius: BorderRadius.circular(7),
      ),
      child: Text(
        value,
        style: AppTheme.font(
          size: 9,
          weight: FontWeight.w800,
          color: connected
              ? AppTheme.primary
              : demo
                  ? AppTheme.statusYellow
                  : AppTheme.textMuted,
        ),
      ),
    );
  }
}

class WearableVitalsGrid extends StatelessWidget {
  const WearableVitalsGrid({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final wearable = state.wearable;
    final metrics = <(String, String, String, IconData)>[
      (
        'Detak Jantung',
        wearable.heartRate > 0 ? '${wearable.heartRate}' : '—',
        'bpm · terbaru',
        Icons.favorite_rounded,
      ),
      (
        'HRV (RMSSD)',
        wearable.hrvRmssd > 0 ? '${wearable.hrvRmssd}' : '—',
        'ms · variasi RR',
        Icons.monitor_heart_outlined,
      ),
      (
        'Langkah',
        wearable.steps > 0 ? '${wearable.steps}' : '—',
        wearable.stepsEstimatedFromAcc ? 'estimasi ACC' : 'hari ini',
        Icons.directions_walk_rounded,
      ),
      (
        'Deviasi CAPAR',
        state.hasCaparMetrics
            ? '${state.latestCaparMahalanobis?['distance'] ?? '—'}'
            : '—',
        state.hasCaparMetrics
            ? (state.latestCaparMahalanobis?['state']?.toString() ??
                'baseline personal')
            : 'analisis belum tersedia',
        Icons.insights_rounded,
      ),
    ];

    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: metrics.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          mainAxisExtent: 96,
        ),
        itemBuilder: (context, index) {
          final metric = metrics[index];
          return Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(15),
              border: Border.all(color: AppTheme.borderLight),
              boxShadow: AppTheme.shadowSoft,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(metric.$4, size: 15, color: AppTheme.primary),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(
                        metric.$1,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.font(
                            size: 10.5,
                            weight: FontWeight.w700,
                            color: AppTheme.textSecondary),
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Flexible(
                      child: Text(
                        metric.$2,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.font(
                            size: 20,
                            weight: FontWeight.w900,
                            color: AppTheme.textPrimary),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        metric.$3,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style:
                            AppTheme.font(size: 9, color: AppTheme.textMuted),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class PhysiologicalSummaryCard extends StatelessWidget {
  const PhysiologicalSummaryCard({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final today = DateUtils.dateOnly(DateTime.now());
    final readings = <String, Map<String, dynamic>>{};
    final candidates = [
      ...state.personalChatWearableHistory,
      ...state.wearableSamples,
      if (state.wearableBridge.isStreaming &&
          !state.wearableBridge.isDemoDevice)
        ...state.liveStreamReadings,
    ];

    for (final reading in candidates) {
      final recordedAt =
          DateTime.tryParse(reading['recorded_at']?.toString() ?? '');
      if (recordedAt == null ||
          !DateUtils.isSameDay(recordedAt.toLocal(), today) ||
          reading['is_simulated'] == true ||
          reading['heart_rate_bpm'] is! num) {
        continue;
      }
      readings['${recordedAt.toIso8601String()}:${reading['heart_rate_bpm']}'] =
          reading;
    }

    final values = readings.values.toList();
    var heartRateTotal = 0.0;
    var heartRateWeight = 0;
    var rmssdTotal = 0.0;
    var rmssdWeight = 0;
    for (final reading in values) {
      final weight = (reading['sample_count'] as num?)?.round() ?? 1;
      final safeWeight = weight > 0 ? weight : 1;
      heartRateTotal +=
          (reading['heart_rate_bpm'] as num).toDouble() * safeWeight;
      heartRateWeight += safeWeight;
      final rmssd = reading['rmssd_ms'];
      if (rmssd is num && rmssd > 0) {
        rmssdTotal += rmssd.toDouble() * safeWeight;
        rmssdWeight += safeWeight;
      }
    }

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppTheme.borderLight),
        boxShadow: AppTheme.shadowSoft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Ringkasan fisiologis hari ini',
            style: AppTheme.font(
              size: 14,
              weight: FontWeight.w800,
              color: AppTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            values.isEmpty
                ? 'Belum ada bacaan wearable nyata hari ini.'
                : '${values.length} ringkasan bacaan wearable nyata hari ini.',
            style: AppTheme.font(size: 10.5, color: AppTheme.textSecondary),
          ),
          if (values.isNotEmpty) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _PhysiologicalSummaryMetric(
                    label: 'Rata-rata denyut',
                    value: '${(heartRateTotal / heartRateWeight).round()}',
                    unit: 'bpm',
                    icon: Icons.favorite_rounded,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _PhysiologicalSummaryMetric(
                    label: 'Rata-rata HRV',
                    value: rmssdWeight == 0
                        ? '—'
                        : (rmssdTotal / rmssdWeight).round().toString(),
                    unit: 'ms · RMSSD',
                    icon: Icons.monitor_heart_outlined,
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 8),
          Text(
            'Ringkasan ini menjelaskan bacaan Anda, bukan diagnosis atau rentang normal.',
            style: AppTheme.font(
              size: 9.5,
              color: AppTheme.textMuted,
              height: 1.3,
            ),
          ),
        ],
      ),
    );
  }
}

class _PhysiologicalSummaryMetric extends StatelessWidget {
  const _PhysiologicalSummaryMetric({
    required this.label,
    required this.value,
    required this.unit,
    required this.icon,
  });

  final String label;
  final String value;
  final String unit;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: AppTheme.fieldFill,
        borderRadius: BorderRadius.circular(13),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: AppTheme.primary),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTheme.font(
                    size: 9.5,
                    weight: FontWeight.w700,
                    color: AppTheme.textSecondary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 7),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: value,
                  style: AppTheme.font(
                    size: 19,
                    weight: FontWeight.w900,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const TextSpan(text: ' '),
                TextSpan(
                  text: unit,
                  style: AppTheme.font(size: 9, color: AppTheme.textMuted),
                ),
              ],
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
