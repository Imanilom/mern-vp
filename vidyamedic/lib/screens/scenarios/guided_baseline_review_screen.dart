import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import 'guided_baseline_ema_screen.dart';

class GuidedBaselineReviewScreen extends StatefulWidget {
  const GuidedBaselineReviewScreen({
    super.key,
    required this.stageResults,
  });

  final List<Map<String, dynamic>> stageResults;

  @override
  State<GuidedBaselineReviewScreen> createState() =>
      _GuidedBaselineReviewScreenState();
}

class _GuidedBaselineReviewScreenState
    extends State<GuidedBaselineReviewScreen> {
  static const _activityOptions = <String, String>{
    'sitting': 'Duduk',
    'standing': 'Berdiri',
    'walking': 'Berjalan',
    'rest': 'Istirahat',
    'other': 'Aktivitas lain',
  };

  final Map<int, String> _correctedActivities = {};
  int _step = 3;
  bool _savingCorrection = false;
  bool _correctionSaved = false;
  String? _error;

  Map<String, dynamic>? get _capar {
    final raw = context.read<AppState>().rawCaparInsights?['capar'];
    return raw is Map ? Map<String, dynamic>.from(raw) : null;
  }

  List<Map<String, dynamic>> get _baselines {
    final baseline = _capar?['baseline'];
    final contexts = baseline is Map ? baseline['contexts'] : null;
    if (contexts is! List) return const [];
    return contexts
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  List<Map<String, dynamic>> get _recordedStages => widget.stageResults
      .where(
          (result) => result['skipped'] != true && result['incomplete'] != true)
      .toList();

  List<_ChartPoint> get _chartPoints {
    final trajectory = _capar?['trajectory_30d'];
    if (trajectory is List) {
      final dailyValues = <String, List<double>>{};
      for (final entry in trajectory.whereType<Map>()) {
        final activity = entry['activity']?.toString().toLowerCase() ?? '';
        if (!['rest', 'sitting', 'duduk'].contains(activity)) continue;
        final features = entry['features'];
        final hr = features is Map ? features['hr_mean'] : null;
        final date = DateTime.tryParse(entry['recorded_at']?.toString() ?? '');
        if (hr is! num || date == null) continue;
        final key =
            '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
        (dailyValues[key] ??= []).add(hr.toDouble());
      }
      final historical = dailyValues.entries.map((entry) {
        final date = DateTime.parse(entry.key);
        final values = entry.value;
        return _ChartPoint(
          date,
          values.reduce((a, b) => a + b) / values.length,
        );
      }).toList()
        ..sort((a, b) => a.time.compareTo(b.time));
      if (historical.length >= 2) return historical;
    }

    final sessionValues = <DateTime, List<double>>{};
    for (final stage in _recordedStages) {
      final readings = stage['recorded_readings'];
      if (readings is! List) continue;
      for (final entry in readings.whereType<Map>()) {
        final hr = entry['heart_rate_bpm'];
        final time = DateTime.tryParse(entry['recorded_at']?.toString() ?? '');
        if (hr is! num || time == null) continue;
        final minute = DateTime(
          time.year,
          time.month,
          time.day,
          time.hour,
          time.minute,
        );
        (sessionValues[minute] ??= []).add(hr.toDouble());
      }
    }
    final points = sessionValues.entries
        .map((entry) => _ChartPoint(
              entry.key,
              entry.value.reduce((a, b) => a + b) / entry.value.length,
            ))
        .toList()
      ..sort((a, b) => a.time.compareTo(b.time));
    return points;
  }

  String get _chartTitle {
    final trajectory = _capar?['trajectory_30d'];
    if (trajectory is List) {
      final days = trajectory
          .whereType<Map>()
          .where((entry) {
            final activity = entry['activity']?.toString().toLowerCase() ?? '';
            final features = entry['features'];
            return ['rest', 'sitting', 'duduk'].contains(activity) &&
                features is Map &&
                features['hr_mean'] is num;
          })
          .map((entry) {
            final date =
                DateTime.tryParse(entry['recorded_at']?.toString() ?? '');
            return date == null
                ? null
                : '${date.year}-${date.month}-${date.day}';
          })
          .whereType<String>()
          .toSet();
      if (days.length >= 2) return 'Tren HR konteks Rest/Duduk CAPAR';
    }
    return 'Detak jantung selama sesi baseline';
  }

  Future<void> _saveCorrections() async {
    if (_savingCorrection || _correctionSaved) return;
    final corrections = _correctedActivities.entries
        .where((entry) =>
            entry.value != widget.stageResults[entry.key]['activity'])
        .map((entry) {
      final stage = widget.stageResults[entry.key];
      final from = _activityOptions[stage['activity']] ?? 'Konteks';
      final to = _activityOptions[entry.value] ?? 'Aktivitas lain';
      return '${stage['label'] ?? from}: $from → $to';
    }).toList();

    setState(() {
      _savingCorrection = true;
      _error = null;
    });
    final response = await ApiService.createEvent({
      'event_type': 'activity_correction',
      'occurred_at': DateTime.now().toUtc().toIso8601String(),
      'details': corrections.isEmpty
          ? 'Pengguna meninjau konteks sesi baseline dan tidak mengirim koreksi.'
          : 'Koreksi konteks sesi baseline: ${corrections.join('; ')}. Koreksi ini merupakan laporan pengguna, bukan perubahan hasil sensor.',
      'value': corrections.isEmpty
          ? 'baseline_context_reviewed'
          : 'baseline_context_correction',
      'unit': 'baseline_context_feedback',
    });
    if (!mounted) return;
    setState(() {
      _savingCorrection = false;
      _correctionSaved = response.success;
      if (!response.success) {
        _error = response.message ?? 'Koreksi konteks belum berhasil disimpan.';
      }
    });
    if (response.success) {
      await context.read<AppState>().fetchRecentEvents();
    }
  }

  Future<void> _openEma() async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => GuidedBaselineEmaScreen(
          stageResults: widget.stageResults
              .map((result) => Map<String, dynamic>.from(result))
              .toList(),
        ),
      ),
    );
    if (mounted && saved == true) Navigator.pop(context, true);
  }

  void _next() {
    if (_step == 5 && !_correctionSaved) {
      setState(
          () => _error = 'Simpan atau konfirmasi konteks terlebih dahulu.');
      return;
    }
    if (_step < 6) {
      setState(() {
        _step++;
        _error = null;
      });
    }
  }

  void _previous() {
    if (_step > 3) {
      setState(() {
        _step--;
        _error = null;
      });
    } else {
      Navigator.pop(context, false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Vidyamedic'),
        leading: IconButton(
          tooltip: 'Kembali',
          onPressed: _previous,
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 14),
            child: Center(child: _stagePill()),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
        children: [
          _progressHeader(),
          const SizedBox(height: 14),
          if (_error != null) _errorBanner(_error!),
          if (_step == 3) ...[
            _profileStage(),
            _longitudinalChart(),
            _profileUsageCard(),
          ] else if (_step == 4) ...[
            _changeStage(),
          ] else if (_step == 5) ...[
            _correctionStage(),
          ] else ...[
            _interpretationStage(appState),
          ],
          const SizedBox(height: 12),
          if (_step < 6)
            FilledButton.icon(
              key: const Key('baseline-review-next'),
              onPressed: _step == 5 && _savingCorrection
                  ? null
                  : _step == 5 && !_correctionSaved
                      ? _saveCorrections
                      : _next,
              icon: Icon(_step == 5 && !_correctionSaved
                  ? Icons.save_outlined
                  : Icons.arrow_forward_rounded),
              label: Text(_step == 5 && !_correctionSaved
                  ? _savingCorrection
                      ? 'Menyimpan...'
                      : 'Simpan koreksi konteks'
                  : 'Lanjut ke tahap ${_step + 1}'),
            )
          else
            FilledButton.icon(
              onPressed: _openEma,
              icon: const Icon(Icons.play_arrow_rounded),
              label: const Text('Lanjut ke pengalaman (EMA)'),
            ),
        ],
      ),
    );
  }

  Widget _stagePill() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
        decoration: BoxDecoration(
          color: AppTheme.primarySoft,
          borderRadius: BorderRadius.circular(30),
        ),
        child: Row(
          children: [
            const Icon(Icons.monitor_heart_outlined,
                size: 16, color: AppTheme.primary),
            const SizedBox(width: 6),
            Text('Tahap $_step/6',
                style: AppTheme.font(
                    size: 11,
                    weight: FontWeight.w800,
                    color: AppTheme.primary)),
          ],
        ),
      );

  Widget _progressHeader() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            switch (_step) {
              3 => 'Profil kesehatan personal',
              4 => 'Perubahan yang teramati',
              5 => 'Tinjau konteks rekaman',
              _ => 'Interpretasi hasil',
            },
            style: AppTheme.font(size: 23, weight: FontWeight.w900),
          ),
          const SizedBox(height: 4),
          Text(
            switch (_step) {
              3 => 'Ringkasan pola dasar dan data yang benar-benar terekam.',
              4 =>
                'Bandingkan hasil sesi dengan referensi CAPAR yang tersedia.',
              5 =>
                'Pastikan konteks aktivitas sesuai dengan yang Anda lakukan.',
              _ =>
                'Pahami hasil, ketersediaan data, dan batas interpretasinya.',
            },
            style: AppTheme.font(
                size: 12, color: AppTheme.textSecondary, height: 1.4),
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: _step / 6,
              minHeight: 6,
              backgroundColor: AppTheme.fieldFill,
              color: AppTheme.primary,
            ),
          ),
        ],
      );

  Widget _profileStage() {
    final mature = _baselines
        .where((item) => ['mature', 'mature_legacy'].contains(item['level']))
        .length;
    final baselineCount = _baselines.length;
    final maturity = baselineCount == 0
        ? 'Belum ada baseline CAPAR'
        : '$mature dari $baselineCount konteks matang';
    final sitting = _contextStats('sitting');
    final standing = _contextStats('standing');
    final rmssd = _sessionRmssd;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Card(
          color: const Color(0xFFE7F7F5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: const BorderSide(color: Color(0xFF9DD8D3)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const CircleAvatar(
                      backgroundColor: Color(0xFFC7EFEB),
                      child: Icon(Icons.monitor_heart_outlined,
                          color: Color(0xFF078F8B)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text('Profil fisiologis personal',
                          style:
                              AppTheme.font(size: 15, weight: FontWeight.w800)),
                    ),
                    Flexible(child: _maturityBadge(maturity)),
                  ],
                ),
                if (_recordedStages.any((item) => item['is_simulated'] == true))
                  Padding(
                    padding: const EdgeInsets.only(top: 9),
                    child: _infoChip(
                      Icons.science_outlined,
                      'Ada data simulasi; bukan pengukuran tubuh nyata.',
                    ),
                  ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(child: _rangeMetric('HR duduk', sitting)),
                    _verticalDivider(),
                    Expanded(child: _rangeMetric('HR berdiri', standing)),
                    _verticalDivider(),
                    Expanded(
                      child: _valueMetric(
                        'RMSSD sesi',
                        rmssd?.toStringAsFixed(1),
                        'ms',
                        Icons.waves_rounded,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 9),
                Text(
                  'Rentang HR berasal dari rekaman sesi ini. RMSSD dihitung dari interval RR yang tersedia; nilai yang tidak terkumpul tidak ditaksir.',
                  style: AppTheme.font(
                      size: 10, color: AppTheme.textSecondary, height: 1.35),
                ),
              ],
            ),
          ),
        ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(15),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Konteks yang dipelajari',
                    style: AppTheme.font(size: 14, weight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(
                  'Ditampilkan jika tersedia dari baseline CAPAR atau rekaman sesi ini.',
                  style: AppTheme.font(
                      size: 11, color: AppTheme.textSecondary, height: 1.35),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 7,
                  runSpacing: 7,
                  children: _learnedContextLabels
                      .map((label) => _contextChip(label, _iconForLabel(label)))
                      .toList(),
                ),
                if (_learnedContextLabels.isEmpty)
                  Text('Belum ada konteks yang selesai direkam.',
                      style:
                          AppTheme.font(size: 11, color: AppTheme.textMuted)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _longitudinalChart() {
    final points = _chartPoints;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(15),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.show_chart_rounded, color: Color(0xFF078F8B)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text('Ringkasan longitudinal',
                      style: AppTheme.font(size: 14, weight: FontWeight.w800)),
                ),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              _chartTitle,
              style: AppTheme.font(
                  size: 11, color: AppTheme.textSecondary, height: 1.35),
            ),
            const SizedBox(height: 12),
            if (points.length < 2)
              _emptyChart()
            else
              SizedBox(
                height: 205,
                width: double.infinity,
                child: CustomPaint(
                  painter: _HeartRateChartPainter(points),
                  child: const SizedBox.expand(),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _emptyChart() => Container(
        height: 150,
        alignment: Alignment.center,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.fieldFill,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          'Grafik belum tersedia. Data akan ditampilkan setelah ada setidaknya dua titik HR duduk dari riwayat atau rekaman sesi.',
          textAlign: TextAlign.center,
          style: AppTheme.font(
              size: 11.5, color: AppTheme.textSecondary, height: 1.4),
        ),
      );

  Widget _profileUsageCard() => Card(
        child: ListTile(
          leading: const CircleAvatar(
            backgroundColor: Color(0xFFEAF4FF),
            child: Icon(Icons.description_outlined, color: Color(0xFF2867A8)),
          ),
          title: Text('Bagaimana profil digunakan?',
              style: AppTheme.font(size: 13, weight: FontWeight.w800)),
          subtitle: Text(
            'Profil membantu membandingkan pembacaan dengan pola Anda pada konteks serupa. Ini bukan diagnosis dan membutuhkan rekaman berkualitas berulang.',
            style: AppTheme.font(
                size: 11, color: AppTheme.textSecondary, height: 1.4),
          ),
        ),
      );

  Widget _changeStage() {
    final comparisons = widget.stageResults.map((result) {
      final baseline = _findBaseline(result['activity']?.toString());
      final features = baseline?['feature_stats'];
      final meanHr = baseline != null &&
              ['mature', 'mature_legacy'].contains(baseline['level']) &&
              features is Map &&
              features['mean_hr'] is Map
          ? (features['mean_hr'] as Map)['mean']
          : null;
      final readings = _readings(result);
      final values = readings
          .map((item) => item['heart_rate_bpm'])
          .whereType<num>()
          .map((value) => value.toDouble())
          .toList();
      final average = values.isEmpty
          ? null
          : values.reduce((a, b) => a + b) / values.length;
      return (result, meanHr, average, values.length);
    }).toList();
    return Column(
      children: [
        _infoCard(
          Icons.compare_arrows_rounded,
          'Perbandingan memakai konteks yang sama',
          'Perbedaan angka adalah pengamatan data, bukan bukti gangguan atau diagnosis. Jika referensi CAPAR belum tersedia, sistem tidak membuat nilai pembanding.',
        ),
        ...comparisons.map((entry) {
          final result = entry.$1;
          final baselineMean = entry.$2;
          final sessionMean = entry.$3;
          final count = entry.$4;
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(result['label']?.toString() ?? 'Konteks',
                      style: AppTheme.font(size: 13, weight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                          child: _valueMetric(
                              'Rerata sesi',
                              _formatNumber(sessionMean),
                              'bpm',
                              Icons.monitor_heart_outlined)),
                      const SizedBox(width: 8),
                      Expanded(
                          child: _valueMetric(
                              'Rerata baseline matang',
                              _formatNumber(baselineMean),
                              'bpm',
                              Icons.insights_outlined)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    baselineMean is num && sessionMean != null
                        ? 'Selisih teramati: ${(sessionMean - baselineMean).toStringAsFixed(1)} bpm · $count pembacaan tersedia'
                        : 'Baseline matang untuk konteks ini belum tersedia · $count pembacaan sesi',
                    style: AppTheme.font(
                        size: 10.5,
                        color: AppTheme.textSecondary,
                        height: 1.35),
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _correctionStage() => Column(
        children: [
          _infoCard(
            Icons.fact_check_outlined,
            'Periksa label aktivitas',
            'Jika label konteks tidak sesuai aktivitas yang Anda lakukan, pilih konteks yang benar. Koreksi ini adalah laporan Anda di tahap input (L1); nilai sensor tetap tidak diubah.',
          ),
          ...widget.stageResults.asMap().entries.where((entry) {
            final result = entry.value;
            return result['skipped'] != true && result['incomplete'] != true;
          }).map((entry) {
            final index = entry.key;
            final result = entry.value;
            final current = result['activity']?.toString() ?? 'other';
            final selected = _correctedActivities[index] ?? current;
            return Card(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(result['label']?.toString() ?? 'Konteks',
                        style:
                            AppTheme.font(size: 12, weight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      initialValue: selected,
                      decoration: const InputDecoration(
                        labelText: 'Aktivitas yang sebenarnya',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                      items: _activityOptions.entries
                          .map((entry) => DropdownMenuItem(
                                value: entry.key,
                                child: Text(entry.value),
                              ))
                          .toList(),
                      onChanged: (value) {
                        if (value == null) return;
                        setState(() {
                          _correctedActivities[index] = value;
                          _correctionSaved = false;
                          _error = null;
                        });
                      },
                    ),
                  ],
                ),
              ),
            );
          }),
          if (_correctionSaved)
            _infoCard(
              Icons.check_circle_outline_rounded,
              'Konteks sudah ditinjau',
              'Koreksi yang Anda kirim disimpan sebagai laporan pengguna, terpisah dari hasil wearable.',
            ),
        ],
      );

  Widget _interpretationStage(AppState appState) {
    final recorded = _recordedStages.length;
    final skipped =
        widget.stageResults.where((item) => item['skipped'] == true).length;
    final partial =
        widget.stageResults.where((item) => item['incomplete'] == true).length;
    return Column(
      children: [
        _infoCard(
          Icons.lightbulb_outline_rounded,
          'Apa arti hasil sesi?',
          '$recorded konteks selesai direkam, $partial dihentikan lebih awal, dan $skipped dilewati. Sesi ini memberi gambaran data yang terkumpul; satu kali rekaman lima menit tidak cukup untuk menyimpulkan kondisi kesehatan atau kematangan baseline.',
        ),
        ...widget.stageResults.map((result) {
          final min = result['minimum_hr'];
          final max = result['maximum_hr'];
          final baseline = _findBaseline(result['activity']?.toString());
          final level = baseline?['level']?.toString();
          return Card(
            child: ListTile(
              leading: Icon(
                result['skipped'] == true
                    ? Icons.skip_next_rounded
                    : Icons.monitor_heart_outlined,
                color: result['skipped'] == true
                    ? AppTheme.textMuted
                    : AppTheme.primary,
              ),
              title: Text(result['label']?.toString() ?? 'Konteks',
                  style: AppTheme.font(size: 12, weight: FontWeight.w800)),
              subtitle: Text(
                result['skipped'] == true
                    ? 'Tidak ada pengukuran pada konteks ini.'
                    : 'HR terukur $min–$max bpm · ${result['reading_count'] ?? 0} titik'
                        '${level == null ? ' · baseline pembanding belum tersedia' : ' · status baseline: $level'}',
                style: AppTheme.font(
                    size: 10.5, color: AppTheme.textSecondary, height: 1.35),
              ),
            ),
          );
        }),
        if (appState.baselineGuidanceCitations.isNotEmpty)
          Card(
            child: ExpansionTile(
              leading:
                  const Icon(Icons.science_outlined, color: AppTheme.primary),
              title: Text('Bukti ilmiah terkait',
                  style: AppTheme.font(size: 12, weight: FontWeight.w800)),
              subtitle: Text(
                  '${appState.baselineGuidanceCitations.length} sumber dari RAG'),
              children: appState.baselineGuidanceCitations
                  .take(3)
                  .map(_citationTile)
                  .toList(),
            ),
          ),
        _infoCard(
          Icons.shield_outlined,
          'Batas interpretasi',
          appState.baselineGuidanceEvidenceLimit ??
              'Bukti ilmiah memberi konteks populasi; bukti tersebut tidak menetapkan rentang normal pribadi atau diagnosis.',
        ),
      ],
    );
  }

  Widget _citationTile(ScientificCitation citation) => ListTile(
        dense: true,
        title: Text(citation.title,
            style: AppTheme.font(size: 11, weight: FontWeight.w700)),
        subtitle: Text(
          [
            citation.summary,
            citation.source,
            citation.year,
          ].where((value) => value.isNotEmpty).join(' · '),
          style: AppTheme.font(
              size: 10, color: AppTheme.textSecondary, height: 1.35),
        ),
      );

  Widget _rangeMetric(String title, Map<String, dynamic> stage) {
    final min = stage['minimum_hr'];
    final max = stage['maximum_hr'];
    return _valueMetric(
      title,
      min is num && max is num ? '${min.round()}–${max.round()}' : null,
      'bpm',
      Icons.favorite_outline_rounded,
    );
  }

  Widget _valueMetric(
    String title,
    String? value,
    String unit,
    IconData icon,
  ) =>
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 5),
        child: Column(
          children: [
            Icon(icon, size: 18, color: const Color(0xFF078F8B)),
            const SizedBox(height: 5),
            Text(title,
                textAlign: TextAlign.center,
                style: AppTheme.font(size: 9, color: AppTheme.textSecondary)),
            const SizedBox(height: 4),
            Text(
              value == null ? '—' : '$value\n$unit',
              textAlign: TextAlign.center,
              style: AppTheme.font(size: 14, weight: FontWeight.w900),
            ),
          ],
        ),
      );

  Widget _maturityBadge(String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(24),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.bar_chart_rounded,
                size: 15, color: Color(0xFF078F8B)),
            const SizedBox(width: 4),
            Flexible(
              child: Text(text,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTheme.font(size: 9, weight: FontWeight.w700)),
            ),
          ],
        ),
      );

  Widget _infoChip(IconData icon, String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF7E6),
          borderRadius: BorderRadius.circular(9),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: AppTheme.statusOrange),
            const SizedBox(width: 5),
            Flexible(
              child: Text(text,
                  style: AppTheme.font(
                      size: 9.5, color: AppTheme.textSecondary, height: 1.25)),
            ),
          ],
        ),
      );

  Widget _contextChip(String label, IconData icon) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: switch (icon) {
            Icons.bedtime_outlined => const Color(0xFFF0EEFF),
            Icons.directions_walk_rounded => const Color(0xFFEAF4FF),
            Icons.accessibility_new_rounded => const Color(0xFFEAF4FF),
            _ => const Color(0xFFE7F7F5),
          },
          borderRadius: BorderRadius.circular(24),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: const Color(0xFF087F7C)),
            const SizedBox(width: 5),
            Text(label,
                style: AppTheme.font(size: 10, weight: FontWeight.w700)),
          ],
        ),
      );

  Widget _verticalDivider() => Container(
        width: 1,
        height: 58,
        color: const Color(0xFFD5E3F5),
        margin: const EdgeInsets.symmetric(horizontal: 2),
      );

  Widget _infoCard(IconData icon, String title, String detail) => Card(
        child: ListTile(
          leading: Icon(icon, color: const Color(0xFF078F8B)),
          title: Text(title,
              style: AppTheme.font(size: 13, weight: FontWeight.w800)),
          subtitle: Text(detail,
              style: AppTheme.font(
                  size: 11, color: AppTheme.textSecondary, height: 1.4)),
        ),
      );

  Widget _errorBanner(String text) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.statusRedBg,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(text,
            style: AppTheme.font(size: 11, color: AppTheme.statusRed)),
      );

  Map<String, dynamic> _contextStats(String activity) {
    final index = widget.stageResults.indexWhere(
      (result) => result['activity'] == activity && result['skipped'] != true,
    );
    return index < 0 ? const {} : widget.stageResults[index];
  }

  List<String> get _learnedContextLabels {
    final labels = <String>{};
    for (final baseline in _baselines) {
      final activity = baseline['activity']?.toString().toLowerCase() ?? '';
      final label = switch (activity) {
        'rest' || 'duduk' || 'sitting' => 'Duduk',
        'standing' || 'berdiri' => 'Berdiri',
        'walking' || 'light' || 'berjalan' => 'Jalan ringan',
        'sleep' || 'tidur' => 'Istirahat',
        _ => '',
      };
      if (label.isNotEmpty) labels.add(label);
    }
    for (final result in _recordedStages) {
      final label = switch (result['activity']) {
        'sitting' => 'Duduk',
        'standing' => 'Berdiri',
        'walking' => 'Jalan ringan',
        _ => result['label']?.toString() ?? '',
      };
      if (label.isNotEmpty) labels.add(label);
    }
    return labels.toList();
  }

  IconData _iconForLabel(String label) => switch (label) {
        'Berdiri' => Icons.accessibility_new_rounded,
        'Jalan ringan' => Icons.directions_walk_rounded,
        'Istirahat' => Icons.bedtime_outlined,
        _ => Icons.chair_alt_rounded,
      };

  Map<String, dynamic>? _findBaseline(String? activity) {
    const aliases = {
      'sitting': ['sitting', 'rest', 'duduk'],
      'standing': ['standing', 'berdiri'],
      'walking': ['walking', 'light', 'berjalan'],
    };
    final accepted = aliases[activity] ?? [activity?.toLowerCase() ?? ''];
    for (final item in _baselines) {
      final name = item['activity']?.toString().toLowerCase() ?? '';
      if (accepted.any((alias) => name == alias)) return item;
    }
    return null;
  }

  List<Map<String, dynamic>> _readings(Map<String, dynamic> stage) {
    final readings = stage['recorded_readings'];
    if (readings is! List) return const [];
    return readings
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  double? get _sessionRmssd {
    var squaredDifferences = 0.0;
    var differenceCount = 0;
    for (final stage in _recordedStages) {
      final intervals = _readings(stage)
          .map((reading) => reading['rr_interval_ms'])
          .whereType<num>()
          .map((value) => value.toDouble())
          .where((value) => value >= 250 && value <= 3000)
          .toList();
      for (var index = 1; index < intervals.length; index++) {
        final difference = intervals[index] - intervals[index - 1];
        squaredDifferences += difference * difference;
        differenceCount++;
      }
    }
    return differenceCount == 0
        ? null
        : math.sqrt(squaredDifferences / differenceCount);
  }

  String? _formatNumber(dynamic value) =>
      value is num ? value.toStringAsFixed(1) : null;
}

class _ChartPoint {
  const _ChartPoint(this.time, this.value);

  final DateTime time;
  final double value;
}

class _HeartRateChartPainter extends CustomPainter {
  const _HeartRateChartPainter(this.points);

  final List<_ChartPoint> points;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2 || size.isEmpty) return;
    const left = 38.0;
    const right = 12.0;
    const top = 10.0;
    const bottom = 35.0;
    final chart = Rect.fromLTRB(
      left,
      top,
      math.max(left + 1, size.width - right),
      math.max(top + 1, size.height - bottom),
    );
    final values = points.map((point) => point.value);
    final minimum = math.min(40.0, values.reduce(math.min) - 5);
    final maximum = math.max(120.0, values.reduce(math.max) + 5);
    final range = math.max(1.0, maximum - minimum);
    final xStep = chart.width / (points.length - 1);
    final coordinates = List<Offset>.generate(points.length, (index) {
      final x = chart.left + index * xStep;
      final y = chart.bottom -
          ((points[index].value - minimum) / range) * chart.height;
      return Offset(x, y);
    });

    final gridPaint = Paint()
      ..color = const Color(0xFFDCE6EE)
      ..strokeWidth = 0.7;
    final labelStyle = const TextStyle(
      color: Color(0xFF536B91),
      fontSize: 9,
    );
    for (var index = 0; index <= 3; index++) {
      final y = chart.top + chart.height * index / 3;
      canvas.drawLine(Offset(chart.left, y), Offset(chart.right, y), gridPaint);
      final value = (maximum - range * index / 3).round();
      _drawText(canvas, '$value', Offset(0, y - 6), labelStyle);
    }
    final verticalGridCount = math.min(points.length - 1, 4);
    for (var index = 0; index <= verticalGridCount; index++) {
      final pointIndex =
          (index * (points.length - 1) / verticalGridCount).round();
      final x = chart.left + pointIndex * xStep;
      canvas.drawLine(Offset(x, chart.top), Offset(x, chart.bottom), gridPaint);
    }

    final line = Path()..moveTo(coordinates.first.dx, coordinates.first.dy);
    for (final point in coordinates.skip(1)) {
      line.lineTo(point.dx, point.dy);
    }
    final fill = Path.from(line)
      ..lineTo(coordinates.last.dx, chart.bottom)
      ..lineTo(coordinates.first.dx, chart.bottom)
      ..close();
    canvas.drawPath(
      fill,
      Paint()
        ..shader = const LinearGradient(
          colors: [Color(0x7772C9C3), Color(0x0872C9C3)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ).createShader(chart),
    );
    canvas.drawPath(
      line,
      Paint()
        ..color = const Color(0xFF078F8B)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    for (var index = 0; index < coordinates.length; index++) {
      final point = coordinates[index];
      canvas.drawCircle(point, 4.5, Paint()..color = Colors.white);
      canvas.drawCircle(point, 3.2, Paint()..color = const Color(0xFF078F8B));
    }
    for (var labelIndex = 0; labelIndex <= verticalGridCount; labelIndex++) {
      final pointIndex =
          (labelIndex * (points.length - 1) / verticalGridCount).round();
      final point = coordinates[pointIndex];
      final date = points[pointIndex].time;
      final hasHistoricalRange =
          points.last.time.difference(points.first.time).inHours >= 24;
      final label = hasHistoricalRange
          ? '${date.day}/${date.month}'
          : '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
      _drawText(
        canvas,
        label,
        Offset(point.dx - 12, chart.bottom + 8),
        labelStyle,
      );
    }
    _drawText(canvas, 'bpm', const Offset(0, 0), labelStyle);
  }

  void _drawText(Canvas canvas, String text, Offset offset, TextStyle style) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout();
    painter.paint(canvas, offset);
  }

  @override
  bool shouldRepaint(covariant _HeartRateChartPainter oldDelegate) =>
      oldDelegate.points != points;
}
