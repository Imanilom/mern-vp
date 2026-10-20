import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../providers/app_state.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';
import 'pedagogy_screen_what_changed.dart';

class WhereAmIScreen extends StatefulWidget {
  const WhereAmIScreen({super.key});

  @override
  State<WhereAmIScreen> createState() => _WhereAmIScreenState();
}

class _WhereAmIScreenState extends State<WhereAmIScreen> {
  late DateTime _selectedDate;
  List<Map<String, dynamic>> _wearableReadings = [];
  Map<String, dynamic> _dailySummary = {};
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _selectedDate = DateUtils.dateOnly(DateTime.now());
    WidgetsBinding.instance
        .addPostFrameCallback((_) => _loadDate(_selectedDate));
  }

  Future<void> _selectDate() async {
    final selected = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2000),
      lastDate: DateUtils.dateOnly(DateTime.now()),
      helpText: 'Pilih tanggal kondisi',
    );
    if (selected == null || !mounted) return;
    await _loadDate(DateUtils.dateOnly(selected));
  }

  Future<void> _moveDate(int days) async {
    final next = _selectedDate.add(Duration(days: days));
    if (next.isAfter(DateUtils.dateOnly(DateTime.now()))) return;
    await _loadDate(next);
  }

  Future<void> _loadDate(DateTime date) async {
    final day = DateUtils.dateOnly(date);
    final from = DateTime(day.year, day.month, day.day).toUtc();
    final to = DateTime(day.year, day.month, day.day + 1)
        .subtract(const Duration(milliseconds: 1))
        .toUtc();
    setState(() {
      _selectedDate = day;
      _loading = true;
      _error = null;
      _wearableReadings = [];
      _dailySummary = {};
    });
    final results = await Future.wait([
      ApiService.getWearableHistory(from: from, to: to, bucketMinutes: 15),
      ApiService.getDailySummary(DateFormat('yyyy-MM-dd').format(day)),
    ]);
    if (!mounted) return;
    final wearable = results[0] as ApiResponse<List<dynamic>>;
    final summary = results[1] as ApiResponse<Map<String, dynamic>>;
    setState(() {
      if (wearable.success && wearable.data != null) {
        _wearableReadings = wearable.data!
            .whereType<Map>()
            .map((record) => Map<String, dynamic>.from(record))
            .toList()
          ..sort((a, b) =>
              _date(a['recorded_at']).compareTo(_date(b['recorded_at'])));
      }
      if (summary.success && summary.data != null) {
        _dailySummary = summary.data!;
      }
      final errors = [
        if (!wearable.success)
          wearable.message ?? 'Riwayat wearable gagal dimuat.',
        if (!summary.success) summary.message ?? 'Catatan harian gagal dimuat.',
      ];
      _error = errors.isEmpty ? null : errors.join(' ');
      _loading = false;
    });
  }

  DateTime _date(dynamic value) =>
      DateTime.tryParse(value?.toString() ?? '') ?? DateTime(1970);

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final capar = state.rawCaparInsights?['capar'];
    final trajectory = capar is Map && capar['trajectory_30d'] is List
        ? (capar['trajectory_30d'] as List)
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .where((item) =>
                DateUtils.isSameDay(_date(item['recorded_at']), _selectedDate))
            .toList()
        : <Map<String, dynamic>>[];
    final deviation = trajectory.isEmpty ? null : trajectory.last;
    final checkIns = _dailySummary['check_ins'];
    final latestCheckIn =
        checkIns is List && checkIns.isNotEmpty && checkIns.last is Map
            ? Map<String, dynamic>.from(checkIns.last as Map)
            : <String, dynamic>{};
    final sleep = latestCheckIn['sleep'] is Map
        ? Map<String, dynamic>.from(latestCheckIn['sleep'] as Map)
        : <String, dynamic>{};
    final latestWearable = _wearableReadings.isEmpty
        ? <String, dynamic>{}
        : _wearableReadings.last;
    final measures = <(String, String)>[
      if (latestWearable['heart_rate_bpm'] is num)
        (
          'Detak jantung',
          '${(latestWearable['heart_rate_bpm'] as num).toStringAsFixed(0)} bpm'
        ),
      if (latestWearable['rmssd_ms'] is num)
        (
          'HRV RMSSD',
          '${(latestWearable['rmssd_ms'] as num).toStringAsFixed(1)} ms'
        ),
      if (latestWearable['spo2_pct'] is num)
        ('SpO₂', '${(latestWearable['spo2_pct'] as num).toStringAsFixed(0)}%'),
      if (deviation?['mahalanobis_distance'] is num)
        (
          'Jarak dari baseline',
          (deviation!['mahalanobis_distance'] as num).toStringAsFixed(2)
        ),
      if (sleep['duration_minutes'] is num)
        (
          'Tidur tercatat',
          '${((sleep['duration_minutes'] as num) / 60).toStringAsFixed(1)} jam'
        ),
    ];
    final displayName =
        state.userProfile.name.isEmpty ? 'Anda' : state.userProfile.name;
    final hasData = latestCheckIn.isNotEmpty ||
        _wearableReadings.isNotEmpty ||
        deviation != null;
    final dateLabel =
        DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(_selectedDate);

    return MockupScaffold(
      title: 'Kondisi Saat Ini',
      subtitle: Text(dateLabel),
      trailing: IconButton(
        tooltip: 'Pilih tanggal',
        onPressed: _selectDate,
        icon:
            const Icon(Icons.calendar_month_outlined, color: AppTheme.primary),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                tooltip: 'Hari sebelumnya',
                onPressed: () => _moveDate(-1),
                icon: const Icon(Icons.chevron_left_rounded),
              ),
              TextButton.icon(
                onPressed: _selectDate,
                icon: const Icon(Icons.event_outlined, size: 18),
                label: Text(
                    DateFormat('d MMM yyyy', 'id_ID').format(_selectedDate)),
              ),
              IconButton(
                tooltip: 'Hari berikutnya',
                onPressed: DateUtils.isSameDay(_selectedDate, DateTime.now())
                    ? null
                    : () => _moveDate(1),
                icon: const Icon(Icons.chevron_right_rounded),
              ),
            ],
          ),
          if (_loading) const LinearProgressIndicator(),
          Text('Halo, $displayName',
              style: AppTheme.font(size: 17, weight: FontWeight.w800)),
          const SizedBox(height: 12),
          if (_error != null)
            _messageCard(_error!, isError: true)
          else if (!_loading && !hasData)
            _messageCard(
              'Belum ada catatan untuk tanggal ini. Data yang tidak tercatat tidak dianggap normal. Pilih tanggal lain atau rekam data wearable dan catatan harian.',
            )
          else if (deviation != null)
            _stateCard(deviation),
          if (measures.isNotEmpty) ...[
            const SizedBox(height: 12),
            _metricGrid(measures),
          ],
          if (_wearableReadings.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'Detak jantung diringkas per 15 menit. Terakhir tercatat ${DateFormat('HH:mm').format(_date(latestWearable['recorded_at']).toLocal())}.',
              style: AppTheme.font(
                  size: 10.5, color: AppTheme.textMuted, height: 1.3),
            ),
          ],
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const WhatChangedScreen()),
            ),
            child: const Text('Lihat apa yang berubah'),
          ),
        ],
      ),
    );
  }

  Widget _stateCard(Map<String, dynamic> deviation) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.primarySoft,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.borderLight),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              deviation['personal_state']?.toString() ??
                  'Analisis CAPAR tersedia',
              style: AppTheme.font(
                  size: 14,
                  weight: FontWeight.w800,
                  color: AppTheme.primaryDark),
            ),
            const SizedBox(height: 5),
            Text(
              'Dibandingkan dengan baseline aktivitas ${deviation['activity'] ?? 'yang sesuai'} pada periode ${deviation['time_period'] ?? 'yang sama'}. Hasil ini adalah pembanding statistik, bukan diagnosis.',
              style: AppTheme.font(
                  size: 12, color: AppTheme.textSecondary, height: 1.35),
            ),
          ],
        ),
      );

  Widget _messageCard(String message, {bool isError = false}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: isError ? const Color(0xFFFFF1F0) : AppTheme.primarySoft,
          borderRadius: BorderRadius.circular(13),
          border: Border.all(
              color: isError ? const Color(0xFFF4C7C3) : AppTheme.borderLight),
        ),
        child: Text(message,
            style: AppTheme.font(
                size: 11.5, color: AppTheme.textSecondary, height: 1.35)),
      );

  Widget _metricGrid(List<(String, String)> entries) => Wrap(
        spacing: 8,
        runSpacing: 8,
        children: entries
            .map(
              (entry) => Container(
                constraints: const BoxConstraints(minWidth: 145),
                padding: const EdgeInsets.all(11),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(13),
                  border: Border.all(color: AppTheme.borderLight),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(entry.$1,
                        style: AppTheme.font(
                            size: 10.5, color: AppTheme.textMuted)),
                    const SizedBox(height: 5),
                    Text(entry.$2,
                        style:
                            AppTheme.font(size: 12, weight: FontWeight.w700)),
                  ],
                ),
              ),
            )
            .toList(),
      );
}
