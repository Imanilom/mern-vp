import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';
import 'guided_baseline_session_screen.dart';
import 'human_in_the_loop_live_monitor_screen.dart';
import '../pedagogy/patient_journey_screen.dart';
import '../pedagogy/pedagogy_screen_what_changed.dart';

class HumanInTheLoopScreen extends StatefulWidget {
  const HumanInTheLoopScreen({super.key});

  @override
  State<HumanInTheLoopScreen> createState() => _HumanInTheLoopScreenState();
}

class _HumanInTheLoopScreenState extends State<HumanInTheLoopScreen> {
  static const _baselineActivities = <(String, String)>[
    ('Duduk', 'sitting'),
    ('Berdiri', 'standing'),
    ('Berjalan', 'walking'),
  ];

  String? _selectedScenario;
  String _strenuousActivity = 'uncertain';
  String _activityIntensity = 'uncertain';
  bool _isSubmittingClarification = false;
  bool _clarificationSaved = false;
  bool _hasResearchConsent = false;

  Map<String, dynamic> _map(dynamic value) =>
      value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

  List<Map<String, dynamic>> _maps(dynamic value) => value is List
      ? value.whereType<Map>().map(_map).toList()
      : <Map<String, dynamic>>[];

  Map<String, dynamic>? _stage(List<Map<String, dynamic>> stages, String id) {
    for (final stage in stages) {
      if (stage['stage_id'] == id) return stage;
    }
    return null;
  }

  Future<void> _submitClarification(String? segmentId) async {
    if (_isSubmittingClarification || segmentId == null) return;
    if (_strenuousActivity == 'yes' && _activityIntensity == 'not_applicable') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Pilih intensitas aktivitas yang dirasakan.')),
      );
      return;
    }
    if (_strenuousActivity == 'no') _activityIntensity = 'not_applicable';
    setState(() => _isSubmittingClarification = true);
    final saved =
        await context.read<AppState>().submitHumanInTheLoopClarification(
              segmentId: segmentId,
              strenuousActivity: _strenuousActivity,
              activityIntensity: _activityIntensity,
            );
    if (!mounted) return;
    setState(() {
      _isSubmittingClarification = false;
      _clarificationSaved = saved;
    });
    if (!saved) {
      final error = context.read<AppState>().dataError;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error ?? 'Klarifikasi gagal disimpan.')),
      );
    }
  }

  Future<void> _selectScenario(String scenario, String? segmentId) async {
    if (!_hasResearchConsent) return;
    setState(() {
      _selectedScenario = scenario;
      _clarificationSaved = false;
    });
    final saved = await context.read<AppState>().recordHumanInTheLoopScenario(
          scenario: scenario,
          segmentId: segmentId,
        );
    if (!mounted || saved) return;
    final error = context.read<AppState>().dataError;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Skenario $scenario ditampilkan, tetapi assignment belum tercatat: '
          '${error ?? 'periksa koneksi dan sesi akun.'}',
        ),
      ),
    );
  }

  Future<void> _openClarification(BuildContext context) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const WhatChangedScreen()),
    );
  }

  Future<void> _openHistory(BuildContext context) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const PatientJourneyScreen()),
    );
  }

  Future<void> _openGuidedBaseline() async {
    if (!_hasResearchConsent) {
      _showConsentRequired();
      return;
    }
    final appState = context.read<AppState>();
    await appState.fetchCaparInsights();
    if (!mounted) return;
    final rawCapar = appState.rawCaparInsights?['capar'];
    if (rawCapar is! Map) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            appState.dataError ??
                'Baseline akun tidak dapat dimuat. Periksa koneksi lalu coba lagi.',
          ),
        ),
      );
      return;
    }
    final baseline = rawCapar['baseline'];
    final contexts = baseline is Map && baseline['contexts'] is List
        ? (baseline['contexts'] as List)
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList()
        : <Map<String, dynamic>>[];
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => GuidedBaselineSessionScreen(
          includeRecoveryStage: false,
          showHciReview: false,
          baselineContextsAtStart: contexts,
        ),
      ),
    );
    if (!mounted) return;
    await context.read<AppState>().fetchCaparInsights();
  }

  Future<void> _requestResearchConsent() async {
    var checked = false;
    final consentGiven = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          key: const Key('hil-research-consent-dialog'),
          title: const Text('Persetujuan sesi Human in the Loop'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Tujuan sesi ini adalah menguji alur Human in the Loop dan pemantauan personal. Jika Anda setuju, data wearable (HR, interval RR, dan akselerasi), konteks aktivitas, serta jawaban klarifikasi digunakan untuk menampilkan dan mengevaluasi feedback sesi ini.',
                ),
                const SizedBox(height: 10),
                const Text(
                  'Keikutsertaan bersifat sukarela. Anda dapat menolak atau menghentikan sesi kapan saja. Data yang sudah tersimpan tetap mengikuti pengaturan dan kebijakan privasi akun Anda. Hasil aplikasi adalah informasi observasional, bukan diagnosis atau pengganti layanan kesehatan.',
                ),
                const SizedBox(height: 10),
                const Text(
                  'Dengan menyetujui, Anda mengizinkan penggunaan data tersebut dalam sesi Human in the Loop pada aplikasi ini. Persetujuan ini tidak menggantikan persetujuan etik institusi yang mungkin diwajibkan untuk penelitian.',
                ),
                const SizedBox(height: 8),
                CheckboxListTile(
                  key: const Key('hil-research-consent-check'),
                  contentPadding: EdgeInsets.zero,
                  value: checked,
                  controlAffinity: ListTileControlAffinity.leading,
                  title: const Text(
                    'Saya telah membaca informasi di atas dan setuju mengikuti sesi Human in the Loop.',
                  ),
                  onChanged: (value) =>
                      setDialogState(() => checked = value ?? false),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              key: const Key('hil-research-consent-decline'),
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Tidak setuju'),
            ),
            FilledButton(
              key: const Key('hil-research-consent-accept'),
              onPressed:
                  checked ? () => Navigator.pop(dialogContext, true) : null,
              child: const Text('Setuju dan lanjut'),
            ),
          ],
        ),
      ),
    );
    if (!mounted || consentGiven == null) return;
    setState(() => _hasResearchConsent = consentGiven);
  }

  void _showConsentRequired() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Baca dan berikan persetujuan sebelum memulai sesi HIL.'),
      ),
    );
  }

  String _statusLabel(String? status) => switch (status) {
        'awaiting_clarification' => 'Menunggu klarifikasi',
        'reinterpreted_with_limits' => 'Ditinjau ulang dengan batasan',
        'unresolved' => 'Unresolved · bukti belum cukup',
        'not_required' => 'Klarifikasi tidak diperlukan saat ini',
        'requested' => 'Klarifikasi diperlukan',
        'already_answered' => 'Klarifikasi sudah tercatat',
        'within_personal_region' => 'Dalam rentang baseline personal',
        'moderately_displaced' => 'Berbeda dari baseline personal',
        'strongly_displaced' => 'Jauh dari baseline personal',
        null || '' => 'Belum tersedia',
        _ => status.replaceAll('_', ' '),
      };

  String _normalizeActivity(String? value) {
    final normalized = value?.trim().toLowerCase() ?? '';
    return switch (normalized) {
      'duduk' || 'sit' => 'sitting',
      'berdiri' || 'stand' => 'standing',
      'berjalan' || 'walk' => 'walking',
      'berlari' || 'run' => 'running',
      'olahraga' || 'exercise' => 'exercise',
      'kerja' || 'fokus' || 'focus' => 'work',
      'tidur' => 'sleep',
      'istirahat' || 'resting' => 'rest',
      _ => normalized,
    };
  }

  bool _isActivityContextMature(
    Map<String, dynamic> baseline,
    String activity, {
    String? timePeriod,
  }) {
    if (_normalizeActivity(baseline['activity']?.toString()) != activity) {
      return false;
    }
    if (timePeriod != null &&
        baseline['time_period']?.toString() != timePeriod) {
      return false;
    }
    final level = baseline['level']?.toString().toLowerCase() ??
        _map(baseline['maturity_detail'])['level']?.toString().toLowerCase();
    return const {'mature', 'mature_legacy'}.contains(level);
  }

  List<Map<String, dynamic>> _positiveZScoreFeatures(
    Map<String, dynamic> observation,
  ) {
    final features = observation['features'];
    if (features is! List) return [];
    return features
        .whereType<Map>()
        .map(_map)
        .where((feature) =>
            feature['z_score'] is num && (feature['z_score'] as num) > 0)
        .toList();
  }

  String _scenarioNarrative(
    Map<String, dynamic> observation,
    List<Map<String, dynamic>> positiveZScores,
  ) {
    if (observation['status'] != 'available') {
      return 'Data sensor, mutu sinyal, atau baseline aktivitas/waktu yang cocok belum cukup. Status unresolved; sistem tidak memaksakan interpretasi.';
    }
    final activity = observation['activity']?.toString();
    final detail = positiveZScores.isEmpty
        ? 'tidak ada fitur terukur yang berada di atas rerata baseline (z-score > 0)'
        : positiveZScores
            .map((feature) =>
                '${feature['label'] ?? feature['feature'] ?? 'fitur'} z=${(feature['z_score'] as num).toStringAsFixed(2)}')
            .join(', ');
    return 'Untuk ${activity ?? 'aktivitas'}${observation['time_period'] == null ? '' : ' · ${observation['time_period']}'}, '
        '$detail. Deviasi pada HIL dimulai saat z-score fitur di atas baseline (> 0), tanpa tau tambahan. '
        'Ini observasi statistik personal, bukan diagnosis.';
  }

  Widget _scenarioButton({
    required String code,
    required String title,
    required String detail,
    required bool selected,
    required bool enabled,
    required VoidCallback onPressed,
  }) =>
      Card(
        key: Key('hil-scenario-$code'),
        color: selected ? const Color(0xFFEFF8F4) : null,
        shape: RoundedRectangleBorder(
          side: BorderSide(
            color: selected ? const Color(0xFF16805D) : Colors.transparent,
            width: 1.5,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: ListTile(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          leading: CircleAvatar(
            backgroundColor: selected ? const Color(0xFF16805D) : null,
            foregroundColor: selected ? Colors.white : null,
            child: Text(code),
          ),
          title: Text(title),
          subtitle: Text(
            detail,
            style: AppTheme.font(
              size: 10.5,
              color: enabled ? AppTheme.textSecondary : AppTheme.textMuted,
              height: 1.4,
            ),
          ),
          trailing: Icon(selected ? Icons.check_circle : Icons.chevron_right),
          onTap: enabled ? onPressed : null,
        ),
      );

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final capar = _map(state.rawCaparInsights?['capar']);
    final pedagogy = _map(capar['pedagogy']);
    final resolution = _map(pedagogy['reasoning_resolution']);
    final followUp = _map(pedagogy['follow_up']);
    final observation = state.latestCaparMahalanobis ?? <String, dynamic>{};
    final latestObservation = _map(capar['latest_observation']);
    final positiveZScores = _positiveZScoreFeatures(latestObservation);
    final rawStages = state.reasoningPipeline?['stages'];
    final stages = rawStages is List
        ? rawStages.whereType<Map>().map(_map).toList()
        : <Map<String, dynamic>>[];
    final quality = _stage(stages, 'quality_gate') ?? <String, dynamic>{};
    final baselineStage =
        _stage(stages, 'personal_baseline') ?? <String, dynamic>{};
    final baselineContexts = _maps(_map(capar['baseline'])['contexts']);
    final observationActivity = _normalizeActivity(
      latestObservation['activity']?.toString(),
    );
    final observationTimePeriod = latestObservation['time_period']?.toString();
    final matchingObservationBaselineReady =
        baselineContexts.any((baseline) => _isActivityContextMature(
              baseline,
              observationActivity,
              timePeriod: observationTimePeriod,
            ));
    final scenariosReady = matchingObservationBaselineReady;
    final followUpStatus =
        followUp['status']?.toString() ?? state.followUpPrompt.status;
    final resolutionStatus = resolution['status']?.toString() ??
        (followUpStatus == 'requested'
            ? 'awaiting_clarification'
            : followUpStatus == 'already_answered'
                ? 'unresolved'
                : 'not_required');
    final deviation = pedagogy['what_changed'] is Map
        ? _map(pedagogy['what_changed'])
        : <String, dynamic>{};
    final factors = deviation['main_factors'] is List
        ? (deviation['main_factors'] as List)
            .whereType<Map>()
            .map(_map)
            .take(3)
            .toList()
        : <Map<String, dynamic>>[];
    final qualityPassed = quality['status'] == 'passed';
    final baselineMature = baselineStage['status'] == 'mature';
    final interpretation = resolution['interpretation']?.toString();
    final segmentId =
        observation['segment_id']?.toString() ?? state.followUpPrompt.segmentId;
    final hasSegment = segmentId != null &&
        RegExp(r'^[a-f\d]{24}$', caseSensitive: false).hasMatch(segmentId);
    return MockupScaffold(
      title: 'Human In the Loop',
      subtitle: Text(
        'Baseline per aktivitas, deteksi z-score, dan klarifikasi peserta',
        style: AppTheme.font(size: 10, color: AppTheme.textSecondary),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _researchConsentCard(),
          const SizedBox(height: 12),
          _sectionTitle('Pilih skenario eksperimen'),
          _scenarioButton(
            code: 'A',
            title: 'Pembentukan baseline per aktivitas',
            detail:
                'Bentuk profil aktivitas satu per satu. Data dibandingkan dengan baseline CAPAR untuk aktivitas dan waktu yang sama.',
            selected: _selectedScenario == 'A',
            enabled: _hasResearchConsent,
            onPressed: () => setState(() => _selectedScenario = 'A'),
          ),
          _scenarioButton(
            code: 'B',
            title: 'One-way feedback',
            detail:
                'Tampilkan narasi deviasi yang terukur tanpa meminta klarifikasi.',
            selected: _selectedScenario == 'B',
            enabled: scenariosReady && _hasResearchConsent,
            onPressed: () => _selectScenario('B', segmentId),
          ),
          _scenarioButton(
            code: 'C',
            title: 'Human in the loop',
            detail:
                'Tampilkan deviasi, tanyakan aktivitas berat dan intensitasnya, lalu pertahankan unresolved bila bukti belum cukup.',
            selected: _selectedScenario == 'C',
            enabled: scenariosReady && _hasResearchConsent,
            onPressed: () => _selectScenario('C', segmentId),
          ),
          if (!_hasResearchConsent)
            Padding(
              padding: const EdgeInsets.only(top: 7, bottom: 10),
              child: Text(
                'Skenario dan perekaman dinonaktifkan sampai persetujuan sesi diberikan.',
                key: const Key('hil-consent-required'),
                style: AppTheme.font(
                  size: 10.5,
                  color: AppTheme.statusOrange,
                ),
              ),
            ),
          if (!scenariosReady)
            Padding(
              padding: const EdgeInsets.only(top: 7, bottom: 10),
              child: Text(
                'Skenario B/C memerlukan baseline matang untuk aktivitas dan waktu observasi yang sedang dievaluasi.',
                key: const Key('hil-scenarios-locked'),
                style: AppTheme.font(
                  size: 10.5,
                  color: AppTheme.textSecondary,
                ),
              ),
            ),
          const SizedBox(height: 10),
          _activityBaselineCard(
            contexts: baselineContexts,
            onStart: _openGuidedBaseline,
            canStart: _hasResearchConsent,
          ),
          if (_selectedScenario == 'B') ...[
            const SizedBox(height: 10),
            _scenarioResultCard(
              title: 'One-way feedback · hasil sistem',
              detail: _scenarioNarrative(latestObservation, positiveZScores),
              key: const Key('hil-one-way-result'),
            ),
          ],
          if (_selectedScenario == 'C') ...[
            const SizedBox(height: 10),
            _humanInTheLoopCard(
              observation: latestObservation,
              positiveZScores: positiveZScores,
              segmentId: segmentId,
              hasSegment: hasSegment,
              resolutionStatus: resolutionStatus,
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                key: const Key('hil-open-live-monitor'),
                onPressed: _hasResearchConsent
                    ? () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => HumanInTheLoopLiveMonitorScreen(
                              baselineContexts: baselineContexts,
                              initialActivity: observationActivity,
                            ),
                          ),
                        )
                    : null,
                icon: const Icon(Icons.monitor_heart_outlined),
                label: const Text('Mulai pemantauan live HIL'),
              ),
            ),
          ],
          const SizedBox(height: 14),
          _sectionTitle('Resolusi bukti'),
          _stepCard(
            number: '01',
            title: 'Deteksi perubahan dari z-score',
            detail: _scenarioNarrative(latestObservation, positiveZScores),
          ),
          _stepCard(
            number: '02',
            title: 'Periksa kualitas dan baseline',
            detail:
                'Quality gate: ${qualityPassed ? 'lolos' : quality['status'] == 'insufficient_data' ? 'data belum cukup' : 'belum lolos/tersedia'}'
                ' · baseline aktivitas/waktu: ${matchingObservationBaselineReady ? 'matang dan cocok' : 'belum cocok atau belum matang'}'
                '${baselineStage['segment_count'] == null ? '' : ' (${baselineStage['segment_count']} segmen pada konteks terbaru)'}',
          ),
          _stepCard(
            number: '03',
            title: 'Tinjau bukti dan batas interpretasi',
            detail: factors.isEmpty
                ? (interpretation ??
                    'Bukti yang tersedia ditampilkan apa adanya. Satu perubahan tidak cukup untuk menyimpulkan penyebab atau diagnosis.')
                : '${factors.map((factor) => factor['physiology'] ?? factor['feature'] ?? 'sinyal').join(', ')}. '
                    'Perbandingan bergantung pada mutu sinyal dan kecocokan baseline aktivitas/waktu.',
          ),
          _stepCard(
            number: '04',
            title: 'Klarifikasi peserta',
            detail: followUpStatus == 'requested'
                ? 'CAPAR meminta konfirmasi aktivitas, faktor yang dirasakan, gejala, dan kondisi perangkat.'
                : followUpStatus == 'already_answered'
                    ? 'Jawaban klarifikasi sudah tercatat dan dapat dipertimbangkan bersama bukti sensor.'
                    : 'Skenario C meminta klarifikasi aktivitas berat dan intensitas; jawaban adalah laporan peserta, bukan bukti penyebab.',
          ),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              key: const Key('hil-open-clarification'),
              onPressed: () => _openClarification(context),
              icon: const Icon(Icons.question_answer_outlined),
              label: Text(followUpStatus == 'requested'
                  ? 'Isi klarifikasi lanjutan'
                  : 'Tinjau klarifikasi lanjutan'),
            ),
          ),
          const SizedBox(height: 8),
          _stepCard(
            number: '05',
            title: 'Tafsir ulang hanya jika bukti cukup',
            detail: _statusLabel(resolutionStatus) +
                (interpretation == null ? '' : ' · $interpretation'),
            warning: resolutionStatus == 'unresolved' ||
                !qualityPassed ||
                !baselineMature,
          ),
          _stepCard(
            number: '06',
            title: 'Feedback dan observasi lanjutan',
            detail: resolution['next_step']?.toString() ==
                    'observe_next_comparable_window'
                ? 'Amati window berikutnya yang lolos quality gate pada aktivitas dan waktu yang sebanding.'
                : resolution['next_step']?.toString() ==
                        'observe_next_quality_gated_window'
                    ? 'Bukti belum cukup atau masih bertentangan; status tetap unresolved sambil menunggu observasi berkualitas berikutnya.'
                    : 'Lanjutkan pemantauan dan tinjau perubahan berikutnya bersama konteksnya.',
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              key: const Key('hil-open-longitudinal'),
              onPressed: () => _openHistory(context),
              icon: const Icon(Icons.timeline_rounded),
              label: const Text('Lihat grafik dan observasi lanjutan'),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Klarifikasi peserta adalah konteks yang dilaporkan, bukan bukti penyebab. Interpretasi tetap unresolved jika data tidak cukup atau saling bertentangan; halaman ini bukan alat diagnosis.',
            style: AppTheme.font(
              size: 10.5,
              color: AppTheme.textMuted,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String title) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(title,
            style: AppTheme.font(size: 13, weight: FontWeight.w800)),
      );

  Widget _researchConsentCard() => Container(
        key: const Key('hil-research-consent-card'),
        width: double.infinity,
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: _hasResearchConsent ? AppTheme.statusGreenBg : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: _hasResearchConsent
                ? AppTheme.statusGreen
                : AppTheme.borderLight,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  _hasResearchConsent
                      ? Icons.verified_user_outlined
                      : Icons.assignment_outlined,
                  color: _hasResearchConsent
                      ? AppTheme.statusGreen
                      : AppTheme.primary,
                ),
                const SizedBox(width: 9),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Persetujuan peserta',
                        style: AppTheme.font(
                          size: 12,
                          weight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _hasResearchConsent
                            ? 'Persetujuan diberikan untuk sesi ini. Anda tetap dapat menghentikan sesi kapan saja.'
                            : 'Baca informasi sesi dan berikan persetujuan secara sukarela sebelum baseline atau skenario dimulai.',
                        style: AppTheme.font(
                          size: 10.5,
                          color: AppTheme.textSecondary,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                key: const Key('hil-research-consent-open'),
                onPressed: _requestResearchConsent,
                child: Text(
                  _hasResearchConsent
                      ? 'Tinjau atau ubah persetujuan'
                      : 'Baca dan berikan persetujuan',
                ),
              ),
            ),
          ],
        ),
      );

  Widget _activityBaselineCard({
    required List<Map<String, dynamic>> contexts,
    required VoidCallback onStart,
    required bool canStart,
  }) {
    return Container(
      key: const Key('hil-activity-baseline'),
      width: double.infinity,
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('A · Profil baseline per aktivitas',
              style: AppTheme.font(size: 12, weight: FontWeight.w800)),
          const SizedBox(height: 5),
          Text(
            'Rekam baseline secara berurutan: duduk, berdiri, lalu berjalan. Setiap langkah berlangsung 5 menit; tahap berdiri dan berjalan boleh dilewati jika tidak nyaman.',
            style: AppTheme.font(
              size: 10.5,
              color: AppTheme.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 9),
          ...List.generate(_baselineActivities.length, (index) {
            final activity = _baselineActivities[index];
            final contextsForActivity = contexts
                .where((context) =>
                    _normalizeActivity(context['activity']?.toString()) ==
                    activity.$2)
                .toList();
            final matureContexts = contextsForActivity
                .where(
                    (context) => _isActivityContextMature(context, activity.$2))
                .length;
            final isMature = matureContexts > 0;
            final count = contextsForActivity.fold<int>(
              0,
              (total, context) =>
                  total + ((context['segment_count'] as num?)?.toInt() ?? 0),
            );
            return Container(
              key: Key('hil-baseline-step-${index + 1}'),
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 8),
              decoration: BoxDecoration(
                color: isMature
                    ? AppTheme.statusGreen.withValues(alpha: 0.08)
                    : Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isMature ? AppTheme.statusGreen : AppTheme.borderLight,
                ),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 13,
                    backgroundColor:
                        isMature ? AppTheme.statusGreen : AppTheme.primarySoft,
                    foregroundColor:
                        isMature ? Colors.white : AppTheme.primaryDark,
                    child: isMature
                        ? const Icon(Icons.check_rounded, size: 16)
                        : Text(
                            '${index + 1}',
                            style: AppTheme.font(
                                size: 10, weight: FontWeight.w800),
                          ),
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Text(
                      activity.$1,
                      style: AppTheme.font(size: 10.5, weight: FontWeight.w700),
                    ),
                  ),
                  Text(
                    contextsForActivity.isEmpty
                        ? 'Belum ada data'
                        : isMature
                            ? 'Matang · $count segmen'
                            : 'Belum matang · $count segmen',
                    style: AppTheme.font(
                      size: 9.5,
                      weight: FontWeight.w600,
                      color: isMature
                          ? AppTheme.statusGreen
                          : AppTheme.textSecondary,
                    ),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 9),
          SizedBox(
            width: double.infinity,
            child: Column(
              children: [
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    key: const Key('hil-start-guided-baseline'),
                    onPressed: canStart ? onStart : null,
                    icon: const Icon(Icons.play_arrow_rounded),
                    label: const Text('Mulai langkah baseline'),
                  ),
                ),
                if (!canStart)
                  Padding(
                    padding: const EdgeInsets.only(top: 5),
                    child: Text(
                      'Berikan persetujuan terlebih dahulu untuk memulai perekaman.',
                      key: const Key('hil-baseline-consent-required'),
                      style: AppTheme.font(
                        size: 9.5,
                        color: AppTheme.statusOrange,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Jangan memilih label yang tidak sesuai dengan gerakan aktual. Lakukan aktivitas hanya bila aman dan hentikan jika tidak nyaman.',
            style: AppTheme.font(
              size: 9.5,
              color: AppTheme.textMuted,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }

  Widget _humanInTheLoopCard({
    required Map<String, dynamic> observation,
    required List<Map<String, dynamic>> positiveZScores,
    required String? segmentId,
    required bool hasSegment,
    required String resolutionStatus,
  }) =>
      Container(
        key: const Key('hil-human-loop-form'),
        width: double.infinity,
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.borderLight),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Human in the loop · konfirmasi peserta',
                style: AppTheme.font(size: 12, weight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(
              _scenarioNarrative(observation, positiveZScores),
              style: AppTheme.font(
                size: 10.5,
                color: AppTheme.textSecondary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Sebelum atau saat perubahan ini, apakah Anda melakukan aktivitas fisik berat?',
              style: AppTheme.font(size: 10.5, weight: FontWeight.w700),
            ),
            const SizedBox(height: 5),
            _choiceChips(
              group: 'strenuous',
              value: _strenuousActivity,
              options: const [
                ('yes', 'Ya'),
                ('no', 'Tidak'),
                ('uncertain', 'Tidak yakin'),
              ],
              onSelected: (value) => setState(() {
                _strenuousActivity = value;
                if (value == 'no') _activityIntensity = 'not_applicable';
                if (value == 'yes' && _activityIntensity == 'not_applicable') {
                  _activityIntensity = 'uncertain';
                }
              }),
            ),
            if (_strenuousActivity == 'yes') ...[
              const SizedBox(height: 8),
              Text(
                'Seberapa berat aktivitas tersebut dirasakan?',
                style: AppTheme.font(size: 10.5, weight: FontWeight.w700),
              ),
              const SizedBox(height: 5),
              _choiceChips(
                group: 'intensity',
                value: _activityIntensity,
                options: const [
                  ('light', 'Ringan'),
                  ('moderate', 'Sedang'),
                  ('heavy', 'Berat'),
                  ('very_heavy', 'Sangat berat'),
                  ('uncertain', 'Tidak yakin'),
                ],
                onSelected: (value) =>
                    setState(() => _activityIntensity = value),
              ),
            ],
            if (!hasSegment)
              Padding(
                padding: const EdgeInsets.only(top: 9),
                child: Text(
                  'Klarifikasi belum dapat dikaitkan karena ID event deviasi tidak tersedia. Status tetap unresolved.',
                  key: const Key('hil-no-event'),
                  style: AppTheme.font(
                    size: 10,
                    color: AppTheme.statusOrange,
                    height: 1.35,
                  ),
                ),
              ),
            const SizedBox(height: 9),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                key: const Key('hil-submit-clarification'),
                onPressed: !hasSegment ||
                        _isSubmittingClarification ||
                        _clarificationSaved
                    ? null
                    : () => _submitClarification(segmentId),
                icon: _isSubmittingClarification
                    ? const SizedBox(
                        width: 15,
                        height: 15,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(_clarificationSaved
                        ? Icons.check_circle_outline
                        : Icons.send_rounded),
                label: Text(_clarificationSaved
                    ? 'Klarifikasi tersimpan'
                    : 'Kirim klarifikasi untuk ditinjau'),
              ),
            ),
            if (_clarificationSaved)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  resolutionStatus == 'reinterpreted_with_limits'
                      ? 'Konteks baru dipertimbangkan bersama mutu sinyal dan baseline; interpretasi diperbarui dengan batasan, bukan menetapkan penyebab.'
                      : 'Klarifikasi dicatat. Status ${_statusLabel(resolutionStatus)} sampai mutu sinyal, baseline yang cocok, dan bukti lain memadai.',
                  key: const Key('hil-post-clarification-status'),
                  style: AppTheme.font(
                    size: 10,
                    color: AppTheme.textSecondary,
                    height: 1.4,
                  ),
                ),
              ),
          ],
        ),
      );

  Widget _choiceChips({
    required String group,
    required String value,
    required List<(String, String)> options,
    required ValueChanged<String> onSelected,
  }) =>
      Wrap(
        spacing: 6,
        runSpacing: 4,
        children: options.map((option) {
          final selected = value == option.$1;
          return ChoiceChip(
            key: Key('hil-$group-${option.$1}'),
            label: Text(option.$2),
            selected: selected,
            onSelected: (_) => onSelected(option.$1),
          );
        }).toList(),
      );

  Widget _scenarioResultCard({
    required String title,
    required String detail,
    Key? key,
  }) =>
      Container(
        key: key,
        width: double.infinity,
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: AppTheme.primarySoft,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.primaryLight),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: AppTheme.font(size: 12, weight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(
              detail,
              style: AppTheme.font(
                size: 10.5,
                color: AppTheme.textPrimary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              'Feedback hanya satu arah pada skenario ini; tidak meminta konteks tambahan.',
              style: AppTheme.font(size: 10, color: AppTheme.textMuted),
            ),
          ],
        ),
      );

  Widget _stepCard({
    required String number,
    required String title,
    required String detail,
    bool warning = false,
  }) =>
      Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 9),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: warning ? AppTheme.statusYellowBg : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: warning ? AppTheme.statusYellow : AppTheme.borderLight,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 30,
              height: 30,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: warning ? AppTheme.statusYellow : AppTheme.primarySoft,
                borderRadius: BorderRadius.circular(9),
              ),
              child: Text(
                number,
                style: AppTheme.font(
                  size: 10,
                  weight: FontWeight.w800,
                  color: warning ? AppTheme.textPrimary : AppTheme.primaryDark,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: AppTheme.font(size: 12, weight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text(
                    detail,
                    style: AppTheme.font(
                      size: 10.5,
                      color: AppTheme.textSecondary,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
}
