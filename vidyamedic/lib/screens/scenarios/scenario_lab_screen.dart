import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../services/api_service.dart';
import 'scenario_questionnaire_screen.dart';

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
  Map<String, dynamic>? _selectedSession;
  String _activity = 'unsure';
  String _confidence = 'unsure';
  bool _loading = true;
  bool _busy = false;
  bool _initialRouteHandled = false;
  String? _error;

  @override
  void initState() {
    super.initState();
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
    if (_selectedSession == null && history.isNotEmpty) {
      await _openSession(history.first);
    }
    final initialScenarioId = widget.initialScenarioId;
    if (!_initialRouteHandled && initialScenarioId != null) {
      _initialRouteHandled = true;
      await _startScenario(initialScenarioId);
    }
  }

  Future<void> _openSession(Map<String, dynamic> item) async {
    final id = item['_id']?.toString();
    if (id == null || id.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
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
    setState(() {
      _selectedSession = session.data;
      _events = _maps(events.data);
      _questionnaires = _maps(questionnaires.data);
      _busy = false;
      _activity = 'unsure';
      _confidence = 'unsure';
    });
  }

  Future<void> _startScenario(String scenarioId) async {
    final consent = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Persetujuan sesi penelitian'),
        content: const SingleChildScrollView(
          child: Text(
            'Sesi ini mencatat pilihan skenario dan feedback Anda untuk evaluasi interaksi. Data CAPAR yang memenuhi quality gate dapat digunakan sebagai bukti observasi. Interpretasi bersifat eksperimental, bukan diagnosis, dan tidak menggantikan layanan klinis. Anda dapat berhenti kapan saja; sesi yang sudah tercatat tetap tersedia di riwayat akun.',
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
    });
    final result = await ApiService.startPatientScenario(
      scenarioId: scenarioId,
    );
    if (!mounted) return;
    if (!result.success || result.data == null) {
      setState(() {
        _busy = false;
        _error = result.message ?? 'Sesi tidak dapat dimulai.';
      });
      return;
    }
    setState(() {
      _selectedSession = result.data;
      _events = [];
      _questionnaires = [];
      _busy = false;
    });
    await _loadHistory();
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
                  Text('Mulai skenario',
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  ..._scenarios.map(_scenarioCard),
                  if (_sessions.isNotEmpty) ...[
                    const SizedBox(height: 20),
                    Text('Riwayat sesi',
                        style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 8),
                    ..._sessions.map(_sessionTile),
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
            'Sesi membandingkan tiga pola interaksi. Data yang tidak memenuhi kualitas atau baseline akan ditandai UNRESOLVED, bukan normal. Hasil hanya untuk evaluasi interaksi dan bukan diagnosis.',
          ),
        ),
      );

  Widget _scenarioCard(Map<String, dynamic> scenario) {
    final id = scenario['id']?.toString() ?? '';
    return Card(
      child: ListTile(
        title: Text(scenario['title']?.toString() ?? 'Skenario'),
        subtitle: Text(scenario['interaction']?.toString() ?? ''),
        trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 16),
        onTap: _busy || id.isEmpty ? null : () => _startScenario(id),
      ),
    );
  }

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
              'Baseline eksperimen',
              '${baseline['valid_duration_seconds'] ?? 0} detik · ${baseline['distinct_days'] ?? 0} hari · ${baseline['status'] ?? 'INELIGIBLE'}',
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
          child:
              Text(message, style: const TextStyle(color: Color(0xFF9F2D20))),
        ),
      );
}
