import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import 'history_trend_chart.dart';

class CaparHistoryScreen extends StatefulWidget {
  const CaparHistoryScreen({super.key});

  @override
  State<CaparHistoryScreen> createState() => _CaparHistoryScreenState();
}

class _CaparHistoryScreenState extends State<CaparHistoryScreen> {
  static const _categories = <(String, String)>[
    ('all', 'Semua'),
    ('baseline', 'Baseline'),
    ('deviation', 'Deviasi'),
    ('recovery', 'Recovery'),
    ('recording', 'Rekaman'),
    ('learning', 'Pembelajaran'),
    ('ema', 'EMA'),
  ];
  static const _chartMetrics = <(String, String)>[
    ('heart_rate', 'Detak jantung'),
    ('deviation', 'Deviasi'),
    ('ema', 'EMA'),
  ];

  final _dateFormat = DateFormat('dd MMM yyyy, HH:mm');
  List<Map<String, dynamic>> _baselines = [];
  List<Map<String, dynamic>> _records = [];
  String _category = 'all';
  String _chartMetric = 'heart_rate';
  String? _nextBefore;
  String? _error;
  String _status = 'available';
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = false;

  Map<String, dynamic> _map(dynamic value) =>
      value is Map<String, dynamic> ? value : <String, dynamic>{};

  List<Map<String, dynamic>> _maps(dynamic value) => value is List
      ? value
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList()
      : <Map<String, dynamic>>[];

  @override
  void initState() {
    super.initState();
    _loadHistory(reset: true);
  }

  Future<void> _loadHistory({required bool reset}) async {
    if (reset) {
      setState(() {
        _loading = true;
        _loadingMore = false;
        _error = null;
        _records = [];
        _nextBefore = null;
        _hasMore = false;
      });
    } else {
      setState(() {
        _loadingMore = true;
        _error = null;
      });
    }

    final response = await ApiService.getCaparHistory(
      category: _category,
      before: reset ? null : _nextBefore,
    );
    if (!mounted) return;
    if (!response.success || response.data == null) {
      setState(() {
        _loading = false;
        _loadingMore = false;
        _error = response.message ?? 'Histori CAPAR gagal dimuat.';
      });
      return;
    }
    final data = response.data!;
    final page = _map(data['page']);
    setState(() {
      _status = data['status']?.toString() ?? 'available';
      _baselines = _maps(data['baselines']);
      if (reset) {
        _records = _maps(data['records']);
      } else {
        _records.addAll(_maps(data['records']));
      }
      _nextBefore = page['next_before']?.toString();
      _hasMore = page['has_more'] == true;
      _loading = false;
      _loadingMore = false;
    });
  }

  Future<void> _selectCategory(String category) async {
    if (_category == category || _loading || _loadingMore) return;
    setState(() => _category = category);
    await _loadHistory(reset: true);
  }

  DateTime? _date(dynamic value) {
    if (value is DateTime) return value;
    if (value is num) return DateTime.fromMillisecondsSinceEpoch(value.toInt());
    if (value is String) return DateTime.tryParse(value);
    return null;
  }

  String _formatDate(dynamic value) {
    final date = _date(value);
    return date == null
        ? 'Waktu tidak tersedia'
        : _dateFormat.format(date.toLocal());
  }

  String _activityLabel(String? value) => switch (value) {
        'Rest' => 'Istirahat',
        'Light' => 'Aktivitas ringan',
        'Moderate' => 'Aktivitas sedang',
        'Intense' => 'Aktivitas intens',
        'Unknown' || null || '' => 'Aktivitas tidak diketahui',
        _ => value,
      };

  String _maturityLabel(String? value) => switch (value) {
        'mature' || 'mature_legacy' => 'Matang',
        'maturing' => 'Dalam pembentukan',
        'provisional' => 'Sementara',
        'cold_start' => 'Baru mulai',
        _ => value?.replaceAll('_', ' ') ?? 'Belum diketahui',
      };

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Histori CAPAR'),
          actions: [
            IconButton(
              tooltip: 'Muat ulang histori',
              onPressed: _loading || _loadingMore
                  ? null
                  : () => _loadHistory(reset: true),
              icon: const Icon(Icons.refresh_rounded),
            ),
          ],
        ),
        body: RefreshIndicator(
          onRefresh: () => _loadHistory(reset: true),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _introCard(),
              const SizedBox(height: 12),
              _baselineSection(),
              const SizedBox(height: 16),
              _historyChart(),
              const SizedBox(height: 16),
              Text(
                'Riwayat rekaman dan analisis',
                style: AppTheme.font(size: 16, weight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: _categories.map((item) {
                    final selected = _category == item.$1;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(item.$2),
                        selected: selected,
                        onSelected: _loading || _loadingMore
                            ? null
                            : (_) => _selectCategory(item.$1),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 8),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_error != null)
                _messageCard(_error!, isError: true)
              else if (_status == 'link_required')
                _messageCard(
                  'Akun CAPAR belum tertaut. Tautkan akun CAPAR dari Profil untuk menampilkan data historisnya.',
                )
              else if (_category == 'baseline')
                _messageCard(
                  'Ringkasan konteks baseline CAPAR ditampilkan di atas. Baseline merekam statistik per aktivitas dan periode waktu.',
                )
              else if (_records.isEmpty)
                _messageCard(
                  'Belum ada rekaman CAPAR pada kategori ini. Data yang tersedia akan muncul di sini setelah CAPAR menyimpannya.',
                )
              else ...[
                ..._records.map(_recordCard),
                if (_loadingMore)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                if (_hasMore)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: OutlinedButton.icon(
                      onPressed: _loadingMore
                          ? null
                          : () => _loadHistory(reset: false),
                      icon: const Icon(Icons.expand_more_rounded),
                      label: const Text('Muat histori sebelumnya'),
                    ),
                  )
                else
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text(
                      'Semua data yang tersedia untuk filter ini sudah ditampilkan.',
                      textAlign: TextAlign.center,
                      style: AppTheme.font(size: 11, color: AppTheme.textMuted),
                    ),
                  ),
              ],
            ],
          ),
        ),
      );

  Widget _introCard() => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.primarySoft,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: AppTheme.primaryLight.withValues(alpha: 0.3),
          ),
        ),
        child: Text(
          'Histori ini memuat baseline CAPAR, rekaman yang telah dianalisis, deviasi, dan evaluasi pemulihan yang tersimpan di server. Gunakan filter untuk melihat jenis data tertentu; tombol muat histori mengambil data yang lebih lama.',
          style: AppTheme.font(
            size: 12,
            color: AppTheme.primaryDark,
            height: 1.4,
            weight: FontWeight.w600,
          ),
        ),
      );

  Widget _baselineSection() => Card(
        margin: EdgeInsets.zero,
        child: ExpansionTile(
          leading: const Icon(
            Icons.equalizer_rounded,
            color: AppTheme.primary,
          ),
          title: Text(
            'Baseline personal CAPAR',
            style: AppTheme.font(size: 14, weight: FontWeight.w800),
          ),
          subtitle: Text(
            '${_baselines.length} konteks · ketuk untuk melihat penjelasan',
            style: AppTheme.font(size: 10.5, color: AppTheme.textMuted),
          ),
          childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          children: [
            Text(
              'Baseline adalah rentang acuan personal berdasarkan aktivitas dan waktu. Status matang menunjukkan data sudah memenuhi kriteria CAPAR; baseline sementara masih dapat berubah seiring rekaman baru.',
              style: AppTheme.font(
                size: 11,
                color: AppTheme.textSecondary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 8),
            if (_baselines.isEmpty)
              _messageCard('Belum ada baseline CAPAR tersimpan.')
            else
              ..._baselines.map(_baselineCard),
          ],
        ),
      );

  List<ChartPoint> _historyChartPoints() {
    final points = <ChartPoint>[];
    for (final item in _records) {
      final type = item['type']?.toString();
      final features = _map(item['features']);
      num? value;
      switch (_chartMetric) {
        case 'heart_rate':
          value = switch (type) {
            'polar_reading' => item['heart_rate_bpm'] as num?,
            'recording' || 'recovery_analysis' => features['mean_hr'] as num?,
            'deviation' || 'recovery' => item['peak_hr'] as num?,
            _ => null,
          };
        case 'deviation':
          value = switch (type) {
            'recording' => item['anomaly_score'] as num?,
            'deviation' || 'recovery' => item['peak_score'] as num?,
            'recovery_analysis' => item['peak_deviation'] as num?,
            _ => null,
          };
        case 'ema':
          if (type == 'ema_response') {
            final symptom = item['symptom_intensity'] as num?;
            final disruption = item['disruption_score'] as num?;
            value = symptom != null && symptom > 0
                ? symptom
                : disruption != null && disruption > 0
                    ? disruption
                    : null;
          }
      }
      final recordedAt = _date(item['recorded_at']);
      if (value != null && recordedAt != null) {
        points.add(ChartPoint(recordedAt, value.toDouble()));
      }
    }
    points.sort((a, b) => a.time.compareTo(b.time));
    return points;
  }

  Widget _historyChart() {
    final points = _historyChartPoints();
    final label = switch (_chartMetric) {
      'heart_rate' => 'Detak jantung (bpm)',
      'deviation' => 'Skor deviasi CAPAR',
      _ => 'Intensitas EMA (skala 0–10)',
    };
    final color = switch (_chartMetric) {
      'deviation' => AppTheme.statusOrange,
      'ema' => AppTheme.statusYellow,
      _ => AppTheme.primary,
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Grafik histori',
          style: AppTheme.font(size: 15, weight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: _chartMetrics.map((metric) {
              final selected = _chartMetric == metric.$1;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(metric.$2),
                  selected: selected,
                  onSelected: (_) => setState(() => _chartMetric = metric.$1),
                ),
              );
            }).toList(),
          ),
        ),
        Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
            child: points.isEmpty
                ? _messageCard(
                    'Belum ada data ${label.toLowerCase()} pada histori yang dimuat.',
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: AppTheme.font(
                          size: 11,
                          color: AppTheme.textSecondary,
                          weight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        height: 190,
                        width: double.infinity,
                        child: CustomPaint(
                          painter:
                              TrendChartPainter(points: points, color: color),
                        ),
                      ),
                      Text(
                        'Grafik berdasarkan ${points.length} titik data yang sudah dimuat.',
                        style:
                            AppTheme.font(size: 10, color: AppTheme.textMuted),
                      ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }

  Widget _baselineCard(Map<String, dynamic> item) {
    final maturity = _map(item['maturity_detail']);
    final stats = _map(item['feature_stats']);
    final hr = _map(stats['mean_hr'])['mean'];
    final rmssd = _map(stats['rmssd'])['mean'];
    final failedGates = maturity['failed_gates'] is List
        ? (maturity['failed_gates'] as List).whereType<String>().toList()
        : <String>[];
    final level = item['level']?.toString() ?? maturity['level']?.toString();
    final mature = level == 'mature' || level == 'mature_legacy';
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.equalizer_rounded,
                  color: mature ? AppTheme.statusGreen : AppTheme.statusYellow,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${_activityLabel(item['activity']?.toString())} · ${item['time_period'] ?? 'Waktu tidak diketahui'}',
                    style: AppTheme.font(size: 12.5, weight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 5),
            Text(
              '${_maturityLabel(level)} · ${item['segment_count'] ?? 0} segmen'
              '${maturity['n_effective'] is num ? ' · ${(maturity['n_effective'] as num).toStringAsFixed(1)} window efektif' : ''}'
              '${maturity['distinct_days'] is num ? ' · ${maturity['distinct_days']} hari' : ''}'
              '${hr is num ? ' · HR ${hr.toStringAsFixed(1)} bpm' : ''}'
              '${rmssd is num ? ' · RMSSD ${rmssd.toStringAsFixed(1)} ms' : ''}',
              style: AppTheme.font(
                size: 11,
                color: AppTheme.textSecondary,
                height: 1.4,
              ),
            ),
            if (failedGates.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  'Syarat yang belum terpenuhi: ${failedGates.join('; ')}',
                  style: AppTheme.font(size: 10.5, color: AppTheme.textMuted),
                ),
              ),
            Text(
              'Diperbarui ${_formatDate(item['last_updated'])}',
              style: AppTheme.font(size: 10, color: AppTheme.textMuted),
            ),
          ],
        ),
      ),
    );
  }

  Widget _recordCard(Map<String, dynamic> item) {
    final type = item['type']?.toString() ?? '';
    final features = _map(item['features']);
    final title = switch (type) {
      'recording' => 'Rekaman CAPAR · ${item['state'] ?? 'dianalisis'}',
      'polar_reading' =>
        'Rekaman sensor Polar · ${item['state'] ?? 'tersimpan'}',
      'deviation' =>
        'Deviasi · ${item['classification'] ?? item['state'] ?? 'tercatat'}',
      'recovery' => 'Episode · ${item['state'] ?? 'pemulihan tercatat'}',
      'recovery_analysis' =>
        'Analisis pemulihan · ${item['state'] ?? 'tercatat'}',
      'learning_memory' =>
        'Snapshot pembelajaran · ${item['week_id'] ?? 'mingguan'}',
      'learning_transitions' =>
        'Transisi CAPAR · ${item['activity'] ?? 'konteks'}',
      'ema_response' => 'EMA · tahap ${item['step_completed'] ?? '-'}',
      _ => 'Data CAPAR',
    };
    final details = <String>[
      if (item['activity'] != null)
        'Aktivitas ${_activityLabel(item['activity'].toString())}',
      if (item['time_period'] != null) 'Periode ${item['time_period']}',
      if (_map(item['baseline_context']).isNotEmpty)
        'Konteks baseline ${_activityLabel(_map(item['baseline_context'])['activity']?.toString())} (${_maturityLabel(_map(item['baseline_context'])['level']?.toString())})',
      if (type == 'recording' && features['mean_hr'] is num)
        'HR ${features['mean_hr']} bpm',
      if (type == 'recording' && features['rmssd'] is num)
        'RMSSD ${features['rmssd']} ms',
      if (type == 'recording' && item['quality'] is num)
        'Kualitas ${((item['quality'] as num) * 100).toStringAsFixed(0)}%',
      if (type == 'polar_reading' && item['heart_rate_bpm'] is num)
        'HR ${item['heart_rate_bpm']} bpm',
      if (type == 'polar_reading' && item['rr_interval_ms'] is num)
        'RR ${item['rr_interval_ms']} ms',
      if (type == 'polar_reading' && item['device_id'] != null)
        'Perangkat ${item['device_id']}',
      if (type == 'deviation' && item['peak_score'] is num)
        'Skor puncak ${item['peak_score']}',
      if (type == 'deviation' && item['peak_hr'] is num)
        'HR puncak ${item['peak_hr']} bpm',
      if (type == 'deviation' && item['baseline_hr'] is num)
        'HR baseline ${item['baseline_hr']} bpm',
      if (type == 'recovery_analysis' && item['recovery_duration_ms'] is num)
        'Durasi pemulihan ${((item['recovery_duration_ms'] as num) / 60000).toStringAsFixed(1)} menit',
      if (type == 'recovery_analysis' && item['time_to_recovery_ms'] is num)
        'Waktu ke recovery ${((item['time_to_recovery_ms'] as num) / 60000).toStringAsFixed(1)} menit',
      if (type == 'recovery_analysis' && item['relapse_detected'] == true)
        'Relapse terdeteksi (${item['relapse_count'] ?? 0})',
      if (type == 'learning_memory' && item['resilience_score'] is num)
        'Skor resiliensi ${item['resilience_score']}',
      if (type == 'learning_memory' && item['confirmed_factors'] is List)
        'Faktor terkonfirmasi ${(item['confirmed_factors'] as List).length}',
      if (type == 'learning_transitions')
        '${item['total_transitions'] ?? 0} transisi tercatat',
      if (type == 'ema_response' && item['ema_activity'] is String)
        'Aktivitas ${item['ema_activity']}',
      if (type == 'ema_response' && item['symptom'] is String)
        'Keluhan ${item['symptom']}',
      if (type == 'ema_response' && item['symptom_intensity'] is num)
        'Intensitas ${item['symptom_intensity']}/10',
      if (type == 'ema_response' && item['trigger'] is String)
        'Pemicu ${item['trigger']}',
      if (type == 'ema_response' && item['sleep_status'] is String)
        'Tidur ${item['sleep_status']}',
      if (type == 'ema_response' && item['sleep_hours'] is num)
        'Durasi tidur ${item['sleep_hours']} jam',
      if (type == 'ema_response' && item['medication_intake'] is String)
        'Obat/suplemen ${item['medication_intake']}',
      if (type == 'ema_response' && item['recovery_status'] is String)
        'Pemulihan ${item['recovery_status']}',
      if (type == 'ema_response' && item['context_change'] is String)
        'Perubahan konteks ${item['context_change']}',
      if (type == 'ema_response' && item['primary_trigger'] is String)
        'Pemicu utama ${item['primary_trigger']}',
      if (type == 'ema_response' && item['overall_condition'] is String)
        'Kondisi ${item['overall_condition']}',
      if (type == 'ema_response' && item['disruption_score'] is num)
        'Dampak ${item['disruption_score']}/10',
      if (type == 'ema_response' && item['intervention_note'] is String)
        'Tindakan ${item['intervention_note']}',
      if (type == 'ema_response' && item['medication_detail'] is String)
        'Catatan obat ${item['medication_detail']}',
      if (type == 'recovery' && item['recovery_time_ms'] is num)
        'Waktu pemulihan ${((item['recovery_time_ms'] as num) / 60000).toStringAsFixed(1)} menit',
      if (item['duration_ms'] is num)
        'Durasi ${((item['duration_ms'] as num) / 60000).toStringAsFixed(1)} menit',
      if (item['quality_gate_passed'] is bool)
        'Quality gate ${item['quality_gate_passed'] == true ? 'lolos' : 'tidak lolos'}',
    ];
    final color = switch (type) {
      'deviation' => AppTheme.statusOrange,
      'recovery' || 'recovery_analysis' => AppTheme.statusGreen,
      'learning_memory' || 'learning_transitions' => AppTheme.statusYellow,
      'ema_response' => AppTheme.statusYellow,
      'polar_reading' => AppTheme.primaryLight,
      _ => AppTheme.primary,
    };
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: color.withValues(alpha: 0.12),
          child: Icon(
            switch (type) {
              'deviation' => Icons.warning_amber_rounded,
              'recovery' || 'recovery_analysis' => Icons.healing_rounded,
              'learning_memory' ||
              'learning_transitions' =>
                Icons.psychology_alt_rounded,
              'ema_response' => Icons.assignment_turned_in_outlined,
              'polar_reading' => Icons.favorite_rounded,
              _ => Icons.sensors_rounded,
            },
            color: color,
          ),
        ),
        title: Text(title,
            style: AppTheme.font(size: 12, weight: FontWeight.w700)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            '${_formatDate(item['recorded_at'])}${details.isEmpty ? '' : '\n${details.join(' · ')}'}',
            style: AppTheme.font(
              size: 10.5,
              color: AppTheme.textSecondary,
              height: 1.4,
            ),
          ),
        ),
        isThreeLine: details.isNotEmpty,
      ),
    );
  }

  Widget _messageCard(String message, {bool isError = false}) => Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isError ? const Color(0xFFFFF1F0) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isError ? const Color(0xFFF4C7C3) : AppTheme.borderLight,
          ),
        ),
        child: Text(
          message,
          style: AppTheme.font(
            size: 11.5,
            color: isError ? const Color(0xFF9F2D20) : AppTheme.textSecondary,
            height: 1.4,
          ),
        ),
      );
}
