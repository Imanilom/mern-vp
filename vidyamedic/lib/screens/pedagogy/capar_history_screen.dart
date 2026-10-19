import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

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
  ];

  final _dateFormat = DateFormat('dd MMM yyyy, HH:mm');
  List<Map<String, dynamic>> _baselines = [];
  List<Map<String, dynamic>> _records = [];
  String _category = 'all';
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

  Widget _baselineSection() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Baseline personal CAPAR',
            style: AppTheme.font(size: 15, weight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          if (_baselines.isEmpty)
            _messageCard('Belum ada baseline CAPAR tersimpan.')
          else
            ..._baselines.map(_baselineCard),
        ],
      );

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
