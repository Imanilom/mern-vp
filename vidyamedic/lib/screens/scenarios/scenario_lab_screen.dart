import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../actions/action_tracking_screen.dart';
import '../impact/impact_dashboard_screen.dart';
import '../input/guided_daily_flow_screen.dart';
import '../profile/wearable_pairing_screen.dart';
import '../summary/daily_summary_screen.dart';
import '../../services/api_service.dart';
import 'scenario_questionnaire_screen.dart';
import 'guided_baseline_session_screen.dart';

class ScenarioLabScreen extends StatefulWidget {
  const ScenarioLabScreen({super.key, this.initialScenarioId});

  final String? initialScenarioId;

  @override
  State<ScenarioLabScreen> createState() => _ScenarioLabScreenState();
}

class _ScenarioLabScreenState extends State<ScenarioLabScreen> {
  static const _activityOptions = <String, String>{
    'unsure': 'Tidak yakin',
    'rest': 'Istirahat',
    'sitting': 'Duduk',
    'standing': 'Berdiri',
    'walking': 'Berjalan',
    'running': 'Berlari',
    'exercise': 'Olahraga',
    'work': 'Bekerja',
    'other': 'Aktivitas lain',
  };

  List<Map<String, dynamic>> _scenarios = [];
  List<Map<String, dynamic>> _sessions = [];
  List<Map<String, dynamic>> _events = [];
  List<Map<String, dynamic>> _questionnaires = [];
  List<Map<String, dynamic>> _caparBaselines = [];
  Map<String, dynamic>? _selectedSession;
  String _activity = 'unsure';
  String _initialActivity = 'unsure';
  String _confidence = 'unsure';
  String _initialConfidence = 'unsure';
  late String _activeScenarioId;
  bool _loading = true;
  bool _busy = false;
  bool _initialRouteHandled = false;
  bool _requiresRealRecording = false;
  bool _caparLoading = true;
  String? _error;
  String? _caparError;
  String _caparStatus = 'insufficient_data';

  @override
  void initState() {
    super.initState();
    _activeScenarioId = widget.initialScenarioId ?? 'a';
    _load();
  }

  Map<String, dynamic> _map(dynamic value) =>
      value is Map<String, dynamic> ? value : <String, dynamic>{};

  List<Map<String, dynamic>> _maps(dynamic value) => value is List
      ? value.map(_map).where((item) => item.isNotEmpty).toList()
      : <Map<String, dynamic>>[];

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final results = await Future.wait([
      ApiService.getPatientScenarios(),
      ApiService.getPatientScenarioSessions(),
    ]);
    if (!mounted) return;
    final scenarios = results[0];
    final sessions = results[1];
    if (!scenarios.success || !sessions.success) {
      setState(() {
        _loading = false;
        _error =
            scenarios.message ?? sessions.message ?? 'Gagal memuat skenario.';
      });
      return;
    }
    final history = _maps(sessions.data);
    setState(() {
      _scenarios = _maps(scenarios.data);
      _sessions = history;
      _loading = false;
    });
    unawaited(_loadCaparBaselines());
    final currentModeSessions = history
        .where((session) => session['scenario_id'] == _activeScenarioId)
        .toList();
    if (_selectedSession == null && currentModeSessions.isNotEmpty) {
      await _openSession(currentModeSessions.first);
    }
    final initialScenarioId = widget.initialScenarioId;
    if (!_initialRouteHandled && initialScenarioId != null) {
      _initialRouteHandled = true;
      await _startScenario(initialScenarioId);
    }
  }

  Future<void> _loadCaparBaselines() async {
    setState(() => _caparLoading = true);
    final response = await ApiService.getCaparInsights();
    if (!mounted) return;
    final payload = _map(response.data?['capar']);
    final baseline = _map(payload['baseline']);
    final contexts = baseline['contexts'];
    final error = !response.success || response.data == null
        ? response.message ?? 'Data baseline CAPAR gagal dimuat.'
        : contexts is! List
            ? 'Data baseline CAPAR belum tersedia dalam format yang dikenali.'
            : null;
    setState(() {
      if (contexts is List) {
        _caparBaselines = _maps(contexts);
        _caparStatus = payload['status']?.toString() ?? 'insufficient_data';
      }
      _caparError = error;
      _caparLoading = false;
    });
  }

  Future<void> _openSession(Map<String, dynamic> item) async {
    final id = item['_id']?.toString();
    if (id == null || id.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
      _requiresRealRecording = false;
    });
    final results = await Future.wait([
      ApiService.getPatientScenarioSession(id),
      ApiService.getPatientScenarioEvents(id),
      ApiService.getPatientScenarioQuestionnaires(id),
    ]);
    if (!mounted) return;
    final session = results[0] as ApiResponse<Map<String, dynamic>>;
    final events = results[1] as ApiResponse<List<dynamic>>;
    final questionnaires = results[2] as ApiResponse<List<dynamic>>;
    if (!session.success || !events.success || !questionnaires.success) {
      setState(() {
        _busy = false;
        _error = session.message ??
            events.message ??
            questionnaires.message ??
            'Gagal memuat sesi.';
      });
      return;
    }
    final eventItems = _maps(events.data);
    final corrections = eventItems
        .where((event) => event['event_type'] == 'activity_correction')
        .toList();
    final interpretation = _currentInterpretation(session.data!);
    final contextActivity =
        _map(interpretation?['context'])['activity']?.toString();
    final latestCorrection =
        corrections.isEmpty ? null : corrections.last;
    final selectedActivity = _scenarioActivityValue(
      latestCorrection?['value'] ?? contextActivity,
    );
    final selectedConfidence =
        latestCorrection?['confidence']?.toString() ?? 'unsure';
    setState(() {
      _selectedSession = session.data;
      _events = eventItems;
      _questionnaires = _maps(questionnaires.data);
      _busy = false;
      _activity = selectedActivity;
      _initialActivity = selectedActivity;
      _confidence = selectedConfidence;
      _initialConfidence = selectedConfidence;
    });
  }

  String _scenarioActivityValue(dynamic value) {
    final normalized = value?.toString().trim().toLowerCase() ?? '';
    if (_activityOptions.containsKey(normalized)) return normalized;
    return switch (normalized) {
      'rest' || 'duduk' => 'sitting',
      'light' || 'berjalan' || 'walk' => 'walking',
      'moderate' || 'aktivitas sedang' => 'exercise',
      'intense' || 'berlari' => 'running',
      'berdiri' => 'standing',
      _ => 'unsure',
    };
  }

  Future<void> _startScenario(String scenarioId) async {
    final consent = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Persetujuan sesi penelitian'),
        content: const SingleChildScrollView(
          child: Text(
            'Sesi ini memakai rekaman Polar H10 nyata yang sudah tersimpan dan dianalisis CAPAR; aplikasi tidak membuat data sensor contoh. Pilihan skenario dan feedback Anda dicatat untuk evaluasi interaksi. Interpretasi bersifat eksperimental, bukan diagnosis, dan tidak menggantikan layanan klinis. Anda dapat berhenti kapan saja; sesi yang sudah tercatat tetap tersedia di riwayat akun.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Setuju dan mulai'),
          ),
        ],
      ),
    );
    if (consent != true || !mounted) return;
    setState(() {
      _busy = true;
      _error = null;
      _requiresRealRecording = false;
    });
    final result = await ApiService.startPatientScenario(
      scenarioId: scenarioId,
    );
    if (!mounted) return;
    if (!result.success || result.data == null) {
      setState(() {
        _busy = false;
        _error = result.message ?? 'Sesi tidak dapat dimulai.';
        _requiresRealRecording = result.statusCode == 409;
      });
      if (result.statusCode == 409 && mounted) {
        await _showBaselineGuidance(message: result.message);
      }
      return;
    }
    final interpretation = _currentInterpretation(result.data!);
    final baseline = _map(interpretation?['baseline']);
    final baselineNeedsMoreData = baseline['status'] != 'ELIGIBLE' ||
        baseline['production_is_mature'] != true;
    setState(() {
      _selectedSession = result.data;
      _events = [];
      _questionnaires = [];
      _busy = false;
      _requiresRealRecording = false;
    });
    await _loadHistory();
    if (baselineNeedsMoreData && mounted) {
      await _showBaselineGuidance(
        activity: _activityLabel(baseline['activity']?.toString()),
        timePeriod: baseline['time_period']?.toString(),
      );
    }
  }

  String _activityLabel(String? activity) => switch (activity) {
        'rest' || 'Rest' => 'Istirahat',
        'Light' => 'Berjalan',
        'Moderate' => 'Aktivitas sedang',
        'Intense' => 'Aktivitas intens',
        'sitting' || 'Duduk' => 'Duduk',
        'standing' || 'Berdiri' => 'Berdiri',
        'sleep' || 'Tidur' => 'Tidur',
        'walking' || 'Berjalan' => 'Berjalan',
        'running' || 'Berlari' => 'Berlari',
        'exercise' || 'Olahraga' => 'Olahraga',
        null || '' => 'Aktivitas belum diketahui',
        _ => activity,
      };

  String _timePeriodLabel(String? timePeriod) => switch (timePeriod) {
        'night' => 'malam dini hari (00.00-06.00)',
        'morning' => 'pagi (06.00-12.00)',
        'afternoon' => 'siang/sore (12.00-18.00)',
        'evening' => 'malam (18.00-24.00)',
        null || '' => 'waktu belum diketahui',
        _ => timePeriod,
      };

  Future<void> _showBaselineGuidance({
    String? message,
    String? activity,
    String? timePeriod,
  }) async {
    final requestedContext = [
      if (activity != null && activity.isNotEmpty) activity,
      if (timePeriod != null && timePeriod.isNotEmpty)
        _timePeriodLabel(timePeriod),
    ].join(' · ');
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Lengkapi data baseline CAPAR'),
        content: SizedBox(
          width: 480,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_caparError != null) ...[
                  Text(
                    'Pembaruan data CAPAR gagal: $_caparError',
                    style: const TextStyle(color: Color(0xFF9F2D20)),
                  ),
                  const SizedBox(height: 8),
                ],
                if (message != null && message.isNotEmpty) ...[
                  Text(message),
                  const SizedBox(height: 12),
                ],
                if (requestedContext.isNotEmpty)
                  Text('Konteks sesi ini: $requestedContext.'),
                const Text(
                  'Data CAPAR yang sudah tersimpan tetap digunakan dan ditampilkan, tetapi perbandingan personal dapat belum tersedia sampai baseline pada konteks yang sama cukup matang.',
                ),
                const SizedBox(height: 12),
                const Text(
                  'Agar baseline terbentuk, hubungkan Polar H10 lalu rekam secara rutin saat melakukan aktivitas yang benar. Pilih konteks aktivitas yang sesuai (misalnya Duduk, Berjalan, atau Tidur) dan usahakan rekaman terjadi pada periode waktu yang sama. Periode CAPAR mengikuti waktu WIB: 00.00-06.00 malam dini hari, 06.00-12.00 pagi, 12.00-18.00 siang/sore, dan 18.00-24.00 malam.',
                ),
                const SizedBox(height: 10),
                const Text(
                  'Usahakan sinyal dan kontak sensor baik, rekam pada beberapa hari, dan kumpulkan window yang stabil. CAPAR menilai jumlah window efektif, sebaran hari, kualitas sinyal, dan kestabilan; banyaknya segmen saja tidak menjamin baseline matang. Setelah merekam, tunggu analisis CAPAR selesai lalu buka halaman ini lagi.',
                ),
                const SizedBox(height: 14),
                _baselineContextList(compact: true),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Nanti'),
          ),
          FilledButton.icon(
            onPressed: () {
              Navigator.pop(dialogContext);
              _openRecordingPage();
            },
            icon: const Icon(Icons.sensors_rounded),
            label: const Text('Buka perekaman'),
          ),
        ],
      ),
    );
  }

  Future<void> _loadHistory() async {
    final response = await ApiService.getPatientScenarioSessions();
    if (!mounted) return;
    if (response.success) {
      setState(() => _sessions = _maps(response.data));
    } else {
      setState(() => _error = response.message ?? 'Gagal memperbarui riwayat.');
    }
  }

  Future<void> _selectScenario(String scenarioId) async {
    if (scenarioId == _activeScenarioId) return;
    setState(() {
      _activeScenarioId = scenarioId;
      _selectedSession = null;
      _events = [];
      _questionnaires = [];
      _requiresRealRecording = false;
      _error = null;
    });
    final matching = _sessions
        .where((session) => session['scenario_id'] == scenarioId)
        .toList();
    if (matching.isNotEmpty) await _openSession(matching.first);
  }

  Future<void> _openAppPage(Widget page) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => page),
    );
    if (mounted) await _load();
  }

  Future<void> _openRecordingPage() async {
    await _openAppPage(const GuidedBaselineSessionScreen());
  }

  Future<void> _openQuestionnaire(ScenarioQuestionnaireType type) async {
    final sessionId = _selectedSession?['_id']?.toString();
    if (sessionId == null || sessionId.isEmpty) return;
    final submitted = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ScenarioQuestionnaireScreen(
          sessionId: sessionId,
          type: type,
        ),
      ),
    );
    if (submitted != true || !mounted) return;
    final response =
        await ApiService.getPatientScenarioQuestionnaires(sessionId);
    if (!mounted) return;
    if (!response.success) {
      setState(() => _error =
          response.message ?? 'Kuesioner tersimpan tetapi belum dapat dimuat.');
      return;
    }
    setState(() {
      _questionnaires = _maps(response.data);
      _error = null;
    });
  }

  Future<void> _submitFeedback() async {
    final session = _selectedSession;
    final sessionId = session?['_id']?.toString();
    if (sessionId == null || sessionId.isEmpty) return;
    final interpretation = _currentInterpretation(session!);
    final observedAt = DateTime.tryParse(
      _map(interpretation?['observation'])['observed_at']?.toString() ??
          interpretation?['observed_at']?.toString() ??
          '',
    );
    final eventTime = observedAt ?? DateTime.now().toUtc();
    final intervalEnd = eventTime.add(const Duration(minutes: 1));
    final idempotencyKey =
        'vm-${DateTime.now().microsecondsSinceEpoch}-${(sessionId.hashCode & 0xffff).toRadixString(16)}';
    setState(() {
      _busy = true;
      _error = null;
    });
    final response = await ApiService.submitPatientScenarioEvent(
      sessionId: sessionId,
      payload: {
        'idempotency_key': idempotencyKey,
        'event_time': eventTime.toIso8601String(),
        'activity': _activity,
        'confidence': _activity == 'unsure' ? 'unsure' : _confidence,
        'affected_interval': {
          'start': eventTime.toIso8601String(),
          'end': intervalEnd.toIso8601String(),
        },
      },
    );
    if (!mounted) return;
    if (!response.success) {
      setState(() {
        _busy = false;
        _error = response.message ?? 'Feedback tidak tersimpan.';
      });
      return;
    }
    setState(() => _busy = false);
    await _openSession(session);
    await _loadHistory();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Feedback dan audit trail tersimpan.')),
    );
  }

  Map<String, dynamic>? _currentInterpretation(Map<String, dynamic> session) {
    final versions = _maps(session['interpretations']);
    final currentVersion =
        (session['current_interpretation_version'] as num?)?.toInt();
    for (final item in versions) {
      if (item['version'] == currentVersion) return item;
    }
    return versions.isEmpty ? null : versions.last;
  }

  Future<void> _completeSession() async {
    final id = _selectedSession?['_id']?.toString();
    if (id == null) return;
    setState(() => _busy = true);
    final response = await ApiService.completePatientScenario(id);
    if (!mounted) return;
    if (!response.success || response.data == null) {
      setState(() {
        _busy = false;
        _error = response.message ?? 'Sesi belum dapat diselesaikan.';
      });
      return;
    }
    setState(() {
      _selectedSession = response.data;
      _busy = false;
    });
    await _loadHistory();
  }

  Future<void> _copyExport({required bool csv}) async {
    final session = _selectedSession;
    final id = session?['_id']?.toString();
    if (session == null || id == null) return;
    final results = await Future.wait([
      ApiService.getPatientScenarioEvents(id),
      ApiService.getPatientScenarioQuestionnaires(id),
    ]);
    if (!mounted) return;
    final response = results[0];
    final questionnaireResponse = results[1];
    if (!response.success || !questionnaireResponse.success) {
      setState(() => _error = response.message ??
          questionnaireResponse.message ??
          'Audit trail untuk ekspor tidak tersedia.');
      return;
    }
    final events = _maps(response.data);
    final questionnaires = _maps(questionnaireResponse.data);
    final exportedSession = Map<String, dynamic>.from(session)
      ..remove('account_id')
      ..remove('account_type');
    final exportedEvents = events.map((event) {
      final sanitized = Map<String, dynamic>.from(event)
        ..remove('account_id')
        ..remove('account_type');
      return sanitized;
    }).toList();
    final text = csv
        ? _toCsv(exportedSession, exportedEvents, questionnaires)
        : const JsonEncoder.withIndent('  ').convert({
            'session': exportedSession,
            'events': exportedEvents,
            'questionnaires': questionnaires,
            'exported_at': DateTime.now().toUtc().toIso8601String(),
          });
    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${csv ? 'CSV' : 'JSON'} tersalin. Tempelkan ke file atau dokumen.',
        ),
      ),
    );
  }

  String _csvCell(dynamic value) {
    final text = value?.toString() ?? '';
    return '"${text.replaceAll('"', '""')}"';
  }

  String _toCsv(
    Map<String, dynamic> session,
    List<Map<String, dynamic>> events,
    List<Map<String, dynamic>> questionnaires,
  ) {
    final interpretations = _maps(session['interpretations']);
    final rows = <List<dynamic>>[
      [
        'record_type',
        'session_id',
        'scenario_id',
        'event_time',
        'version',
        'status',
        'value',
        'confidence',
        'reason_code',
        'responses',
      ],
      ...interpretations.map((item) => [
            'interpretation',
            session['_id'],
            item['scenario_id'] ?? session['scenario_id'],
            item['observed_at'],
            item['version'],
            item['status'],
            item['context'] is Map ? (item['context'] as Map)['activity'] : '',
            '',
            item['reason_code'],
            '',
          ]),
      ...events.map((event) => [
            'event',
            session['_id'],
            event['scenario_id'],
            event['event_time'],
            event['new_version'] ?? event['previous_version'],
            event['processing_state'],
            event['value'],
            event['confidence'],
            event['reason_code'],
            '',
          ]),
      ...questionnaires.map((item) => [
            'questionnaire',
            session['_id'],
            item['scenario_id'],
            item['submitted_at'],
            '',
            item['instrument'],
            item['score'],
            item['score_unit'],
            item['score_summary'],
            jsonEncode(item['responses']),
          ]),
    ];
    return rows.map((row) => row.map(_csvCell).join(',')).join('\r\n');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Skenario HCI A/B/C')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _introCard(),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    _errorCard(_error!),
                  ],
                  if (_busy) ...[
                    const SizedBox(height: 12),
                    const LinearProgressIndicator(),
                  ],
                  const SizedBox(height: 20),
                  Text('Pilih mode aplikasi',
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  ..._scenarios.map(_scenarioCard),
                  const SizedBox(height: 8),
                  _caparBaselineCard(),
                  const SizedBox(height: 8),
                  _dataWorkspaceCard(),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _busy
                          ? null
                          : () => _startScenario(_activeScenarioId),
                      icon: const Icon(Icons.play_arrow_rounded),
                      label: Text(
                        'Mulai sesi ${_activeScenarioId.toUpperCase()} dari data rekaman',
                      ),
                    ),
                  ),
                  if (_sessions.any(
                    (session) => session['scenario_id'] == _activeScenarioId,
                  )) ...[
                    const SizedBox(height: 20),
                    Text('Riwayat mode ${_activeScenarioId.toUpperCase()}',
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 8),
                    ..._sessions
                        .where((session) =>
                            session['scenario_id'] == _activeScenarioId)
                        .map(_sessionTile),
                  ],
                  if (_selectedSession != null) ...[
                    const SizedBox(height: 20),
                    _selectedSessionCard(_selectedSession!),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _introCard() => Card(
        color: const Color(0xFFEFF8F4),
        child: const Padding(
          padding: EdgeInsets.all(16),
          child: Text(
            'VidyaMedic berisi tiga mode interaksi A, B, dan C. Semua mode memakai halaman pencatatan serta data Polar H10/CAPAR yang benar-benar direkam. Tidak ada hasil sensor simulasi; sesi hanya dapat dimulai setelah rekaman tersimpan dan window CAPAR lolos quality gate. Interpretasi yang belum memiliki baseline tetap UNRESOLVED, bukan normal.',
          ),
        ),
      );

  Widget _scenarioCard(Map<String, dynamic> scenario) {
    final id = scenario['id']?.toString() ?? '';
    final selected = id == _activeScenarioId;
    return Card(
      color: selected ? const Color(0xFFEFF8F4) : null,
      shape: RoundedRectangleBorder(
        side: BorderSide(
          color: selected ? const Color(0xFF16805D) : Colors.transparent,
          width: 1.5,
        ),
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: selected ? const Color(0xFF16805D) : null,
          foregroundColor: selected ? Colors.white : null,
          child: Text(id.toUpperCase()),
        ),
        title: Text(scenario['title']?.toString() ?? 'Skenario'),
        subtitle: Text(scenario['interaction']?.toString() ?? ''),
        trailing: Icon(selected ? Icons.check_circle : Icons.chevron_right),
        onTap: _busy || id.isEmpty ? null : () => _selectScenario(id),
      ),
    );
  }

  Widget _caparBaselineCard() => Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Data CAPAR untuk VidyaMedic',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              if (_caparError != null) ...[
                const SizedBox(height: 4),
                Text(
                  'Pembaruan terakhir gagal: $_caparError',
                  style: const TextStyle(color: Color(0xFF9F2D20)),
                ),
              ],
              const SizedBox(height: 4),
              const Text(
                'Baseline CAPAR yang tersimpan dipakai bersama di aplikasi ini. Data tetap ditampilkan meskipun masih belajar atau belum cukup untuk perbandingan skenario.',
              ),
              const SizedBox(height: 10),
              _baselineContextList(),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: _busy ? null : () => _showBaselineGuidance(),
                  icon: const Icon(Icons.info_outline),
                  label: const Text('Cara melengkapi baseline'),
                ),
              ),
            ],
          ),
        ),
      );

  Widget _baselineContextList({bool compact = false}) {
    if (_caparBaselines.isEmpty) {
      final message = _caparLoading
          ? 'Memuat baseline CAPAR...'
          : _caparError ??
              (_caparStatus == 'link_required'
                  ? 'Akun CAPAR belum tertaut. Tautkan akun agar baseline yang sudah ada dapat ditampilkan.'
                  : 'Belum ada baseline CAPAR tersimpan untuk akun ini. Rekam data wearable untuk mulai membentuk baseline.');
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_caparError != null)
            Text(
              'Data CAPAR tidak dapat dimuat: $_caparError',
              style: const TextStyle(color: Color(0xFF9F2D20)),
            )
          else if (!_caparLoading)
            Text(message),
          if (_caparStatus == 'link_required')
            const Padding(
              padding: EdgeInsets.only(top: 4),
              child: Text(
                'Buka Profil untuk menautkan akun CAPAR sebelum merekam baseline lama.',
                style: TextStyle(fontSize: 12),
              ),
            ),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: _caparBaselines.map((baseline) {
        final maturity = _map(baseline['maturity_detail']);
        final level = maturity['level']?.toString() ??
            baseline['level']?.toString() ??
            'belum diketahui';
        final isMature = level == 'mature' || level == 'mature_legacy';
        final failedGates = maturity['failed_gates'] is List
            ? (maturity['failed_gates'] as List).whereType<String>().toList()
            : <String>[];
        final effectiveWindows = maturity['n_effective'];
        final distinctDays = maturity['distinct_days'];
        final quality = baseline['quality'];
        final details = <String>[
          '${baseline['segment_count'] ?? 0} segmen',
          if (effectiveWindows is num)
            '${effectiveWindows.toStringAsFixed(1)} window efektif',
          if (distinctDays is num) '$distinctDays hari memenuhi syarat',
        ];
        return Container(
          width: double.infinity,
          margin: EdgeInsets.only(bottom: compact ? 6 : 8),
          padding: EdgeInsets.all(compact ? 9 : 11),
          decoration: BoxDecoration(
            color: isMature ? const Color(0xFFEFF8F4) : const Color(0xFFFFF8E8),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color:
                  isMature ? const Color(0xFFB7DDCA) : const Color(0xFFF0D48A),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${_activityLabel(baseline['activity']?.toString())} · ${_timePeriodLabel(baseline['time_period']?.toString())}',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 3),
              Text(
                'Baseline ${isMature ? 'matang' : 'belum matang'} ($level) · ${details.join(' · ')}${quality is num ? ' · kualitas ${(quality * 100).toStringAsFixed(0)}%' : ''}',
                style: const TextStyle(fontSize: 12),
              ),
              if (failedGates.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    'Perlu ditingkatkan: ${failedGates.map(_humanizeMaturityGate).join('; ')}',
                    style: const TextStyle(fontSize: 12),
                  ),
                )
              else if (!isMature)
                const Padding(
                  padding: EdgeInsets.only(top: 4),
                  child: Text(
                    'Rincian syarat maturity belum tersedia pada data CAPAR lama.',
                    style: TextStyle(fontSize: 12),
                  ),
                ),
            ],
          ),
        );
      }).toList(),
    );
  }

  String _humanizeMaturityGate(String gate) {
    final separator = gate.indexOf('=');
    if (separator < 0) return gate;
    final key = gate.substring(0, separator);
    final label = switch (key) {
      'n_eff' => 'Window efektif',
      'hari_eligible' => 'Hari rekaman yang memenuhi syarat',
      'dominasi_hari' => 'Sebaran rekaman antarhari',
      'q_signal' => 'Kualitas sinyal',
      'q_complete' => 'Kelengkapan data',
      'q_stability' => 'Kestabilan rekaman',
      'BQ' => 'Kualitas baseline keseluruhan',
      _ => key,
    };
    return '$label: ${gate.substring(separator + 1).trim()}';
  }

  Widget _dataWorkspaceCard() => Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Halaman bersama untuk semua mode',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 4),
              const Text(
                'Mode A/B/C menggunakan perekaman dan catatan kesehatan VidyaMedic yang sama; yang berubah hanya cara feedback dan interpretasi ditampilkan.',
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  OutlinedButton.icon(
                    onPressed: _busy
                        ? null
                        : () => _openAppPage(const WearablePairingScreen()),
                    icon: const Icon(Icons.sensors_rounded),
                    label: const Text('Rekam Polar H10'),
                  ),
                  OutlinedButton.icon(
                    onPressed: _busy
                        ? null
                        : () => _openAppPage(
                              const GuidedDailyFlowScreen(),
                            ),
                    icon: const Icon(Icons.edit_note_rounded),
                    label: const Text('Catat kondisi'),
                  ),
                  OutlinedButton.icon(
                    onPressed: _busy
                        ? null
                        : () => _openAppPage(const DailySummaryScreen()),
                    icon: const Icon(Icons.assessment_outlined),
                    label: const Text('Ringkasan'),
                  ),
                  OutlinedButton.icon(
                    onPressed: _busy
                        ? null
                        : () => _openAppPage(const ImpactDashboardScreen()),
                    icon: const Icon(Icons.insights_outlined),
                    label: const Text('Dampak'),
                  ),
                  OutlinedButton.icon(
                    onPressed: _busy
                        ? null
                        : () => _openAppPage(const ActionTrackingScreen()),
                    icon: const Icon(Icons.task_alt_outlined),
                    label: const Text('Tindakan'),
                  ),
                ],
              ),
            ],
          ),
        ),
      );

  Widget _sessionTile(Map<String, dynamic> session) {
    final selected = session['_id'] == _selectedSession?['_id'];
    return Card(
      child: ListTile(
        selected: selected,
        title: Text(
            'Skenario ${session['scenario_id']?.toString().toUpperCase() ?? '-'}'),
        subtitle: Text(
          '${session['status'] ?? 'ACTIVE'} · versi ${session['current_interpretation_version'] ?? 1}',
        ),
        trailing: const Icon(Icons.history_rounded),
        onTap: _busy ? null : () => _openSession(session),
      ),
    );
  }

  Widget _selectedSessionCard(Map<String, dynamic> session) {
    final scenarioId = session['scenario_id']?.toString() ?? '';
    final interpretation = _currentInterpretation(session);
    final status = interpretation?['status']?.toString() ?? 'UNRESOLVED';
    final isActive = session['status'] == 'ACTIVE';
    final contextData = _map(interpretation?['context']);
    final observation = _map(interpretation?['observation']);
    final quality = _map(observation['quality']);
    final baseline = _map(interpretation?['baseline']);
    final evidence = _map(interpretation?['statistical_evidence']);
    final hasCorrectionChanges = _activity != _initialActivity ||
        _confidence != _initialConfidence;
    final statusLabel = switch (status) {
      'BASELINE_COMPATIBLE' => 'Kompatibel dengan baseline statistik',
      'DEVIATION_CANDIDATE' => 'Kandidat deviasi statistik',
      'UNRESOLVED' => 'UNRESOLVED — bukti belum cukup',
      _ => status,
    };
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Hasil sesi · skenario ${scenarioId.toUpperCase()}',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            _detailRow('Status bukti', statusLabel),
            _detailRow('Versi interpretasi',
                '${session['current_interpretation_version'] ?? 1}'),
            _detailRow('Konteks',
                '${contextData['activity'] ?? 'Tidak tersedia'} · ${contextData['time_period'] ?? '-'}'),
            _detailRow(
                'Quality gate',
                quality['gate_passed'] == true
                    ? 'Lolos'
                    : 'Tidak lolos / belum tersedia'),
            _detailRow(
              'Baseline CAPAR',
              '${baseline['activity'] ?? 'Tidak cocok'} · ${baseline['production_segment_count'] ?? 0} segmen · ${baseline['production_is_mature'] == true ? 'Mature' : 'Belum mature'} (${baseline['production_status'] ?? 'missing'})',
            ),
            _detailRow(
              'Kelayakan skenario',
              '${baseline['valid_duration_seconds'] ?? 0} detik valid · ${baseline['distinct_days'] ?? 0} hari · ${baseline['status'] ?? 'INELIGIBLE'}',
            ),
            if (evidence.isNotEmpty)
              _detailRow(
                'Jarak statistik',
                'd=${(evidence['distance'] as num?)?.toStringAsFixed(3) ?? '-'}; d²=${(evidence['squared_distance'] as num?)?.toStringAsFixed(3) ?? '-'}; ambang d²=${_map(evidence['thresholds'])['mild'] ?? '-'}; n=${evidence['sample_count'] ?? 0}',
              ),
            if (interpretation?['reason'] != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(interpretation!['reason'].toString()),
              ),
            if (interpretation?['uncertainty'] != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  interpretation!['uncertainty'].toString(),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            if (interpretation?['reason_code'] != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  'Alasan: ${interpretation!['reason_code']}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            if (scenarioId == 'c') ...[
              const Divider(height: 28),
              _scenarioQuestionnaires(session),
            ],
            if (scenarioId != 'a' && isActive) ...[
              const Divider(height: 28),
              Text('Koreksi konteks',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 6),
              const Text(
                'Respons dicatat sebagai laporan peserta. Skenario B tidak mengubah interpretasi; skenario C mengevaluasi ulang hanya bila bukti statistik tersedia.',
              ),
              const SizedBox(height: 10),
              if (hasCorrectionChanges)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(11),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF5D7),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE7C66A)),
                  ),
                  child: Text(
                    'Perubahan ditandai. Koreksi ini kembali ke L1 sebagai laporan konteks; sistem akan menilai ulang bagian yang terdampak tanpa menghapus versi sebelumnya atau menganggapnya sebagai bukti fisiologis.',
                    style: const TextStyle(fontSize: 12, height: 1.35),
                  ),
                ),
              DropdownButtonFormField<String>(
                initialValue: _activity,
                decoration: const InputDecoration(
                    labelText: 'Aktivitas saat observasi'),
                items: _activityOptions.entries
                    .map((entry) => DropdownMenuItem(
                          value: entry.key,
                          child: Text(entry.value),
                        ))
                    .toList(),
                onChanged: _busy
                    ? null
                    : (value) {
                        if (value == null) return;
                        setState(() {
                          _activity = value;
                          _confidence =
                              value == 'unsure' ? 'unsure' : 'certain';
                        });
                      },
              ),
              if (_activity != 'unsure')
                DropdownButtonFormField<String>(
                  initialValue: _confidence,
                  decoration:
                      const InputDecoration(labelText: 'Keyakinan laporan'),
                  items: const [
                    DropdownMenuItem(value: 'certain', child: Text('Yakin')),
                    DropdownMenuItem(
                        value: 'unsure', child: Text('Tidak yakin')),
                  ],
                  onChanged: _busy
                      ? null
                      : (value) {
                          if (value != null) {
                            setState(() => _confidence = value);
                          }
                        },
                ),
              const SizedBox(height: 10),
              FilledButton.icon(
                onPressed: _busy ? null : _submitFeedback,
                icon: const Icon(Icons.send_rounded),
                label: const Text('Simpan feedback'),
              ),
            ],
            if (_events.isNotEmpty) ...[
              const Divider(height: 28),
              Text('Audit trail (${_events.length})',
                  style: Theme.of(context).textTheme.titleMedium),
              ..._events.map((event) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                        '${event['event_type']}: ${event['value'] ?? 'Tidak yakin'}'),
                    subtitle: Text(
                      '${event['processing_state']} · ${event['reason_code'] ?? 'Tanpa alasan tambahan'}',
                    ),
                    trailing: event['new_version'] == null
                        ? null
                        : Text('v${event['new_version']}'),
                  )),
            ],
            const Divider(height: 28),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: _busy ? null : () => _copyExport(csv: false),
                  icon: const Icon(Icons.data_object),
                  label: const Text('Salin JSON'),
                ),
                OutlinedButton.icon(
                  onPressed: _busy ? null : () => _copyExport(csv: true),
                  icon: const Icon(Icons.table_chart_outlined),
                  label: const Text('Salin CSV'),
                ),
                if (isActive)
                  TextButton(
                    onPressed: _busy ? null : _completeSession,
                    child: const Text('Selesaikan sesi'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _scenarioQuestionnaires(Map<String, dynamic> session) {
    final sessionId = session['_id']?.toString();
    Map<String, dynamic>? findQuestionnaire(String instrument) {
      for (final item in _questionnaires) {
        if (item['instrument'] == instrument) return item;
      }
      return null;
    }

    final sus = findQuestionnaire('SUS');
    final nasaTlx = findQuestionnaire('NASA_TLX');

    Widget questionnaireButton({
      required String title,
      required String description,
      required Map<String, dynamic>? result,
      required ScenarioQuestionnaireType type,
    }) {
      final submitted = result != null;
      final score = result?['score'];
      final scoreText = score is num ? score.toStringAsFixed(1) : '-';
      return Card(
        child: ListTile(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          leading: Icon(
            submitted ? Icons.check_circle_outline : Icons.assignment_outlined,
            color: submitted ? const Color(0xFF16805D) : null,
          ),
          title: Text(title),
          subtitle: Text(
            submitted
                ? 'Tersimpan · skor $scoreText ${result['score_unit'] ?? ''}'
                : description,
          ),
          trailing: Icon(submitted ? Icons.check : Icons.chevron_right),
          onTap: _busy || submitted || sessionId == null
              ? null
              : () => _openQuestionnaire(type),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Evaluasi pengalaman skenario C',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 4),
        const Text(
          'Isi kuesioner setelah mencoba alur skenario. Jawaban tersimpan privat pada sesi ini; setiap instrumen hanya dapat dikirim satu kali.',
        ),
        const SizedBox(height: 8),
        questionnaireButton(
          title: 'System Usability Scale (SUS)',
          description: '10 pernyataan · skala 1-5',
          result: sus,
          type: ScenarioQuestionnaireType.sus,
        ),
        questionnaireButton(
          title: 'NASA-TLX',
          description: '6 dimensi beban kerja · skala 0-100',
          result: nasaTlx,
          type: ScenarioQuestionnaireType.nasaTlx,
        ),
      ],
    );
  }

  Widget _detailRow(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 5),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 145,
              child: Text(label,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
            Expanded(child: Text(value)),
          ],
        ),
      );

  Widget _errorCard(String message) => Card(
        color: const Color(0xFFFFF1F0),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(message, style: const TextStyle(color: Color(0xFF9F2D20))),
              if (_requiresRealRecording) ...[
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _busy ? null : _openRecordingPage,
                  icon: const Icon(Icons.sensors_rounded),
                  label: const Text('Buka perekaman Polar H10'),
                ),
              ],
            ],
          ),
        ),
      );
}
