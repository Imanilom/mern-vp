import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/app_state.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';
import '../profile/profile_screen.dart';
import 'history_trend_chart.dart';

/// Halaman riwayat pemantauan pasien dan data CAPAR.
class PatientJourneyScreen extends StatefulWidget {
  const PatientJourneyScreen({super.key});

  @override
  State<PatientJourneyScreen> createState() => _PatientJourneyScreenState();
}

class _PatientJourneyScreenState extends State<PatientJourneyScreen> {
  int _activeStep = 0;
  HistoryChart _selectedChart = HistoryChart.wearable;
  List<Map<String, dynamic>> _weeklyWearable = [];
  List<Map<String, dynamic>> _weeklyPolar = [];
  bool _isLoadingWearableHistory = true;
  String? _wearableHistoryError;
  List<Map<String, dynamic>> _weeklyCheckIns = [];
  List<Map<String, dynamic>> _weeklyEvents = [];
  bool _hasLoadedWeeklyCheckIns = false;
  bool _hasLoadedWeeklyEvents = false;
  String? _patientHistoryError;

  @override
  void initState() {
    super.initState();
    _loadWeeklyHistory();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(_refreshCaparData());
    });
  }

  Future<void> _refreshCaparData() async {
    final state = context.read<AppState>();
    await state.fetchCaparInsights();
    await state.fetchWearableSamples();
  }

  Future<void> _loadWeeklyHistory() async {
    final to = DateTime.now().toUtc();
    final from = to.subtract(const Duration(days: 7));
    final responses = await Future.wait<dynamic>([
      ApiService.getWearableHistory(from: from, to: to),
      ApiService.getCheckIns(
        from: from.toIso8601String(),
        to: to.toIso8601String(),
        limit: 100,
      ),
      ApiService.getEvents(
        from: from.toIso8601String(),
        to: to.toIso8601String(),
        limit: 100,
      ),
    ]);
    final wearableResponse = responses[0] as ApiResponse<List<dynamic>>;
    final checkInResponse = responses[1] as ApiResponse<List<dynamic>>;
    final eventResponse = responses[2] as ApiResponse<List<dynamic>>;
    if (!mounted) return;
    setState(() {
      _patientHistoryError = null;
      if (wearableResponse.success && wearableResponse.data != null) {
        final history = wearableResponse.data!
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList();
        _weeklyWearable =
            history.where((item) => item['source'] == 'patient_app').toList();
        _weeklyPolar =
            history.where((item) => item['source'] == 'capar_polar').toList();
        _wearableHistoryError = null;
      } else {
        _wearableHistoryError =
            wearableResponse.message ?? 'Riwayat wearable gagal dimuat.';
      }
      _isLoadingWearableHistory = false;
      if (checkInResponse.success && checkInResponse.data != null) {
        _weeklyCheckIns = checkInResponse.data!
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList();
        _hasLoadedWeeklyCheckIns = true;
      } else {
        _patientHistoryError =
            checkInResponse.message ?? 'Riwayat check-in gagal dimuat.';
      }
      if (eventResponse.success && eventResponse.data != null) {
        _weeklyEvents = eventResponse.data!
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList();
        _hasLoadedWeeklyEvents = true;
      } else {
        _patientHistoryError =
            eventResponse.message ?? 'Riwayat event gagal dimuat.';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final capar = s.rawCaparInsights?['capar'];
    final recovery = capar is Map && capar['recovery'] is Map
        ? Map<String, dynamic>.from(capar['recovery'] as Map)
        : <String, dynamic>{};
    final reasoningPipeline = s.reasoningPipeline;
    final pipelineStages = reasoningPipeline?['stages'] is List
        ? (reasoningPipeline!['stages'] as List)
            .whereType<Map>()
            .map((stage) => Map<String, dynamic>.from(stage))
            .toList()
        : <Map<String, dynamic>>[];
    final inventory = capar is Map && capar['data_inventory'] is Map
        ? Map<String, dynamic>.from(capar['data_inventory'] as Map)
        : <String, dynamic>{};
    final entries = _entries(s);
    final baselines = capar is Map && capar['baseline'] is Map
        ? (capar['baseline']['contexts'] as List? ?? const [])
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList()
        : <Map<String, dynamic>>[];
    final episodes = capar is Map && capar['episode_history'] is List
        ? (capar['episode_history'] as List)
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList()
        : <Map<String, dynamic>>[];
    final now = DateTime.now();
    final weeklyTrajectory = capar is Map && capar['trajectory_30d'] is List
        ? (capar['trajectory_30d'] as List)
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .where((item) {
            final recordedAt = _date(item['recorded_at']);
            return recordedAt != null &&
                !recordedAt.isBefore(now.subtract(const Duration(days: 7))) &&
                !recordedAt.isAfter(now);
          }).toList()
        : <Map<String, dynamic>>[];
    final chartPoints = _chartPoints(s, weeklyTrajectory);
    final chartLabel = switch (_selectedChart) {
      HistoryChart.wearable => 'Detak jantung wearable (bpm)',
      HistoryChart.capar => 'Deviasi dari baseline CAPAR',
      HistoryChart.polarCapar => 'Detak jantung PolarData CAPAR (bpm)',
      HistoryChart.streaming => 'Detak jantung streaming langsung (bpm)',
    };
    final chartColor = _selectedChart == HistoryChart.capar
        ? AppTheme.statusOrange
        : AppTheme.primary;
    return MockupScaffold(
      title: 'Riwayat Pemantauan',
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppTheme.primarySoft,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                  color: AppTheme.primaryLight.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.timeline, color: AppTheme.primary, size: 22),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Garis waktu ini disusun dari check-in, event, wearable, dan analisis CAPAR yang tersimpan di server.',
                    style: AppTheme.font(
                        size: 12.5,
                        color: AppTheme.primaryDark,
                        height: 1.35,
                        weight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (reasoningPipeline != null) ...[
            _reasoningPipelineCard(reasoningPipeline, pipelineStages),
            const SizedBox(height: 16),
          ],
          if (inventory.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.borderLight),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Data CAPAR di akun Anda',
                    style: AppTheme.font(size: 14, weight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Baseline ${inventory['baselines'] ?? 0} • Segmen ${inventory['segments_returned'] ?? 0} • '
                    'PolarData ${inventory['polar_records_returned'] ?? 0} • '
                    'Analisis episode ${inventory['episode_analyses_returned'] ?? 0} • '
                    'Event episode ${inventory['anomaly_events_returned'] ?? 0} • '
                    'Cognitive memory ${inventory['cognitive_memories_returned'] ?? 0}',
                    style: AppTheme.font(
                        size: 11.5, color: AppTheme.textSecondary, height: 1.4),
                  ),
                  if (recovery['observed_episode_recovery_rate_pct']
                      is num) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Outcome episode pulih: ${recovery['observed_episode_recovery_rate_pct']}% '
                      '(${recovery['resolved_episodes_30d']} pulih dari '
                      '${recovery['recovery_rate_denominator']} episode dengan outcome tercatat, 30 hari)',
                      style: AppTheme.font(
                          size: 12,
                          weight: FontWeight.w700,
                          color: AppTheme.primaryDark),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Proporsi historis yang teramati, bukan prediksi atau diagnosis.',
                      style:
                          AppTheme.font(size: 10.5, color: AppTheme.textMuted),
                    ),
                  ] else ...[
                    const SizedBox(height: 8),
                    Text(
                      'Persentase recovery historis belum tersedia karena belum ada episode dengan outcome pulih/tidak pulih yang tercatat.',
                      style: AppTheme.font(size: 11, color: AppTheme.textMuted),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
          if (capar is Map && capar['status'] == 'link_required')
            _buildCaparLinkPrompt(context),
          if (s.isCaparLoading)
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: LinearProgressIndicator(),
            )
          else if (capar == null && s.dataError != null)
            _emptyHistoryCard(s.dataError!),
          if (_patientHistoryError != null) ...[
            _emptyHistoryCard(_patientHistoryError!),
            const SizedBox(height: 8),
          ],
          _buildChartCard(
            chartPoints,
            chartLabel,
            chartColor,
            weeklyTrajectory.length,
            s,
          ),
          const SizedBox(height: 16),
          _sectionTitle('Baseline personal', baselines.length),
          if (baselines.isEmpty)
            _emptyHistoryCard('Baseline CAPAR belum tersedia untuk akun ini.')
          else
            ...baselines.take(12).map(_baselineCard),
          const SizedBox(height: 16),
          _sectionTitle('Episode analisis CAPAR', episodes.length),
          if (episodes.isEmpty)
            _emptyHistoryCard(
                'Belum ada episode CAPAR yang tercatat dalam riwayat.')
          else
            ...episodes.take(20).map(_episodeCard),
          const SizedBox(height: 16),
          if (entries.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 28),
              child: Center(
                child: Text(
                  s.dataError ?? 'Belum ada data riwayat dari backend.',
                  textAlign: TextAlign.center,
                  style: AppTheme.font(size: 13, color: AppTheme.textSecondary),
                ),
              ),
            ),
          ...entries.asMap().entries.map((e) {
            final idx = e.key;
            final step = e.value;
            final isLast = idx == entries.length - 1;
            final isSelected = _activeStep == idx;
            final color = isSelected ? AppTheme.primary : AppTheme.textMuted;

            return InkWell(
              onTap: () => setState(() => _activeStep = idx),
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Timeline indicator
                    Column(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: isSelected ? color : AppTheme.fieldFill,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isSelected ? color : AppTheme.borderLight,
                              width: 1.5,
                            ),
                          ),
                          child: Center(
                            child: Text(
                              step['time'].toString(),
                              style: AppTheme.font(
                                size: 11,
                                weight: FontWeight.w800,
                                color: isSelected
                                    ? Colors.white
                                    : AppTheme.textSecondary,
                              ),
                            ),
                          ),
                        ),
                        if (!isLast)
                          Container(
                            width: 2,
                            height: 70,
                            color: AppTheme.borderLight,
                          ),
                      ],
                    ),
                    const SizedBox(width: 12),

                    // Card Content
                    Expanded(
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isSelected
                                ? color.withValues(alpha: 0.6)
                                : AppTheme.borderLight,
                            width: isSelected ? 1.4 : 1,
                          ),
                          boxShadow: isSelected
                              ? [
                                  BoxShadow(
                                    color: color.withValues(alpha: 0.15),
                                    blurRadius: 8,
                                    offset: const Offset(0, 3),
                                  ),
                                ]
                              : AppTheme.shadowSoft,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    step['title'].toString(),
                                    style: AppTheme.font(
                                        size: 13.5, weight: FontWeight.w700),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: color.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    step['source'].toString(),
                                    style: AppTheme.font(
                                        size: 10.5,
                                        weight: FontWeight.w700,
                                        color: color),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              step['detail'].toString(),
                              style: AppTheme.font(
                                  size: 12,
                                  color: AppTheme.textSecondary,
                                  height: 1.35),
                            ),
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppTheme.fieldFill,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                step['recorded_at'].toString(),
                                style: AppTheme.font(
                                    size: 10.5,
                                    color: AppTheme.textMuted,
                                    weight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildChartCard(
    List<ChartPoint> points,
    String label,
    Color color,
    int caparPointCount,
    AppState state,
  ) {
    final isStreaming = _selectedChart == HistoryChart.streaming;
    final isCapar = _selectedChart == HistoryChart.capar;
    final isLoading =
        _selectedChart == HistoryChart.wearable && _isLoadingWearableHistory;
    final pointCount = isCapar
        ? caparPointCount
        : isStreaming
            ? points.length
            : _selectedChart == HistoryChart.polarCapar
                ? _weeklyPolar.length
                : _weeklyWearable.length;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderLight),
        boxShadow: AppTheme.shadowSoft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Grafik 7 hari terakhir',
                    style: AppTheme.font(size: 14, weight: FontWeight.w800)),
              ),
              IconButton(
                tooltip: 'Perbarui grafik dan analisis',
                onPressed: () async {
                  await Future.wait([
                    _loadWeeklyHistory(),
                    _refreshCaparData(),
                  ]);
                },
                icon:
                    const Icon(Icons.refresh_rounded, color: AppTheme.primary),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 7,
            runSpacing: 4,
            children: [
              _chartChoice('Wearable 7 hari', HistoryChart.wearable),
              _chartChoice('PolarData CAPAR', HistoryChart.polarCapar),
              _chartChoice('Analisis CAPAR', HistoryChart.capar),
              _chartChoice('Streaming langsung', HistoryChart.streaming),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: AppTheme.font(
                size: 11.5, weight: FontWeight.w700, color: color),
          ),
          const SizedBox(height: 8),
          if (isLoading)
            const SizedBox(
              height: 190,
              child: Center(child: CircularProgressIndicator()),
            )
          else if (points.isEmpty)
            SizedBox(
              height: 190,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    isStreaming
                        ? state.wearableBridge.isStreaming
                            ? 'Menunggu sampel HR berikutnya dari wearable.'
                            : 'Mulai streaming wearable di menu perangkat untuk melihat grafik langsung.'
                        : isCapar
                            ? 'Belum ada titik analisis CAPAR yang tersedia selama 7 hari terakhir.'
                            : _selectedChart == HistoryChart.polarCapar
                                ? _wearableHistoryError ??
                                    'Belum ada sampel PolarData CAPAR selama 7 hari terakhir.'
                                : _wearableHistoryError ??
                                    'Belum ada data wearable tersimpan selama 7 hari terakhir.',
                    textAlign: TextAlign.center,
                    style: AppTheme.font(
                        size: 12, color: AppTheme.textSecondary, height: 1.4),
                  ),
                ),
              ),
            )
          else
            SizedBox(
              height: 190,
              width: double.infinity,
              child: CustomPaint(
                painter: TrendChartPainter(points: points, color: color),
              ),
            ),
          const SizedBox(height: 5),
          Text(
            isCapar
                ? '$pointCount titik analisis personal dalam rentang 7 hari • data CAPAR tersedia 30 hari'
                : isStreaming
                    ? '${state.wearableBridge.isStreaming ? 'LIVE' : 'Streaming berhenti'} • $pointCount titik sesi ini • hingga 300 titik terbaru'
                    : 'Rerata per jam • $pointCount jam dengan sampel ${_selectedChart == HistoryChart.polarCapar ? 'PolarData CAPAR' : 'wearable'}',
            style: AppTheme.font(size: 10.5, color: AppTheme.textMuted),
          ),
          if ((_selectedChart == HistoryChart.wearable ||
                  _selectedChart == HistoryChart.polarCapar) &&
              _wearableHistoryError != null &&
              (_weeklyWearable.isNotEmpty || _weeklyPolar.isNotEmpty)) ...[
            const SizedBox(height: 6),
            Text(_wearableHistoryError!,
                style: AppTheme.font(size: 10.5, color: AppTheme.statusRed)),
          ],
        ],
      ),
    );
  }

  Widget _chartChoice(String label, HistoryChart chart) => ChoiceChip(
        label: Text(label),
        selected: _selectedChart == chart,
        onSelected: (_) => setState(() => _selectedChart = chart),
        labelStyle: AppTheme.font(
          size: 10.5,
          weight: FontWeight.w700,
          color: _selectedChart == chart
              ? AppTheme.primaryDark
              : AppTheme.textSecondary,
        ),
        selectedColor: AppTheme.primarySoft,
        visualDensity: VisualDensity.compact,
        side: BorderSide(
          color: _selectedChart == chart
              ? AppTheme.primaryLight
              : AppTheme.borderLight,
        ),
      );

  List<ChartPoint> _chartPoints(
      AppState state, List<Map<String, dynamic>> trajectory) {
    final records = switch (_selectedChart) {
      HistoryChart.wearable => _weeklyWearable,
      HistoryChart.capar => trajectory,
      HistoryChart.polarCapar => _weeklyPolar,
      HistoryChart.streaming => state.liveStreamReadings,
    };
    final field = switch (_selectedChart) {
      HistoryChart.capar => 'mahalanobis_distance',
      HistoryChart.polarCapar ||
      HistoryChart.wearable ||
      HistoryChart.streaming =>
        'heart_rate_bpm',
    };
    final points = records
        .map((record) {
          final date = _date(record['recorded_at']);
          final value = record[field];
          if (date == null || value is! num || !value.isFinite) return null;
          return ChartPoint(date, value.toDouble());
        })
        .whereType<ChartPoint>()
        .toList()
      ..sort((a, b) => a.time.compareTo(b.time));
    return points;
  }

  Widget _buildCaparLinkPrompt(BuildContext context) => Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: AppTheme.statusYellowBg,
          borderRadius: BorderRadius.circular(14),
          border:
              Border.all(color: AppTheme.statusYellow.withValues(alpha: 0.4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Data CAPAR belum tertaut ke akun ini',
              style: AppTheme.font(size: 12.5, weight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              'Baseline, episode, dan PolarData dari rekam medis lama baru dapat ditampilkan setelah akun CAPAR pasien ditautkan.',
              style: AppTheme.font(
                  size: 11.5, color: AppTheme.textSecondary, height: 1.35),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const ProfileScreen()),
                ),
                child: const Text('Buka profil untuk menautkan akun'),
              ),
            ),
          ],
        ),
      );

  Widget _sectionTitle(String title, int count) => Padding(
        padding: const EdgeInsets.only(bottom: 9),
        child: Row(
          children: [
            Expanded(
              child: Text(title,
                  style: AppTheme.font(size: 14, weight: FontWeight.w800)),
            ),
            Text('$count',
                style: AppTheme.font(size: 11, color: AppTheme.textMuted)),
          ],
        ),
      );

  Widget _baselineCard(Map<String, dynamic> baseline) {
    final featureStats = baseline['feature_stats'] is Map
        ? Map<String, dynamic>.from(baseline['feature_stats'] as Map)
        : <String, dynamic>{};
    final maturity = baseline['maturity_detail'] is Map
        ? Map<String, dynamic>.from(baseline['maturity_detail'] as Map)
        : <String, dynamic>{};
    final maturityPolicy = maturity['policy'] is Map
        ? Map<String, dynamic>.from(maturity['policy'] as Map)
        : <String, dynamic>{};
    final heartRate = featureStats['mean_hr'] is Map
        ? (featureStats['mean_hr'] as Map)['mean']
        : null;
    final rmssd = featureStats['rmssd'] is Map
        ? (featureStats['rmssd'] as Map)['mean']
        : null;
    final updatedAt = _date(baseline['last_updated']);
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: AppTheme.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${baseline['activity'] ?? 'Aktivitas tidak diketahui'} • ${baseline['time_period'] ?? 'Periode tidak diketahui'}',
            style: AppTheme.font(size: 12, weight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            'Kematangan: ${baseline['level'] ?? 'belum diketahui'} • ${baseline['segment_count'] ?? 0} segmen'
            '${heartRate is num ? ' • HR rerata ${heartRate.toStringAsFixed(1)} bpm' : ''}'
            '${rmssd is num ? ' • RMSSD ${rmssd.toStringAsFixed(1)} ms' : ''}',
            style: AppTheme.font(
                size: 10.5, color: AppTheme.textSecondary, height: 1.35),
          ),
          if (maturityPolicy['status'] is String)
            Text(
              'Status kebijakan baseline: ${maturityPolicy['status']}',
              style: AppTheme.font(
                  size: 10, color: AppTheme.textMuted, height: 1.3),
            ),
          if (updatedAt != null)
            Text(
              'Diperbarui ${updatedAt.toLocal()}',
              style: AppTheme.font(size: 10, color: AppTheme.textMuted),
            ),
        ],
      ),
    );
  }

  Widget _episodeCard(Map<String, dynamic> episode) {
    final startAt = _date(episode['start_at']);
    final duration = episode['duration_ms'];
    final recovery = episode['recovery_time_ms'];
    final thresholdPolicy = episode['threshold_policy'] is Map
        ? Map<String, dynamic>.from(episode['threshold_policy'] as Map)
        : <String, dynamic>{};
    final outcome = episode['outcome']?.toString() ?? 'belum terverifikasi';
    final statusColor = outcome == 'recovered'
        ? AppTheme.statusGreen
        : outcome == 'unresolved'
            ? AppTheme.statusRed
            : AppTheme.statusYellow;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: AppTheme.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${episode['classification'] ?? 'Episode CAPAR'} • ${episode['status'] ?? 'Status tidak tersedia'}',
                  style: AppTheme.font(size: 12, weight: FontWeight.w700),
                ),
              ),
              Text(
                outcome == 'recovered'
                    ? 'Pulih'
                    : outcome == 'unresolved'
                        ? 'Belum pulih'
                        : 'Belum terverifikasi',
                style: AppTheme.font(
                    size: 10.5, weight: FontWeight.w700, color: statusColor),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            [
              if (startAt != null) startAt.toLocal().toString(),
              if (episode['activity'] != null)
                'Aktivitas ${episode['activity']}',
              if (episode['peak_deviation'] is num)
                'Puncak ${episode['peak_deviation']}',
              if (duration is num)
                'Durasi ${(duration / 60000).toStringAsFixed(0)} menit',
              if (recovery is num)
                'Pulih ${(recovery / 60000).toStringAsFixed(0)} menit',
              if (episode['relapse_detected'] == true) 'Perubahan berulang',
            ].join(' • '),
            style: AppTheme.font(
                size: 10.5, color: AppTheme.textSecondary, height: 1.35),
          ),
          if (thresholdPolicy['status'] is String)
            Text(
              'Status kebijakan ambang: ${thresholdPolicy['status']}',
              style: AppTheme.font(
                  size: 10, color: AppTheme.textMuted, height: 1.3),
            ),
        ],
      ),
    );
  }

  Widget _reasoningPipelineCard(
    Map<String, dynamic> pipeline,
    List<Map<String, dynamic>> stages,
  ) {
    const stageLabels = {
      'sensing': 'Penginderaan',
      'quality_gate': 'Gerbang kualitas',
      'feature_engine': 'Ekstraksi fitur',
      'personal_baseline': 'Baseline personal',
      'evidence_fusion': 'Fusi bukti',
      'latent_state_estimation': 'Estimasi state',
      'temporal_reasoning': 'Analisis temporal',
      'resilience': 'Pemulihan / resiliensi',
      'decision_policy': 'Kebijakan tindakan',
      'patient_pedagogy': 'Panduan pasien',
      'feedback': 'Umpan balik',
    };
    String statusLabel(String? status) => switch (status) {
          'available' || 'passed' || 'mature' => 'Tersedia',
          'available_with_limits' => 'Tersedia dengan batasan',
          'single_source' => 'Satu sumber bukti',
          'historical_only' => 'Riwayat saja, belum ada data terkini',
          'conflicting_evidence' => 'Bukti berbeda',
          'insufficient_data' => 'Data belum cukup',
          'awaiting_patient_context' => 'Menunggu konteks Anda',
          'patient_feedback_recorded' => 'Konteks pasien tercatat',
          'no_feedback_recorded' => 'Belum ada umpan balik',
          'not_required' => 'Tidak diperlukan saat ini',
          'not_calibrated' => 'Belum tervalidasi / terkalibrasi',
          'not_integrated' => 'Belum terintegrasi',
          'not_collected' => 'Belum dikumpulkan',
          _ => status?.replaceAll('_', ' ') ?? 'Belum tersedia',
        };
    String stageDetail(Map<String, dynamic> stage) {
      switch (stage['stage_id']) {
        case 'sensing':
          return '${stage['accepted_feature_windows'] ?? 0} jendela sensor diterima • '
              '${stage['symptom_records'] ?? 0} gejala • '
              '${stage['context_check_ins'] ?? 0} check-in';
        case 'quality_gate':
          return '${stage['accepted_windows'] ?? 0} lolos • '
              '${stage['rejected_windows'] ?? 0} tidak digunakan';
        case 'feature_engine':
          return '${stage['feature_count'] ?? 0} fitur tersedia';
        case 'personal_baseline':
          final activity = stage['activity']?.toString();
          final period = stage['time_period']?.toString();
          final context = [activity, period]
              .where((value) => value != null && value.isNotEmpty)
              .join(' • ');
          return context.isEmpty
              ? 'Baseline konteks yang sesuai belum tersedia'
              : '$context • ${stage['segment_count'] ?? 0} segmen';
        case 'evidence_fusion':
          final sources = stage['available_source_count'] ?? 0;
          final conflicts = stage['conflicts'] is List
              ? (stage['conflicts'] as List).length
              : 0;
          return '$sources sumber bukti tersedia • $conflicts konflik tercatat';
        case 'latent_state_estimation':
          return stage['state']?.toString().replaceAll('_', ' ') ??
              'State statistik personal belum tersedia';
        case 'temporal_reasoning':
          return '${stage['evaluated_windows'] ?? 0} jendela • '
              '${stage['episode_count'] ?? 0} episode';
        case 'resilience':
          final progress = stage['recovery_progress_pct'];
          return progress is num
              ? 'Progres pemulihan tercatat: ${progress.toStringAsFixed(0)}%'
              : statusLabel(stage['status']?.toString());
        case 'decision_policy':
          return stage['action']?.toString().replaceAll('_', ' ') ??
              'Panduan tindakan belum tersedia';
        case 'patient_pedagogy':
          final sections = stage['sections'] is List
              ? (stage['sections'] as List).length
              : 0;
          return '$sections pertanyaan panduan';
        case 'feedback':
          return 'Langkah tercatat: ${stage['patient_reported_action_recorded'] == true ? 'ya' : 'belum'} • '
              'Respons pribadi: ${stage['patient_reported_response_recorded'] == true ? 'tercatat' : 'belum tercatat'}';
        default:
          return '';
      }
    }

    final posterior = pipeline['probabilistic_posterior'] is Map
        ? Map<String, dynamic>.from(pipeline['probabilistic_posterior'] as Map)
        : <String, dynamic>{};
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.borderLight),
        boxShadow: AppTheme.shadowSoft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Alur penalaran NadiKu',
              style: AppTheme.font(size: 14, weight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(
            'Sensor → fusi bukti → state → waktu/pemulihan → tindakan → edukasi → umpan balik',
            style: AppTheme.font(
                size: 11.5, color: AppTheme.textSecondary, height: 1.35),
          ),
          const SizedBox(height: 10),
          ...stages.map((stage) {
            final stageId = stage['stage_id']?.toString() ?? '';
            final status = stage['status']?.toString();
            final color = status == 'conflicting_evidence'
                ? AppTheme.statusOrange
                : status == 'insufficient_data' ||
                        status == 'awaiting_patient_context'
                    ? AppTheme.statusYellow
                    : AppTheme.primary;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    status == 'conflicting_evidence'
                        ? Icons.warning_amber_rounded
                        : status == 'insufficient_data'
                            ? Icons.remove_circle_outline
                            : Icons.check_circle_outline,
                    size: 16,
                    color: color,
                  ),
                  const SizedBox(width: 7),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${stageLabels[stageId] ?? stageId}: ${statusLabel(status)}',
                          style: AppTheme.font(
                              size: 11.5,
                              weight: FontWeight.w700,
                              color: AppTheme.textPrimary),
                        ),
                        Text(
                          stageDetail(stage),
                          style: AppTheme.font(
                              size: 10.5,
                              color: AppTheme.textMuted,
                              height: 1.3),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 8),
          Text(
            'P(X_t | T(t)): ${statusLabel(posterior['status']?.toString())}. '
            'Distribusi probabilitas tidak ditampilkan karena belum tervalidasi dan terkalibrasi. '
            'Estimasi state yang tersedia hanya perbandingan statistik terhadap baseline personal, bukan diagnosis.',
            style: AppTheme.font(
                size: 11,
                color: AppTheme.textSecondary,
                height: 1.35,
                weight: FontWeight.w600),
          ),
        ],
      ),
    );
  }

  Widget _emptyHistoryCard(String message) => Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: AppTheme.fieldFill,
          borderRadius: BorderRadius.circular(13),
        ),
        child: Text(message,
            style: AppTheme.font(
                size: 11.5, color: AppTheme.textSecondary, height: 1.35)),
      );

  DateTime? _date(dynamic value) {
    if (value is DateTime) return value;
    return DateTime.tryParse(value?.toString() ?? '');
  }

  List<Map<String, String>> _entries(AppState state) {
    final entries = <Map<String, String>>[];
    void add(Map<String, dynamic> data, String timeKey, String title,
        String source, String detail) {
      final recordedAt = DateTime.tryParse(data[timeKey]?.toString() ?? '');
      if (recordedAt == null) return;
      entries.add({
        'sort': recordedAt.toIso8601String(),
        'recorded_at': recordedAt.toLocal().toString(),
        'time': recordedAt.toLocal().hour.toString().padLeft(2, '0'),
        'title': title,
        'source': source,
        'detail': detail,
      });
    }

    if (_hasLoadedWeeklyEvents) {
      for (final event in _weeklyEvents) {
        add(
          event,
          'occurred_at',
          event['event_type']?.toString() ?? 'Event pasien',
          'Event pasien',
          event['details']?.toString() ?? 'Event tercatat.',
        );
      }
    } else {
      for (final event in state.events) {
        add(
          {
            'occurred_at': event.timestamp.toIso8601String(),
            'details': event.details
          },
          'occurred_at',
          event.title,
          'Event pasien',
          event.details,
        );
      }
    }
    final checkIns = _hasLoadedWeeklyCheckIns
        ? _weeklyCheckIns
        : state.dailySummaryData?['check_ins'];
    if (checkIns is List) {
      for (final item in checkIns.whereType<Map>()) {
        final record = Map<String, dynamic>.from(item);
        add(record, 'recorded_at', 'Check-in pasien', 'Input pasien',
            record['note']?.toString() ?? 'Data check-in tersimpan.');
      }
    }

    for (final sample in state.wearableSamples) {
      add(sample, 'recorded_at', 'Sampel wearable', 'Wearable',
          'HR ${sample['heart_rate_bpm'] ?? '—'} bpm • Aktivitas ${sample['activity'] ?? '—'}');
    }
    final capar = state.rawCaparInsights?['capar'];
    final trajectory = capar is Map ? capar['trajectory_30d'] : null;
    if (trajectory is List) {
      for (final item in trajectory.whereType<Map>().take(100)) {
        final record = Map<String, dynamic>.from(item);
        add(record, 'recorded_at', 'Analisis CAPAR', 'CAPAR',
            'State ${record['personal_state'] ?? '—'} • Mahalanobis ${record['mahalanobis_distance'] ?? '—'}');
      }
    }

    final caparData = capar is Map ? capar : null;
    final polarData = caparData?['polar_data'];
    if (polarData is List) {
      for (final item in polarData.whereType<Map>().take(30)) {
        final record = Map<String, dynamic>.from(item);
        add(
          record,
          'recorded_at',
          'Data Polar CAPAR',
          'PolarData',
          'HR ${record['hr'] ?? '—'} bpm • RR ${record['rr'] ?? '—'} ms • ${record['activity'] ?? 'Aktivitas tidak tercatat'}',
        );
      }
    }
    final episodes = caparData?['episode_history'];
    if (episodes is List) {
      for (final item in episodes.whereType<Map>().take(50)) {
        final record = Map<String, dynamic>.from(item);
        add(
          record,
          'start_at',
          'Episode CAPAR',
          'Episode',
          'Outcome ${record['outcome'] ?? 'belum diverifikasi'} • State ${record['status'] ?? '—'}'
              '${record['recovery_time_ms'] is num ? ' • Recovery ${(record['recovery_time_ms'] as num) / 60000} menit' : ''}',
        );
      }
    }
    final memories = caparData?['cognitive_memories'];
    if (memories is List) {
      for (final item in memories.whereType<Map>().take(20)) {
        final record = Map<String, dynamic>.from(item);
        add(
          record,
          'epoch_timestamp',
          'Memori kognitif CAPAR ${record['week_id'] ?? ''}',
          'Cognitive memory',
          'Faktor terkonfirmasi pasien: ${(record['behavioral_factors_snapshot'] as List?)?.length ?? 0}',
        );
      }
    }
    entries.sort((a, b) => b['sort']!.compareTo(a['sort']!));
    return entries;
  }
}
