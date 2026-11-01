import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../utils/hil_time.dart';
import '../../widgets/custom_widgets.dart';
import 'guided_baseline_session_screen.dart';
import 'hil_recorded_scenario_screen.dart';
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
  bool _hasResearchConsent = false;
  bool _isUpdatingAiConsent = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final appState = context.read<AppState>();
      if (appState.isAuthenticated) {
        unawaited(appState.fetchCaparInsights());
        unawaited(appState.fetchHilBaselines());
        unawaited(appState.fetchRecentEvents(limit: 100));
        unawaited(appState.fetchHilExplanationHistory(limit: 100));
        unawaited(appState.fetchHilScenarioLogs(limit: 100));
      }
    });
  }

  Map<String, dynamic> _map(dynamic value) =>
      value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

  Map<String, dynamic>? _stage(List<Map<String, dynamic>> stages, String id) {
    for (final stage in stages) {
      if (stage['stage_id'] == id) return stage;
    }
    return null;
  }

  Future<void> _selectScenario(String scenario) async {
    if (!_hasResearchConsent) return;
    setState(() {
      _selectedScenario = scenario;
    });
    final appState = context.read<AppState>();
    final latestObservation = _map(
      _map(appState.rawCaparInsights?['capar'])['latest_observation'],
    );
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => HilRecordedScenarioScreen(
          scenario: scenario,
          baselineContexts: appState.hilBaselineContexts,
          initialActivity: _normalizeActivity(
            latestObservation['activity']?.toString(),
          ),
        ),
      ),
    );
    if (!mounted) return;
    setState(() => _selectedScenario = null);
    await Future.wait([
      appState.fetchHilExplanationHistory(limit: 100),
      appState.fetchRecentEvents(limit: 100),
      appState.fetchHilScenarioLogs(limit: 100),
    ]);
  }

  Future<void> _openDeviationClarification({
    required String? segmentId,
    required String activity,
    required Map<String, dynamic> reportedContext,
  }) async {
    if (segmentId == null) return;
    final previousActivity =
        reportedContext['activity_before_event']?.toString() ?? '';
    final activityController = TextEditingController(
      text: previousActivity == 'unknown' ? '' : previousActivity,
    );
    final activityEndController = TextEditingController(
      text: reportedContext['activity_end_time']?.toString() ?? '',
    );
    final noteController = TextEditingController(
      text: reportedContext['note']?.toString() ?? '',
    );
    String? measurementCondition =
        reportedContext['measurement_condition']?.toString();
    var isSubmitting = false;
    String? result;

    try {
      result = await showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setDialogState) {
            Future<void> save(String status) async {
              if (isSubmitting) return;
              if (status == 'submitted' &&
                  activityController.text.trim().isEmpty) {
                ScaffoldMessenger.of(dialogContext).showSnackBar(
                  const SnackBar(
                    content: Text(
                        'Isi aktivitas sebelumnya atau pilih “Tidak ingat”.'),
                  ),
                );
                return;
              }
              setDialogState(() => isSubmitting = true);
              final saved = await dialogContext
                  .read<AppState>()
                  .submitHumanInTheLoopClarification(
                    segmentId: segmentId,
                    clarificationStatus: status,
                    activityBeforeEvent: status == 'skipped'
                        ? null
                        : status == 'not_remembered'
                            ? 'unknown'
                            : activityController.text.trim(),
                    activityEndTime: status == 'skipped'
                        ? null
                        : activityEndController.text.trim(),
                    measurementCondition:
                        status == 'skipped' ? null : measurementCondition,
                    contextNote:
                        status == 'skipped' ? '' : noteController.text.trim(),
                  );
              if (!dialogContext.mounted) return;
              setDialogState(() => isSubmitting = false);
              if (saved) {
                Navigator.of(dialogContext).pop(status);
              } else {
                final error = dialogContext.read<AppState>().dataError;
                ScaffoldMessenger.of(dialogContext).showSnackBar(
                  SnackBar(
                    content: Text(error ??
                        'Klarifikasi gagal disimpan. Silakan coba lagi.'),
                  ),
                );
              }
            }

            return AlertDialog(
              key: const Key('hil-deviation-clarification-dialog'),
              title: const Text('Bantu lengkapi konteks pengukuran Anda'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Denyut jantung Anda saat ${_hilActivityLabel(activity)} berbeda dari baseline personal. Penyebabnya belum dapat dipastikan. Apakah ada aktivitas atau kondisi sebelum pengukuran yang belum tercatat?',
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Periksa informasi berikut, lalu koreksi atau tambahkan konteks bila diperlukan.',
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: const [
                        'Istirahat',
                        'Duduk',
                        'Berjalan',
                        'Olahraga',
                        'Bekerja',
                        'Makan',
                      ].map((activityOption) {
                        return ChoiceChip(
                          key: Key('hil-activity-option-$activityOption'),
                          label: Text(activityOption),
                          selected: activityController.text == activityOption,
                          onSelected: isSubmitting
                              ? null
                              : (_) => setDialogState(
                                    () => activityController.text =
                                        activityOption,
                                  ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      key: const Key('hil-clarification-activity'),
                      controller: activityController,
                      maxLength: 120,
                      decoration: const InputDecoration(
                        labelText: 'Aktivitas sebelumnya',
                        hintText: 'Pilih atau tuliskan aktivitas',
                        border: OutlineInputBorder(),
                      ),
                      textCapitalization: TextCapitalization.sentences,
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      key: const Key('hil-clarification-activity-end'),
                      controller: activityEndController,
                      maxLength: 80,
                      decoration: const InputDecoration(
                        labelText: 'Kapan aktivitas berakhir',
                        hintText:
                            'Perkiraan waktu, mis. sekitar 10 menit sebelumnya',
                        border: OutlineInputBorder(),
                      ),
                      textCapitalization: TextCapitalization.sentences,
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      key: const Key('hil-clarification-measurement-condition'),
                      initialValue: measurementCondition,
                      decoration: const InputDecoration(
                        labelText:
                            'Kondisi perangkat saat pengukuran (opsional)',
                        border: OutlineInputBorder(),
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'worn_as_usual',
                          child: Text('Dipakai seperti biasa'),
                        ),
                        DropdownMenuItem(
                          value: 'adjusted_during_event',
                          child: Text('Disesuaikan saat itu'),
                        ),
                        DropdownMenuItem(
                          value: 'loose_or_moving',
                          child: Text('Longgar atau banyak bergerak'),
                        ),
                        DropdownMenuItem(
                          value: 'not_worn',
                          child: Text('Tidak dipakai'),
                        ),
                        DropdownMenuItem(
                          value: 'unknown',
                          child: Text('Tidak yakin'),
                        ),
                      ],
                      onChanged: isSubmitting
                          ? null
                          : (value) => setDialogState(
                                () => measurementCondition = value,
                              ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      key: const Key('hil-clarification-note'),
                      controller: noteController,
                      maxLength: 500,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        labelText: 'Konteks tambahan (opsional)',
                        border: OutlineInputBorder(),
                      ),
                      textCapitalization: TextCapitalization.sentences,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Informasi Anda akan digunakan untuk meninjau kembali interpretasi sistem.',
                      style: AppTheme.font(
                        size: 10,
                        color: AppTheme.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  key: const Key('hil-clarification-skip'),
                  onPressed: isSubmitting ? null : () => save('skipped'),
                  child: const Text('Lewati'),
                ),
                TextButton(
                  key: const Key('hil-clarification-not-remembered'),
                  onPressed: isSubmitting ? null : () => save('not_remembered'),
                  child: const Text('Tidak ingat'),
                ),
                FilledButton(
                  key: const Key('hil-clarification-submit'),
                  onPressed: isSubmitting ? null : () => save('submitted'),
                  child: isSubmitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Kirim dan tinjau ulang'),
                ),
              ],
            );
          },
        ),
      );
    } finally {
      activityController.dispose();
      activityEndController.dispose();
      noteController.dispose();
    }

    if (!mounted || result == null) return;
    if (result == 'skipped') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Klarifikasi dilewati. Anda dapat menambahkan konteks nanti melalui detail pengukuran.',
          ),
        ),
      );
    } else if (result == 'not_remembered') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Tidak apa-apa. Kami akan menggunakan informasi yang tersedia. Penyebab perbedaan denyut jantung belum dapat dipastikan.',
          ),
        ),
      );
    }
  }

  Future<void> _openLiveMonitor(
    List<Map<String, dynamic>> baselineContexts,
    String initialActivity,
  ) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => HumanInTheLoopLiveMonitorScreen(
          baselineContexts: baselineContexts,
          initialActivity: initialActivity,
        ),
      ),
    );
    if (!mounted) return;
    final appState = context.read<AppState>();
    await Future.wait([
      appState.fetchHilScenarioLogs(limit: 100),
      appState.fetchRecentEvents(limit: 100),
    ]);
  }

  Future<void> _showScenarioHistory(EventItem event) async {
    final snapshot = _map(event.value);
    final scenario = snapshot['scenario']?.toString();
    final factors = snapshot['factors'] is List
        ? (snapshot['factors'] as List).whereType<String>().toList()
        : <String>[];
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        key: const Key('hil-scenario-history-detail'),
        title: Text(
          scenario == null
              ? 'Riwayat skenario HIL'
              : 'Skenario $scenario · ${scenario == 'B' ? 'Saran dari sistem' : 'Klarifikasi dari pengguna'}',
        ),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                formatHilWibDateTime(event.timestamp),
              ),
              if (snapshot['activity'] != null) ...[
                const SizedBox(height: 8),
                Text('Aktivitas: ${snapshot['activity']}'),
              ],
              if (snapshot['status'] != null) ...[
                const SizedBox(height: 4),
                Text('Status: ${_statusLabel(snapshot['status']?.toString())}'),
              ],
              if (snapshot['quality_status'] != null) ...[
                const SizedBox(height: 4),
                Text('Pemeriksaan mutu bacaan: ${snapshot['quality_status']}'),
              ],
              const SizedBox(height: 10),
              Text(snapshot['explanation']?.toString() ?? event.details),
              if (factors.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text('Faktor yang tercatat: ${factors.join(', ')}'),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Tutup'),
          ),
        ],
      ),
    );
  }

  Widget _scenarioHistoryCard(List<EventItem> events) {
    final history = events
        .where((event) => event.eventType == 'hil_scenario')
        .take(5)
        .toList();
    return Container(
      key: const Key('hil-scenario-history'),
      width: double.infinity,
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Riwayat penjelasan skenario B/C',
            style: AppTheme.font(size: 12, weight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            'Snapshot penjelasan disimpan saat skenario dipilih. Tampilkan kembali untuk membandingkan dengan penjelasan saat ini.',
            style: AppTheme.font(
              size: 10.5,
              color: AppTheme.textSecondary,
              height: 1.4,
            ),
          ),
          if (history.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Belum ada sesi B/C tersimpan.',
                key: const Key('hil-scenario-history-empty'),
                style: AppTheme.font(size: 10.5, color: AppTheme.textMuted),
              ),
            )
          else
            ...history.map((event) {
              final snapshot = _map(event.value);
              final scenario = snapshot['scenario']?.toString();
              final time = formatHilWibDateTime(event.timestamp);
              return ListTile(
                key: Key('hil-scenario-history-${event.id}'),
                contentPadding: EdgeInsets.zero,
                title: Text(
                  scenario == null
                      ? event.details
                      : 'Skenario $scenario · ${scenario == 'B' ? 'Saran dari sistem' : 'Klarifikasi dari pengguna'}',
                  style: AppTheme.font(size: 10.5, weight: FontWeight.w700),
                ),
                subtitle: Text(
                  '$time · ${snapshot['activity'] ?? 'aktivitas tidak tersedia'} · '
                  '${snapshot['status'] == null ? event.details : _statusLabel(snapshot['status']?.toString())}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => _showScenarioHistory(event),
              );
            }),
        ],
      ),
    );
  }

  String _scenarioLogEventLabel(String? eventType) => switch (eventType) {
        'scenario_started' => 'Skenario dibuka',
        'activity_selected' => 'Aktivitas dipilih',
        'live_recording_started' => 'Rekaman sensor dimulai',
        'live_recording_stopped' => 'Rekaman sensor dihentikan',
        'live_recording_interrupted' => 'Rekaman sensor terputus',
        'records_loaded' => 'Data sensor dimuat',
        'deviation_detected' => 'Perubahan di luar pola biasa terdeteksi',
        'feedback_presented' => 'Saran ditampilkan',
        'clarification_requested' => 'Sistem meminta klarifikasi',
        'clarification_submitted' => 'Klarifikasi dikirim pengguna',
        'zero_shot_generated' => 'Ringkasan otomatis dibuat',
        'zero_shot_failed' => 'Ringkasan otomatis gagal dibuat',
        'activity_clarification_requested' => 'Sistem meminta keterangan',
        'activity_clarification_answered' => 'Keterangan pengguna diterima',
        'deviation_recommendation' => 'Saran ditampilkan',
        'hr_recovery_observed' => 'Denyut mendekati kisaran biasa',
        'dfa_5_minute_batch' => 'Ringkasan pola detak selesai',
        _ => eventType?.replaceAll('_', ' ') ?? 'Kejadian tercatat',
      };

  String _hilActivityLabel(dynamic activity) => switch (activity?.toString()) {
        'sitting' => 'duduk',
        'standing' => 'berdiri',
        'walking' => 'berjalan',
        null || '' => 'tidak dicatat',
        _ => activity.toString(),
      };

  Future<void> _showScenarioLogDetails(
    BuildContext context,
    Map<String, dynamic> log,
  ) async {
    final loggedAt = DateTime.tryParse(
      (log['createdAt'] ?? log['created_at'])?.toString() ?? '',
    );
    final observedAt = DateTime.tryParse(log['observed_at']?.toString() ?? '');
    final scenario = log['scenario']?.toString();
    final details = <(String, String)>[
      if (scenario != null) ('Skenario', scenario),
      ('Aktivitas', _hilActivityLabel(log['activity'])),
      if (log['heart_rate_bpm'] != null)
        ('Denyut saat dicatat', '${log['heart_rate_bpm']} kali/menit'),
      if (observedAt != null)
        ('Waktu bacaan sensor', formatHilWibDateTime(observedAt)),
      if (log['recommendation']?.toString().isNotEmpty == true)
        ('Saran sistem', log['recommendation'].toString()),
      if (log['clarification']?.toString().isNotEmpty == true)
        ('Keterangan pengguna', log['clarification'].toString()),
      if (log['explanation']?.toString().isNotEmpty == true)
        ('Penjelasan', log['explanation'].toString()),
    ];
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(_scenarioLogEventLabel(log['event_type']?.toString())),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (loggedAt != null)
                Text('Waktu tercatat: ${formatHilWibDateTime(loggedAt)}'),
              for (final (label, value) in details) ...[
                const SizedBox(height: 8),
                Text('$label: $value'),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Tutup'),
          ),
        ],
      ),
    );
  }

  Widget _scenarioActionHistoryCard(
    List<Map<String, dynamic>> logs,
    List<EventItem> events, {
    String? loadError,
  }) {
    final history = [
      ...logs,
      ...events
          .where((event) =>
              event.eventType == 'hil_scenario' &&
              event.unit == 'hil_live_monitor')
          .map((event) {
        final activity = switch (event.details) {
          final details when details.contains('"ctx":"sitting"') => 'sitting',
          final details when details.contains('"ctx":"standing"') => 'standing',
          final details when details.contains('"ctx":"walking"') => 'walking',
          _ => null,
        };
        return <String, dynamic>{
          '_id': event.id,
          'scenario': 'C',
          'event_type': event.value?.toString(),
          'activity': activity,
          'createdAt': event.timestamp.toUtc().toIso8601String(),
          'explanation': event.details.split(' {').first.trim(),
        };
      }),
    ]..sort((left, right) {
        final leftAt = DateTime.tryParse(
          (left['createdAt'] ?? left['created_at'])?.toString() ?? '',
        );
        final rightAt = DateTime.tryParse(
          (right['createdAt'] ?? right['created_at'])?.toString() ?? '',
        );
        if (leftAt == null) return rightAt == null ? 0 : -1;
        if (rightAt == null) return 1;
        return rightAt.compareTo(leftAt);
      });
    final recentHistory = history.take(12).toList();
    return Container(
      key: const Key('hil-scenario-action-history'),
      width: double.infinity,
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Waktu aktivitas, rekaman, dan klarifikasi',
            style: AppTheme.font(size: 12, weight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            'Catatan ini tersimpan untuk melihat kapan rekaman dimulai, perubahan terdeteksi, serta kapan sistem meminta dan menerima keterangan.',
            style: AppTheme.font(
              size: 10.5,
              color: AppTheme.textSecondary,
              height: 1.4,
            ),
          ),
          if (loadError != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Riwayat belum dapat dimuat: $loadError',
                key: const Key('hil-scenario-action-history-error'),
                style: AppTheme.font(size: 10.5, color: AppTheme.statusRed),
              ),
            )
          else if (recentHistory.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Belum ada aktivitas skenario B/C yang tersimpan.',
                key: const Key('hil-scenario-action-history-empty'),
                style: AppTheme.font(size: 10.5, color: AppTheme.textMuted),
              ),
            )
          else
            ...recentHistory.map((log) {
              final loggedAt = DateTime.tryParse(
                (log['createdAt'] ?? log['created_at'])?.toString() ?? '',
              );
              final scenario = log['scenario']?.toString();
              final timestamp = loggedAt == null
                  ? 'Waktu tidak tersedia'
                  : formatHilWibDateTime(loggedAt);
              final heading = [
                if (scenario != null) 'Skenario $scenario',
                _scenarioLogEventLabel(log['event_type']?.toString()),
              ].join(' · ');
              final summary = [
                log['clarification'],
                log['recommendation'],
                log['explanation'],
              ].whereType<String>().firstWhere(
                    (value) => value.trim().isNotEmpty,
                    orElse: () => '',
                  );
              return ListTile(
                key: Key('hil-scenario-action-${log['_id'] ?? log['run_id']}'
                    '-${log['event_type']}'),
                contentPadding: EdgeInsets.zero,
                title: Text(
                  heading,
                  style: AppTheme.font(size: 10.5, weight: FontWeight.w700),
                ),
                subtitle: Text(
                  '$timestamp · Aktivitas ${_hilActivityLabel(log['activity'])}'
                  '${summary.isEmpty ? '' : ' · $summary'}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => _showScenarioLogDetails(context, log),
              );
            }),
        ],
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
    await appState.fetchHilBaselines();
    if (!mounted) return;
    if (appState.hilBaselineError != null &&
        appState.hilBaselineContexts.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(appState.hilBaselineError!),
        ),
      );
      return;
    }
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => GuidedBaselineSessionScreen(
          includeRecoveryStage: false,
          showHciReview: false,
          isHilBaselineRecording: true,
          baselineContextsAtStart: appState.hilBaselineContexts,
        ),
      ),
    );
    if (!mounted) return;
    await context.read<AppState>().fetchHilBaselines();
  }

  Future<void> _grantAiProcessingConsent() async {
    var confirmed = false;
    final granted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Persetujuan pemrosesan data kesehatan'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Untuk membentuk baseline Human in the Loop tersendiri, Vidyamedic memproses data wearable dan fitur kesehatan Anda. Baseline ini disimpan terpisah dan tidak mengubah baseline CAPAR. Persetujuan ini terpisah dari persetujuan penelitian HIL.',
              ),
              const SizedBox(height: 8),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: confirmed,
                controlAffinity: ListTileControlAffinity.leading,
                title: const Text(
                  'Saya menyetujui pemrosesan data kesehatan dengan AI.',
                ),
                onChanged: (value) =>
                    setDialogState(() => confirmed = value == true),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Batal'),
            ),
            FilledButton(
              onPressed:
                  confirmed ? () => Navigator.pop(dialogContext, true) : null,
              child: const Text('Setuju dan muat baseline'),
            ),
          ],
        ),
      ),
    );
    if (granted != true || !mounted) return;

    setState(() => _isUpdatingAiConsent = true);
    final response = await ApiService.updateProfile({
      'ai_processing_consent': {'granted': true},
    });
    if (!mounted) return;
    if (!response.success) {
      setState(() => _isUpdatingAiConsent = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            response.message ?? 'Persetujuan pemrosesan AI gagal disimpan.',
          ),
        ),
      );
      return;
    }

    await Future.wait([
      context.read<AppState>().fetchCaparInsights(),
      context.read<AppState>().fetchHilBaselines(),
    ]);
    if (!mounted) return;
    setState(() => _isUpdatingAiConsent = false);
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
        'unresolved' => 'Belum dapat disimpulkan · bukti belum cukup',
        'not_required' => 'Klarifikasi tidak diperlukan saat ini',
        'requested' => 'Klarifikasi diperlukan',
        'already_answered' => 'Klarifikasi sudah tercatat',
        'within_personal_region' => 'Dalam kisaran pribadi',
        'moderately_displaced' => 'Agak berbeda dari kisaran pribadi',
        'strongly_displaced' => 'Jauh berbeda dari kisaran pribadi',
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

  bool _matchesBaselineActivity(
    Map<String, dynamic> baseline,
    String activity,
  ) {
    final normalized = _normalizeActivity(baseline['activity']?.toString());
    if (activity == 'sitting' || activity == 'standing') {
      return normalized == activity || normalized == 'rest';
    }
    return activity == 'walking'
        ? normalized == 'walking' || normalized == 'light'
        : normalized == activity;
  }

  bool _isScenarioBaselineReady(Map<String, dynamic> baseline) {
    final readiness = _map(baseline['scenario_readiness']);
    return readiness['ready'] == true;
  }

  int _validScenarioWindowCount(Map<String, dynamic> baseline) {
    final count = _map(baseline['scenario_readiness'])['valid_window_count'];
    return count is num ? count.toInt() : 0;
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
      return 'Data sensor, mutu bacaan, atau catatan pembanding untuk aktivitas dan waktu yang sesuai belum cukup. Sistem belum dapat menyimpulkan perubahan.';
    }
    final activity = observation['activity']?.toString();
    final detail = positiveZScores.isEmpty
        ? 'belum terlihat ukuran yang lebih tinggi dari pola pribadi'
        : positiveZScores.map((feature) {
            final metric = switch (feature['feature']?.toString()) {
              'mean_hr' => 'denyut rata-rata',
              'mean_rr' => 'jarak antardetak',
              'rmssd' => 'perubahan jarak antardetak',
              _ => feature['label']?.toString() ?? 'ukuran tubuh',
            };
            final distance = (feature['z_score'] as num).abs();
            return '$metric sekitar ${distance.toStringAsFixed(1)} kali variasi yang biasa terlihat lebih tinggi';
          }).join(', ');
    return 'Untuk ${activity ?? 'aktivitas'}${observation['time_period'] == null ? '' : ' · ${observation['time_period']}'}, '
        '$detail. Hasil dibandingkan dengan catatan pribadi untuk aktivitas serupa. Ini hanya pengamatan dan bukan diagnosis atau penjelasan penyebab.';
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
    final caparStatus = capar['status']?.toString();
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
    final baselineContexts = state.hilBaselineContexts;
    final observationActivity = _normalizeActivity(
      latestObservation['activity']?.toString(),
    );
    final scenarioWindowCounts = _baselineActivities.map((activity) {
      final matchingBaselines = baselineContexts.where(
        (baseline) => _matchesBaselineActivity(baseline, activity.$2),
      );
      return matchingBaselines.fold<int>(
        0,
        (best, baseline) => best > _validScenarioWindowCount(baseline)
            ? best
            : _validScenarioWindowCount(baseline),
      );
    }).toList();
    final readyScenarioActivityCount = _baselineActivities.where((activity) {
      return baselineContexts.any(
        (baseline) =>
            _matchesBaselineActivity(baseline, activity.$2) &&
            _isScenarioBaselineReady(baseline),
      );
    }).length;
    final scenariosReady =
        readyScenarioActivityCount == _baselineActivities.length;
    final minimumScenarioWindowCount = scenarioWindowCounts.reduce(
      (minimum, count) => minimum < count ? minimum : count,
    );
    final aiConsentRequired = caparStatus == 'consent_required';
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
      trailing: IconButton(
        key: const Key('hil-refresh-baseline'),
        tooltip: 'Muat ulang baseline',
        onPressed: state.isCaparLoading || state.isHilBaselineLoading
            ? null
            : () => unawaited(Future.wait([
                  state.fetchCaparInsights(),
                  state.fetchHilBaselines(),
                ])),
        icon: state.isCaparLoading || state.isHilBaselineLoading
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.refresh_rounded),
      ),
      subtitle: Text(
        'Pola denyut pribadi, perubahan yang terlihat, dan klarifikasi',
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
                'Bentuk profil aktivitas satu per satu. Lima menit data berkualitas per aktivitas cukup untuk mulai uji HIL; kematangan CAPAR tetap dinilai terpisah.',
            selected: _selectedScenario == 'A',
            enabled: _hasResearchConsent,
            onPressed: () => setState(() => _selectedScenario = 'A'),
          ),
          _scenarioButton(
            code: 'B',
            title: 'Saran dari sistem',
            detail:
                'Tampilkan narasi satu arah. Skenario dapat dibuka setelah tersedia 5 menit baseline HIL berkualitas untuk duduk, berdiri, dan berjalan.',
            selected: _selectedScenario == 'B',
            enabled: scenariosReady && _hasResearchConsent,
            onPressed: () => _selectScenario('B'),
          ),
          _scenarioButton(
            code: 'C',
            title: 'Human in the loop',
            detail:
                'Tampilkan hasil, tanyakan konteks yang mungkin terlewat, dan jelaskan bila data belum cukup untuk menyimpulkan. Memerlukan 5 menit catatan pribadi untuk setiap aktivitas.',
            selected: _selectedScenario == 'C',
            enabled: scenariosReady && _hasResearchConsent,
            onPressed: () => _selectScenario('C'),
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
                'Skenario B/C memerlukan 5 menit bacaan layak untuk duduk, berdiri, dan berjalan. Saat ini $readyScenarioActivityCount/3 aktivitas siap; aktivitas dengan progres terendah memiliki $minimumScenarioWindowCount/5 menit. Catatan ini disimpan terpisah dari profil CAPAR. Muat ulang setelah data diproses.',
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
            isLoading: state.isHilBaselineLoading,
            aiConsentRequired: aiConsentRequired,
            isUpdatingAiConsent: _isUpdatingAiConsent,
            onGrantAiConsent: _grantAiProcessingConsent,
            loadError: state.hilBaselineError,
          ),
          _scenarioHistoryCard([
            ...state.hilExplanationHistory,
            ...state.events.where((event) => event.eventType == 'hil_scenario'),
          ]),
          _scenarioActionHistoryCard(
            state.hilScenarioLogs,
            state.events,
            loadError: state.hilScenarioLogsError,
          ),
          if (_selectedScenario == 'B') ...[
            const SizedBox(height: 10),
            _scenarioResultCard(
              title: 'Saran dari sistem · hasil',
              detail: _scenarioNarrative(latestObservation, positiveZScores),
              key: const Key('hil-one-way-result'),
            ),
          ],
          if (followUpStatus == 'requested' ||
              resolution['feedback_recorded'] == true) ...[
            const SizedBox(height: 10),
            _humanInTheLoopCard(
              observation: latestObservation,
              segmentId: segmentId,
              hasSegment: hasSegment,
              resolutionStatus: resolutionStatus,
              resolution: resolution,
            ),
          ],
          if (_selectedScenario == 'C') ...[
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                key: const Key('hil-open-live-monitor'),
                onPressed: _hasResearchConsent
                    ? () => _openLiveMonitor(
                          baselineContexts,
                          observationActivity,
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
            title: 'Deteksi perubahan dari pola pribadi',
            detail: _scenarioNarrative(latestObservation, positiveZScores),
          ),
          _stepCard(
            number: '02',
            title: 'Periksa kualitas dan baseline',
            detail:
                'Pemeriksaan mutu bacaan: ${qualityPassed ? 'lolos' : quality['status'] == 'insufficient_data' ? 'data belum cukup' : 'belum lolos/tersedia'}'
                ' (sinyal dan kelengkapan data)'
                ' · catatan pembanding pribadi: ${scenariosReady ? 'tersedia' : 'belum memenuhi 5 menit per aktivitas'}'
                ' · aktivitas dengan catatan paling sedikit: $minimumScenarioWindowCount/5 menit',
          ),
          _stepCard(
            number: '03',
            title: 'Tinjau bukti dan batas interpretasi',
            detail: factors.isEmpty
                ? (interpretation ??
                    'Bukti yang tersedia ditampilkan apa adanya. Satu perubahan tidak cukup untuk menyimpulkan penyebab atau diagnosis.')
                : '${factors.map((factor) => factor['physiology'] ?? factor['feature'] ?? 'sinyal').join(', ')}. '
                    'Perbandingan bergantung pada mutu sinyal dan kecocokan baseline aktivitas HIL.',
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
                ? 'Tunggu bacaan berikutnya dengan mutu baik pada aktivitas dan waktu yang sebanding.'
                : resolution['next_step']?.toString() ==
                        'observe_next_quality_gated_window'
                    ? 'Bukti belum cukup atau masih berbeda; belum dapat disimpulkan sampai ada bacaan yang lebih baik.'
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
            'Klarifikasi pengguna adalah konteks yang dilaporkan, bukan bukti penyebab. Hasil tetap belum dapat disimpulkan jika data tidak cukup atau saling berbeda; halaman ini bukan alat diagnosis.',
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
    required bool isLoading,
    required bool aiConsentRequired,
    required bool isUpdatingAiConsent,
    required VoidCallback onGrantAiConsent,
    String? loadError,
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
            'Rekam catatan pembanding secara berurutan: duduk, berdiri, lalu berjalan. Setiap langkah membutuhkan 5 menit bacaan bermutu baik. Data HIL disimpan terpisah dari profil CAPAR.',
            style: AppTheme.font(
              size: 10.5,
              color: AppTheme.textSecondary,
              height: 1.4,
            ),
          ),
          if (aiConsentRequired) ...[
            const SizedBox(height: 8),
            Container(
              key: const Key('hil-ai-consent-required'),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.statusYellowBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Baseline HIL belum dapat ditampilkan karena persetujuan pemrosesan AI belum diberikan. Baseline ini terpisah dari CAPAR.',
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    key: const Key('hil-grant-ai-consent'),
                    onPressed: isUpdatingAiConsent ? null : onGrantAiConsent,
                    child: Text(
                      isUpdatingAiConsent
                          ? 'Menyimpan persetujuan...'
                          : 'Tinjau persetujuan dan muat baseline HIL',
                    ),
                  ),
                ],
              ),
            ),
          ] else if (isLoading && contexts.isEmpty) ...[
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(child: CircularProgressIndicator()),
            ),
          ] else if (loadError != null && contexts.isEmpty) ...[
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'Baseline gagal dimuat: $loadError',
                key: const Key('hil-baseline-load-error'),
                style: AppTheme.font(size: 10.5, color: AppTheme.statusOrange),
              ),
            ),
          ],
          const SizedBox(height: 9),
          ...List.generate(_baselineActivities.length, (index) {
            final activity = _baselineActivities[index];
            final contextsForActivity = contexts
                .where(
                    (context) => _matchesBaselineActivity(context, activity.$2))
                .toList();
            final readyContexts =
                contextsForActivity.where(_isScenarioBaselineReady).toList();
            final isReady = readyContexts.isNotEmpty;
            final count = contextsForActivity.fold<int>(
              0,
              (total, context) =>
                  total + ((context['segment_count'] as num?)?.toInt() ?? 0),
            );
            final validMinutes = readyContexts.fold<int>(
              0,
              (best, context) {
                final windows = _validScenarioWindowCount(context);
                return best > windows ? best : windows;
              },
            );
            final bestWindowCount = contextsForActivity.fold<int>(
              0,
              (best, context) {
                final windows = _validScenarioWindowCount(context);
                return best > windows ? best : windows;
              },
            );
            return Container(
              key: Key('hil-baseline-step-${index + 1}'),
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 8),
              decoration: BoxDecoration(
                color: isReady
                    ? AppTheme.statusGreen.withValues(alpha: 0.08)
                    : Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isReady ? AppTheme.statusGreen : AppTheme.borderLight,
                ),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 13,
                    backgroundColor:
                        isReady ? AppTheme.statusGreen : AppTheme.primarySoft,
                    foregroundColor:
                        isReady ? Colors.white : AppTheme.primaryDark,
                    child: isReady
                        ? const Icon(Icons.check_rounded, size: 16)
                        : Text(
                            '${index + 1}',
                            style: AppTheme.font(
                                size: 10, weight: FontWeight.w800),
                          ),
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    flex: 2,
                    child: Text(
                      activity.$1,
                      style: AppTheme.font(size: 10.5, weight: FontWeight.w700),
                    ),
                  ),
                  Flexible(
                    flex: 3,
                    child: Text(
                      aiConsentRequired
                          ? 'Menunggu persetujuan AI'
                          : contextsForActivity.isEmpty
                              ? 'Belum ada data'
                              : isReady
                                  ? 'Siap HIL · $validMinutes menit · $count window'
                                  : 'Belum siap HIL · $bestWindowCount/5 menit · $count window',
                      textAlign: TextAlign.end,
                      style: AppTheme.font(
                        size: 9.5,
                        weight: FontWeight.w600,
                        color: isReady
                            ? AppTheme.statusGreen
                            : AppTheme.textSecondary,
                      ),
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
    required String? segmentId,
    required bool hasSegment,
    required String resolutionStatus,
    required Map<String, dynamic> resolution,
  }) =>
      Builder(builder: (context) {
        final reportedContext = _map(resolution['reported_context']);
        final remainingUnknowns = resolution['remaining_unknowns'] is List
            ? (resolution['remaining_unknowns'] as List)
                .whereType<String>()
                .map(_unknownContextLabel)
                .toSet()
            : <String>{};
        return Container(
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
              Text('Bantu lengkapi konteks pengukuran Anda',
                  style: AppTheme.font(size: 12, weight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text(
                'Denyut jantung Anda saat ${_hilActivityLabel(observation['activity'])} berbeda dari baseline personal. Penyebabnya belum dapat dipastikan. Apakah ada aktivitas atau kondisi sebelum pengukuran yang belum tercatat?',
                style: AppTheme.font(
                  size: 10.5,
                  color: AppTheme.textSecondary,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Periksa informasi berikut, lalu koreksi atau tambahkan konteks bila diperlukan.',
                style: AppTheme.font(
                  size: 10.5,
                  color: AppTheme.textSecondary,
                  height: 1.4,
                ),
              ),
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
                  key: const Key('hil-open-deviation-clarification'),
                  onPressed: !hasSegment
                      ? null
                      : () => _openDeviationClarification(
                            segmentId: segmentId,
                            activity:
                                _hilActivityLabel(observation['activity']),
                            reportedContext: reportedContext,
                          ),
                  icon: const Icon(Icons.question_answer_outlined),
                  label: Text(reportedContext.isEmpty
                      ? 'Lengkapi konteks pengukuran'
                      : 'Koreksi atau tambahkan konteks'),
                ),
              ),
              if (resolution['feedback_recorded'] == true &&
                  reportedContext.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  'Konteks yang ditambahkan',
                  style: AppTheme.font(size: 10.5, weight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  'Aktivitas sebelumnya: ${reportedContext['activity_before_event'] == 'unknown' ? 'Tidak diingat' : reportedContext['activity_before_event'] ?? 'Belum diketahui'}'
                  '${reportedContext['activity_end_time']?.toString().isNotEmpty == true ? '\nAktivitas berakhir: ${reportedContext['activity_end_time']}' : ''}'
                  '${reportedContext['measurement_condition'] != null ? '\nKondisi perangkat: ${_measurementConditionLabel(reportedContext['measurement_condition'])}' : ''}'
                  '${reportedContext['note']?.toString().isNotEmpty == true ? '\nKonteks tambahan: ${reportedContext['note']}' : ''}',
                  key: const Key('hil-reported-context'),
                  style: AppTheme.font(
                    size: 10,
                    color: AppTheme.textSecondary,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  resolution['reinterpreted'] == true
                      ? 'Interpretasi diperbarui dengan konteks ini, tetapi hal tersebut tidak membuktikan penyebab deviasi.'
                      : 'Interpretasi belum berubah karena konteks atau bukti yang tersedia belum cukup.',
                  key: const Key('hil-interpretation-change'),
                  style: AppTheme.font(
                    size: 10,
                    color: AppTheme.textSecondary,
                    height: 1.4,
                  ),
                ),
                Text(
                  'Yang masih belum diketahui: ${remainingUnknowns.isEmpty ? 'penyebab deviasi' : remainingUnknowns.join(', ')}. Penyebabnya belum dapat dipastikan.',
                  key: const Key('hil-remaining-unknowns'),
                  style: AppTheme.font(
                    size: 10,
                    color: AppTheme.textSecondary,
                    height: 1.4,
                  ),
                ),
              ],
              if (resolutionStatus == 'unresolved' &&
                  resolution['feedback_recorded'] != true)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'Status ${_statusLabel(resolutionStatus)}. Penyebab deviasi belum dapat dipastikan.',
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
      });

  String _unknownContextLabel(String value) => switch (value) {
        'reported_activity' => 'aktivitas yang dilaporkan',
        'cause_of_deviation' => 'penyebab deviasi',
        'causal_relationship' => 'hubungan sebab-akibat',
        'patient_context_not_recorded' => 'konteks pengguna belum tercatat',
        'no_relevant_new_context' => 'konteks baru yang relevan',
        'sensor_quality_gate_not_passed' => 'mutu sinyal yang memadai',
        'matching_baseline_not_mature' => 'baseline pembanding yang matang',
        'physiological_evidence_insufficient' => 'bukti fisiologis yang cukup',
        'measurement_condition_requires_review' =>
          'kondisi perangkat perlu ditinjau',
        'measurement_condition_not_recorded' =>
          'kondisi perangkat saat pengukuran',
        'evidence_conflict_remains' => 'perbedaan bukti yang masih ada',
        _ => value.replaceAll('_', ' '),
      };

  String _measurementConditionLabel(dynamic value) => switch (value) {
        'worn_as_usual' => 'dipakai seperti biasa',
        'adjusted_during_event' => 'disesuaikan saat itu',
        'loose_or_moving' => 'longgar atau banyak bergerak',
        'not_worn' => 'tidak dipakai',
        'unknown' => 'tidak yakin',
        _ => 'belum diketahui',
      };

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
