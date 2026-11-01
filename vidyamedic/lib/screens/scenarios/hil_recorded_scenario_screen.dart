import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/app_state.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/hil_time.dart';
import '../pedagogy/history_trend_chart.dart';

class HilRecordedScenarioAnalysis {
  static double threshold(double? baselineStandardDeviation) =>
      math.max(10, (baselineStandardDeviation ?? 0) * 2);

  static bool isElevatedCandidate({
    required double? heartRate,
    required double? baselineMean,
    required double thresholdBpm,
    required double? qSignal,
    required double? qComplete,
    required bool qualityAccepted,
  }) =>
      qualityAccepted &&
      heartRate != null &&
      baselineMean != null &&
      qSignal != null &&
      qSignal >= 0.6 &&
      qComplete != null &&
      qComplete >= 0.6 &&
      heartRate > baselineMean + thresholdBpm;
}

class HilRecordedScenarioScreen extends StatefulWidget {
  const HilRecordedScenarioScreen({
    required this.scenario,
    required this.baselineContexts,
    required this.initialActivity,
    super.key,
  });

  final String scenario;
  final List<Map<String, dynamic>> baselineContexts;
  final String initialActivity;

  @override
  State<HilRecordedScenarioScreen> createState() =>
      _HilRecordedScenarioScreenState();
}

class _HilRecordedScenarioScreenState extends State<HilRecordedScenarioScreen> {
  static const _activities = <(String, String)>[
    ('sitting', 'Duduk'),
    ('standing', 'Berdiri'),
    ('walking', 'Berjalan'),
  ];

  late final String _runId =
      'hil-${widget.scenario}-${DateTime.now().toUtc().microsecondsSinceEpoch}';
  late String _activity = _activities.any((item) => item.$1 == widget.initialActivity)
      ? widget.initialActivity
      : 'sitting';
  final TextEditingController _clarificationController =
      TextEditingController();
  final List<Map<String, dynamic>> _logs = [];
  List<Map<String, dynamic>> _samples = [];
  String? _selectedSampleId;
  String? _error;
  String? _recommendation;
  String? _zeroShotExplanation;
  bool _isLoading = true;
  bool _isSaving = false;
  bool _clarificationRequested = false;
  bool _isGeneratingExplanation = false;

  @override
  void initState() {
    super.initState();
    unawaited(_startRun());
  }

  @override
  void dispose() {
    _clarificationController.dispose();
    super.dispose();
  }

  String _normalizeActivity(dynamic value) {
    final activity = value?.toString().trim().toLowerCase() ?? '';
    return switch (activity) {
      'duduk' || 'sit' => 'sitting',
      'berdiri' || 'stand' => 'standing',
      'berjalan' || 'walk' => 'walking',
      _ => activity,
    };
  }

  String _activityLabel(String activity) =>
      _activities.firstWhere((item) => item.$1 == activity).$2;

  Map<String, dynamic> get _baseline {
    for (final context in widget.baselineContexts) {
      if (_normalizeActivity(context['activity']) != _activity) continue;
      final readiness = _map(context['scenario_readiness']);
      if (readiness['ready'] == true) return context;
    }
    return {};
  }

  Map<String, dynamic> get _hrStats =>
      _map(_map(_baseline['feature_stats'])['mean_hr']);

  double? get _baselineMean {
    final value = _hrStats['mean'];
    return value is num && value.isFinite ? value.toDouble() : null;
  }

  double? get _baselineStd {
    final value = _hrStats['standard_deviation'];
    return value is num && value.isFinite ? value.toDouble() : null;
  }

  double get _threshold => HilRecordedScenarioAnalysis.threshold(_baselineStd);

  Map<String, dynamic>? get _selectedSample {
    for (final sample in _samples) {
      if (sample['_id']?.toString() == _selectedSampleId) return sample;
    }
    return null;
  }

  double? _sampleHr(Map<String, dynamic> sample) {
    final value = sample['heart_rate_bpm'];
    return value is num && value.isFinite ? value.toDouble() : null;
  }

  bool _isDeviation(Map<String, dynamic> sample) {
    final hr = _sampleHr(sample);
    final mean = _baselineMean;
    final quality = _map(sample['data_quality']);
    final qSignal = quality['q_signal'];
    final qComplete = quality['q_complete'];
    return _baseline.isNotEmpty &&
        HilRecordedScenarioAnalysis.isElevatedCandidate(
          heartRate: hr,
          baselineMean: mean,
          thresholdBpm: _threshold,
          qSignal: qSignal is num ? qSignal.toDouble() : null,
          qComplete: qComplete is num ? qComplete.toDouble() : null,
          qualityAccepted: quality['status'] == 'accepted',
        );
  }

  Future<void> _startRun() async {
    final started = await _saveLog('scenario_started');
    if (!started || !mounted) return;
    await _loadSamples();
  }

  Future<void> _loadSamples() async {
    setState(() {
      _isLoading = true;
      _error = null;
      _samples = [];
      _selectedSampleId = null;
      _recommendation = null;
      _zeroShotExplanation = null;
      _clarificationRequested = false;
      _clarificationController.clear();
    });
    final now = DateTime.now().toUtc();
    final response = await ApiService.getWearableSamples(
      from: now.subtract(const Duration(days: 31)).toIso8601String(),
      to: now.toIso8601String(),
      limit: 100,
    );
    if (!mounted) return;
    if (!response.success || response.data == null) {
      setState(() {
        _isLoading = false;
        _error = response.message ?? 'Riwayat HR gagal dimuat.';
      });
      return;
    }
    final samples = response.data!
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .where((sample) {
          final quality = _map(sample['data_quality']);
          return sample['provider'] == 'polar_h10' &&
              sample['is_simulated'] != true &&
              sample['recording_purpose'] != 'hil_baseline' &&
              _normalizeActivity(sample['activity']) == _activity &&
              sample['sensor_contact'] == true &&
              quality['status'] == 'accepted' &&
              _sampleHr(sample) != null;
        })
        .toList()
      ..sort((a, b) => DateTime.parse(a['recorded_at'].toString())
          .compareTo(DateTime.parse(b['recorded_at'].toString())));
    setState(() {
      _samples = samples;
      _selectedSampleId =
          samples.isEmpty ? null : samples.last['_id']?.toString();
      _isLoading = false;
    });

    if (samples.isEmpty) return;
    final saved = await _saveLog(
      'records_loaded',
      sampleIds: samples.map((sample) => sample['_id'].toString()).toList(),
    );
    if (!saved || !mounted) return;
  }

  Future<bool> _saveLog(
    String eventType, {
    String? sampleId,
    List<String> sampleIds = const [],
    String? recommendation,
    String? clarification,
    String? explanation,
  }) async {
    final response = await ApiService.createHilScenarioLog({
      'run_id': _runId,
      'scenario': widget.scenario,
      'event_type': eventType,
      'activity': _activity,
      if (sampleId != null) 'sample_id': sampleId,
      if (sampleIds.isNotEmpty) 'sample_ids': sampleIds,
      if (recommendation != null) 'recommendation': recommendation,
      if (clarification != null) 'clarification': clarification,
      if (explanation != null) 'explanation': explanation,
    });
    if (!mounted) return false;
    if (!response.success || response.data == null) {
      setState(() {
        _error = response.message ?? 'Log eksperimen gagal disimpan.';
      });
      return false;
    }
    setState(() {
      _error = null;
      _logs.add(response.data!);
    });
    return true;
  }

  Future<Map<String, dynamic>?> _logSelectedObservation(
    String eventType, {
    String? recommendation,
    String? clarification,
    String? explanation,
  }) async {
    final sample = _selectedSample;
    final sampleId = sample?['_id']?.toString();
    if (sample == null || sampleId == null) return null;
    final saved = await _saveLog(
      eventType,
      sampleId: sampleId,
      recommendation: recommendation,
      clarification: clarification,
      explanation: explanation,
    );
    if (!saved || _logs.isEmpty) return null;
    return _logs.last;
  }

  Future<void> _presentScenarioOutcome() async {
    final sample = _selectedSample;
    if (sample == null) return;
    setState(() {
      _isSaving = true;
      _error = null;
    });
    final deviationLog = await _logSelectedObservation('deviation_detected');
    if (!mounted) return;
    if (deviationLog == null) {
      setState(() => _isSaving = false);
      return;
    }
    final status = deviationLog['algorithm_status']?.toString() ?? 'not_assessable';
    if (status != 'candidate_deviation') {
      setState(() {
        _isSaving = false;
        _error = status == 'not_assessable'
            ? 'Bukti atau baseline belum cukup untuk menilai deviasi.'
            : 'Sampel rekaman ini tidak melewati ambang deviasi HIL.';
      });
      return;
    }

    if (widget.scenario == 'B') {
      const recommendation =
          'Duduk atau beristirahat sejenak, lalu pantau kembali HR. Jika merasa tidak sehat atau mengalami gejala berat, cari bantuan medis. Ini bukan diagnosis.';
      final feedbackLog = await _logSelectedObservation(
        'feedback_presented',
        recommendation: recommendation,
      );
      if (!mounted) return;
      setState(() {
        _isSaving = false;
        if (feedbackLog != null) _recommendation = recommendation;
      });
      if (feedbackLog != null) {
        final appState = context.read<AppState>();
        final saved = await appState.recordHumanInTheLoopScenario(
          scenario: 'B',
          explanationSnapshot: _explanationSnapshot(
            recommendation,
            status,
          ),
        );
        if (!saved && mounted) {
          setState(() {
            _error = 'Feedback B sudah ditampilkan, tetapi histori penjelasan '
                'belum tersimpan: ${appState.dataError ?? 'coba lagi.'}';
          });
        }
      }
      return;
    }

    final requested =
        await _logSelectedObservation('clarification_requested');
    if (!mounted) return;
    setState(() {
      _isSaving = false;
      _clarificationRequested = requested != null;
    });
  }

  Map<String, dynamic> _explanationSnapshot(
    String explanation,
    String status,
  ) {
    return {
      'version': 1,
      'scenario': widget.scenario,
      'segment_id': null,
      'activity': _activity,
      'explanation': explanation,
      'status': status,
      'quality_status': 'accepted',
      'baseline_ready': _baseline.isNotEmpty,
      'factors': ['mean_hr'],
    };
  }

  Future<bool> _confirmZeroShotTransfer() async {
    final consent = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Persetujuan penjelasan zero-shot'),
        content: const Text(
          'Nilai HR, ringkasan baseline, dan klarifikasi yang Anda tulis akan dikirim ke layanan AI untuk membuat penjelasan. Jangan masukkan nama atau informasi pengenal. Hasil hanya ringkasan observasional, bukan diagnosis.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Setuju dan lanjutkan'),
          ),
        ],
      ),
    );
    return consent == true;
  }

  Future<void> _submitClarification() async {
    final clarification = _clarificationController.text.trim();
    final sample = _selectedSample;
    if (clarification.isEmpty || sample == null) {
      setState(() => _error = 'Tulis informasi yang mungkin terlewat sistem.');
      return;
    }
    if (!await _confirmZeroShotTransfer() || !mounted) return;
    setState(() {
      _isGeneratingExplanation = true;
      _error = null;
      _zeroShotExplanation = null;
    });
    final submitted = await _logSelectedObservation(
      'clarification_submitted',
      clarification: clarification,
    );
    if (!mounted) return;
    if (submitted == null) {
      setState(() => _isGeneratingExplanation = false);
      return;
    }
    final selectedLog = _logs
        .lastWhere((log) => log['event_type'] == 'deviation_detected');
    final evidence = <Map<String, dynamic>>[
      {
        'source': 'real_wearable_sample',
        'facts': 'Sampel Polar H10 aktivitas $_activity.',
        'metric': 'mean_hr',
        'value': selectedLog['heart_rate_bpm'],
        'unit': 'bpm',
        'status': selectedLog['algorithm_status'],
      },
      {
        'source': 'hil_personal_baseline',
        'facts': 'Baseline HIL untuk aktivitas $_activity.',
        'metric': 'mean_hr',
        'value': selectedLog['baseline_mean_hr'],
        'unit': 'bpm',
        'status': 'ready',
      },
      {
        'source': 'participant_clarification',
        'facts': clarification,
        'metric': 'context',
        'value': clarification,
        'unit': '',
        'status': 'self_reported',
      },
    ];
    final summary = [
      'Skenario C HIL, aktivitas $_activity.',
      'HR rekaman ${selectedLog['heart_rate_bpm']} bpm; baseline HIL '
          '${selectedLog['baseline_mean_hr']} bpm; z-score '
          '${selectedLog['z_score'] ?? 'tidak tersedia'}; status '
          '${selectedLog['algorithm_status']}.',
      'Klarifikasi peserta: $clarification',
      'Data observasional. Klarifikasi tidak membuktikan penyebab.',
    ].join(' ');
    final response = await ApiService.generatePersonalChatAnswer(
      question: 'Buat penjelasan zero-shot dalam bahasa Indonesia yang '
          'menggabungkan deviasi HR dari baseline HIL dengan klarifikasi '
          'peserta. Bedakan fakta sensor dari laporan peserta, jelaskan '
          'ketidakpastian, jangan menyatakan hubungan sebab-akibat, jangan '
          'membuat diagnosis, dan jangan memberi rekomendasi medis.',
      evidence: evidence,
      localSummary: summary.length > 1200 ? summary.substring(0, 1200) : summary,
      conversationHistory: const [],
    );
    if (!mounted) return;
    if (!response.success || response.data == null) {
      final message = response.message ?? 'Penjelasan zero-shot gagal dibuat.';
      final savedFailure = await _logSelectedObservation(
        'zero_shot_failed',
        clarification: clarification,
        explanation: message,
      );
      if (!mounted) return;
      setState(() {
        _isGeneratingExplanation = false;
        _error = savedFailure == null
            ? '$message Log kegagalan juga belum tersimpan.'
            : message;
      });
      return;
    }

    final explanation = response.data!;
    final saved = await _logSelectedObservation(
      'zero_shot_generated',
      clarification: clarification,
      explanation: explanation,
    );
    if (!mounted) return;
    setState(() {
      _isGeneratingExplanation = false;
      if (saved != null) _zeroShotExplanation = explanation;
    });
    if (saved != null) {
      final appState = context.read<AppState>();
      final explanationSaved = await appState.recordHumanInTheLoopScenario(
        scenario: 'C',
        explanationSnapshot: _explanationSnapshot(
          explanation,
          'candidate_deviation_with_participant_context',
        ),
      );
      if (!explanationSaved && mounted) {
        setState(() {
          _error = 'Penjelasan C sudah dibuat dan log skenario tersimpan, '
              'tetapi histori penjelasan belum tersimpan: '
              '${appState.dataError ?? 'coba lagi.'}';
        });
      }
    }
  }

  Map<String, dynamic> _map(dynamic value) =>
      value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

  List<ChartPoint> get _chartPoints => _samples
      .map((sample) {
        final time = DateTime.tryParse(sample['recorded_at']?.toString() ?? '');
        final hr = _sampleHr(sample);
        if (time == null || hr == null) return null;
        return ChartPoint(
          time,
          hr,
          activity: _activity,
          observationStatus: _isDeviation(sample) ? 'candidate_deviation' : 'normal',
        );
      })
      .whereType<ChartPoint>()
      .toList();

  Widget _chartCard() {
    final points = _chartPoints;
    return Card(
      key: const Key('hil-recorded-chart'),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'HR rekaman nyata · ${_activityLabel(_activity)}',
              style: AppTheme.font(size: 12, weight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              _baselineMean == null
                  ? 'Baseline HIL aktivitas ini tidak tersedia.'
                  : 'Garis putus-putus: baseline ${_baselineMean!.toStringAsFixed(1)} bpm · '
                      'ambang observasi +${_threshold.toStringAsFixed(1)} bpm',
              style: AppTheme.font(size: 10, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 8),
            if (points.length < 2)
              const SizedBox(
                key: Key('hil-recorded-chart-empty'),
                height: 170,
                child: Center(
                  child: Text('Perlu minimal dua sampel HR nyata untuk grafik.'),
                ),
              )
            else
              SizedBox(
                height: 190,
                width: double.infinity,
                child: CustomPaint(
                  painter: TrendChartPainter(
                    points: points,
                    color: AppTheme.primary,
                    baselineMean: _baselineMean,
                    timeDisplayOffset: hilWibOffset,
                  ),
                ),
              ),
            Text(
              '${points.length} sampel diterima · data simulasi dan sampel baseline A dikecualikan',
              style: AppTheme.font(size: 9.5, color: AppTheme.textMuted),
            ),
          ],
        ),
      ),
    );
  }

  Widget _observationCard() {
    final sample = _selectedSample;
    final hr = sample == null ? null : _sampleHr(sample);
    final candidate = sample != null && _isDeviation(sample);
    final mean = _baselineMean;
    final zScore = hr != null && mean != null && (_baselineStd ?? 0) > 0
        ? (hr - mean) / _baselineStd!
        : null;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Pilih observasi nyata', style: AppTheme.font(size: 12, weight: FontWeight.w800)),
            const SizedBox(height: 7),
            if (_samples.isEmpty)
              const Text('Belum ada rekaman Polar H10 yang valid untuk aktivitas ini.')
            else
              DropdownButtonFormField<String>(
                key: const Key('hil-recorded-sample-picker'),
                initialValue: _selectedSampleId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Sampel HR'),
                items: _samples.reversed.map((item) {
                  final time = DateTime.tryParse(item['recorded_at'].toString());
                  final value = _sampleHr(item);
                  return DropdownMenuItem(
                    value: item['_id'].toString(),
                    child: Text(
                      '${time == null ? 'Waktu tidak diketahui' : formatHilWibDateTime(time)}'
                      ' · ${value?.toStringAsFixed(0) ?? '-'} bpm',
                      overflow: TextOverflow.ellipsis,
                    ),
                  );
                }).toList(),
                onChanged: _isSaving
                    ? null
                    : (id) => setState(() => _selectedSampleId = id),
              ),
            if (sample != null) ...[
              const SizedBox(height: 8),
              Text(
                'HR ${hr?.toStringAsFixed(1) ?? '-'} bpm · baseline '
                '${mean?.toStringAsFixed(1) ?? '-'} bpm'
                '${zScore == null ? '' : ' · z=${zScore.toStringAsFixed(2)}'}',
                key: const Key('hil-recorded-observation-summary'),
                style: AppTheme.font(size: 11, weight: FontWeight.w700),
              ),
              Text(
                candidate
                    ? 'Kandidat deviasi berdasarkan aturan eksperimen HIL.'
                    : _baseline.isEmpty
                        ? 'Baseline HIL aktivitas ini belum siap.'
                        : 'Sampel tidak melampaui ambang kandidat deviasi.',
                style: AppTheme.font(
                  size: 10,
                  color: candidate ? AppTheme.statusRed : AppTheme.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              FilledButton.icon(
                key: const Key('hil-recorded-trigger-scenario'),
                onPressed: candidate && !_isSaving ? _presentScenarioOutcome : null,
                icon: _isSaving
                    ? const SizedBox(
                        width: 15,
                        height: 15,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.bolt_rounded),
                label: Text(widget.scenario == 'B'
                    ? 'Tampilkan feedback satu arah'
                    : 'Minta klarifikasi peserta'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _scenarioOutcome() {
    if (_recommendation != null) {
      return Card(
        key: const Key('hil-recorded-scenario-B-result'),
        color: AppTheme.primarySoft,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Skenario B · feedback sistem',
                  style: AppTheme.font(size: 12, weight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text(_recommendation!),
              const SizedBox(height: 5),
              const Text('Feedback satu arah; tidak meminta klarifikasi.'),
            ],
          ),
        ),
      );
    }
    if (!_clarificationRequested) return const SizedBox.shrink();
    return Card(
      key: const Key('hil-recorded-scenario-C-result'),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Skenario C · klarifikasi peserta',
                style: AppTheme.font(size: 12, weight: FontWeight.w800)),
            const SizedBox(height: 5),
            const Text(
              'Apakah ada informasi yang mungkin terlewat sistem saat deviasi ini terjadi?',
            ),
            const SizedBox(height: 8),
            TextField(
              key: const Key('hil-recorded-clarification-input'),
              controller: _clarificationController,
              maxLength: 500,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'Contoh: saya baru selesai berjalan atau merasa stres',
                border: OutlineInputBorder(),
              ),
            ),
            FilledButton.icon(
              key: const Key('hil-recorded-submit-clarification'),
              onPressed:
                  _isGeneratingExplanation ? null : _submitClarification,
              icon: _isGeneratingExplanation
                  ? const SizedBox(
                      width: 15,
                      height: 15,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.auto_awesome_outlined),
              label: Text(_isGeneratingExplanation
                  ? 'Membuat penjelasan...'
                  : 'Simpan klarifikasi & buat penjelasan zero-shot'),
            ),
            if (_zeroShotExplanation != null) ...[
              const SizedBox(height: 12),
              Container(
                key: const Key('hil-recorded-zero-shot-explanation'),
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.primarySoft,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Penjelasan deviasi + klarifikasi',
                        style: AppTheme.font(size: 11, weight: FontWeight.w800)),
                    const SizedBox(height: 5),
                    Text(_zeroShotExplanation!),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _logHistory() => Card(
        key: const Key('hil-recorded-log-history'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Log eksperimen tersimpan',
                  style: AppTheme.font(size: 12, weight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('Run: $_runId', style: AppTheme.font(size: 9.5)),
              ..._logs.map((log) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.check_circle_outline, size: 16),
                    title: Text(log['event_type']?.toString() ?? ''),
                    subtitle: Text(
                      log['explanation']?.toString().isNotEmpty == true
                          ? log['explanation'].toString()
                          : log['recommendation']?.toString().isNotEmpty == true
                              ? log['recommendation'].toString()
                              : log['clarification']?.toString() ?? '',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  )),
            ],
          ),
        ),
      );

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: Text('Skenario ${widget.scenario} · ${_activityLabel(_activity)}'),
          actions: [
            IconButton(
              key: const Key('hil-recorded-refresh'),
              tooltip: 'Muat ulang rekaman',
              onPressed: _isLoading ? null : _loadSamples,
              icon: const Icon(Icons.refresh_rounded),
            ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.scenario == 'B'
                          ? 'Uji B · one-way feedback'
                          : 'Uji C · human in the loop',
                      style: AppTheme.font(size: 14, weight: FontWeight.w800),
                    ),
                    const SizedBox(height: 5),
                    const Text(
                      'Skenario menggunakan rekaman Polar H10 nyata dan baseline HIL. Sampel simulasi dan sampel pembentukan baseline tidak dipakai sebagai observasi deviasi.',
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      key: const Key('hil-recorded-activity-picker'),
                      initialValue: _activity,
                      decoration:
                          const InputDecoration(labelText: 'Aktivitas'),
                      items: _activities
                          .map((item) => DropdownMenuItem(
                                value: item.$1,
                                child: Text(item.$2),
                              ))
                          .toList(),
                      onChanged: _isLoading
                          ? null
                          : (activity) {
                              if (activity == null) return;
                              setState(() => _activity = activity);
                              unawaited(_loadSamples());
                            },
                    ),
                  ],
                ),
              ),
            ),
            if (_error != null)
              Card(
                color: AppTheme.statusYellowBg,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(
                    _error!,
                    key: const Key('hil-recorded-error'),
                    style: AppTheme.font(color: AppTheme.statusRed),
                  ),
                ),
              ),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              )
            else ...[
              _chartCard(),
              _observationCard(),
              _scenarioOutcome(),
              _logHistory(),
            ],
          ],
        ),
      );
}
