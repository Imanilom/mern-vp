import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';
import '../providers/app_state.dart';

enum PersonalChatRole { user, assistant }

enum _HealthMetric { heartRate, steps, hrv }

enum _AnalysisOperation { latest, average, minimum, maximum, trend }

class _PersonalAnalysisPlan {
  const _PersonalAnalysisPlan({
    required this.metric,
    required this.operation,
    this.window,
    this.calendarRange,
  });

  final _HealthMetric metric;
  final _AnalysisOperation operation;
  final Duration? window;
  final _CalendarRange? calendarRange;
}

class _CalendarRange {
  const _CalendarRange({
    required this.start,
    required this.end,
    required this.label,
  });

  final DateTime start;
  final DateTime end;
  final String label;
}

class _WearableObservation {
  const _WearableObservation({
    required this.value,
    required this.recordedAt,
  });

  final double value;
  final DateTime recordedAt;
}

class PersonalChatQuickAction {
  const PersonalChatQuickAction({
    required this.label,
    this.prompt,
  });

  final String label;
  final String? prompt;
}

class PersonalChatResponse {
  const PersonalChatResponse({
    required this.text,
    required this.supportingRecords,
    this.quickActions = const [],
  });

  final String text;
  final int supportingRecords;
  final List<PersonalChatQuickAction> quickActions;

  bool get hasInsufficientData => quickActions.isNotEmpty;
}

class PersonalChatMessage {
  const PersonalChatMessage({
    required this.role,
    required this.text,
    required this.createdAt,
    this.quickActions = const [],
    this.supportingRecords = 0,
    this.usedGemini = false,
  });

  final PersonalChatRole role;
  final String text;
  final DateTime createdAt;
  final List<PersonalChatQuickAction> quickActions;
  final int supportingRecords;
  final bool usedGemini;

  Map<String, dynamic> toJson() => {
        'role': role.name,
        'text': text,
        'created_at': createdAt.toIso8601String(),
        'quick_actions': quickActions
            .map((action) => {
                  'label': action.label,
                  'prompt': action.prompt,
                })
            .toList(),
        'supporting_records': supportingRecords,
        'used_gemini': usedGemini,
      };

  factory PersonalChatMessage.fromJson(Map<String, dynamic> json) {
    final role = PersonalChatRole.values.firstWhere(
      (value) => value.name == json['role'],
      orElse: () =>
          throw const FormatException('Peran pesan chat tidak valid.'),
    );
    final text = json['text'];
    final createdAt = DateTime.tryParse(json['created_at']?.toString() ?? '');
    if (text is! String || createdAt == null) {
      throw const FormatException('Format pesan chat pribadi tidak valid.');
    }
    final rawActions = json['quick_actions'];
    final quickActions = rawActions is List
        ? rawActions.whereType<Map>().map((action) {
            final label = action['label'];
            final prompt = action['prompt'];
            if (label is! String || (prompt != null && prompt is! String)) {
              throw const FormatException('Aksi cepat chat tidak valid.');
            }
            return PersonalChatQuickAction(
              label: label,
              prompt: prompt as String?,
            );
          }).toList()
        : const <PersonalChatQuickAction>[];
    return PersonalChatMessage(
      role: role,
      text: text,
      createdAt: createdAt,
      quickActions: quickActions,
      supportingRecords: (json['supporting_records'] as num?)?.toInt() ?? 0,
      usedGemini: json['used_gemini'] == true,
    );
  }
}

class PersonalChatHistoryStore {
  PersonalChatHistoryStore({required String accountId})
      : _key = 'vidyamedic_personal_chat_v1_${Uri.encodeComponent(accountId)}';

  static const int maxMessages = 100;
  final String _key;

  Future<List<PersonalChatMessage>> load() async {
    final preferences = await SharedPreferences.getInstance();
    final encoded = preferences.getString(_key);
    if (encoded == null || encoded.isEmpty) return [];
    final decoded = jsonDecode(encoded);
    if (decoded is! List) {
      throw const FormatException('Riwayat chat pribadi tidak valid.');
    }
    return decoded
        .whereType<Map>()
        .map((message) =>
            PersonalChatMessage.fromJson(Map<String, dynamic>.from(message)))
        .toList();
  }

  Future<void> save(List<PersonalChatMessage> messages) async {
    final preferences = await SharedPreferences.getInstance();
    final boundedMessages = messages.length > maxMessages
        ? messages.sublist(messages.length - maxMessages)
        : messages;
    final saved = await preferences.setString(
      _key,
      jsonEncode(boundedMessages.map((message) => message.toJson()).toList()),
    );
    if (!saved) throw StateError('Riwayat chat gagal disimpan di perangkat.');
  }

  Future<void> clear() async {
    final preferences = await SharedPreferences.getInstance();
    final removed = await preferences.remove(_key);
    if (!removed && preferences.containsKey(_key)) {
      throw StateError('Riwayat chat gagal dihapus dari perangkat.');
    }
  }
}

class PersonalHealthChatModel {
  const PersonalHealthChatModel();

  PersonalChatResponse respond({
    required String question,
    required AppState state,
    required List<PersonalChatMessage> history,
  }) {
    final text = reply(question: question, state: state, history: history);
    final insufficient =
        !isGuidanceQuestion(question) && _isInsufficientAnswer(text);
    final records = _supportingRecordCount(question, state, history);
    return PersonalChatResponse(
      text: text,
      supportingRecords: records,
      quickActions: insufficient
          ? const [
              PersonalChatQuickAction(label: 'Perbarui data'),
              PersonalChatQuickAction(
                label: 'Cara mencatat data',
                prompt: 'Bagaimana cara mengisi catatan kesehatan saya?',
              ),
              PersonalChatQuickAction(
                label: 'Coba topik lain',
                prompt: 'Apa saja yang bisa saya tanyakan?',
              ),
            ]
          : const [],
    );
  }

  List<Map<String, dynamic>> buildGeminiEvidence({
    required String question,
    required AppState state,
    required List<PersonalChatMessage> history,
  }) {
    final normalized = question.toLowerCase().trim();
    final effectiveQuestion = _isFollowUp(normalized)
        ? _previousUserQuestion(history) ?? normalized
        : normalized;
    final evidence = <Map<String, dynamic>>[];

    for (final checkIn in _retrieveCheckIns(effectiveQuestion, state)) {
      final facts = _checkInSummary(checkIn);
      if (facts == null) continue;
      evidence.add({
        'source': 'check_in',
        'recorded_at': checkIn['recorded_at']?.toString(),
        'facts': facts,
      });
    }

    final plan = _planWearableAnalysis(effectiveQuestion);
    if (plan != null) {
      final observations = _wearableObservations(plan, state);
      for (final observation in observations.skip(
        observations.length > 8 ? observations.length - 8 : 0,
      )) {
        evidence.add({
          'source': 'wearable_sample',
          'recorded_at': observation.recordedAt.toIso8601String(),
          'metric': _metricName(plan.metric),
          'value': _formatNumber(observation.value),
          'unit': _metricUnit(plan.metric),
        });
      }
      for (final observation in observations.isEmpty
          ? _currentWearableObservation(plan, state)
          : const <_WearableObservation>[]) {
        evidence.add({
          'source': 'wearable_sample',
          'recorded_at': observation.recordedAt.toIso8601String(),
          'metric': _metricName(plan.metric),
          'value': _formatNumber(observation.value),
          'unit': _metricUnit(plan.metric),
        });
      }
      if (plan.metric == _HealthMetric.heartRate &&
          _containsAny(effectiveQuestion, const [
            'baseline',
            'pola pribadi',
          ])) {
        final baseline = state.wearable.baselineHr > 0
            ? state.wearable.baselineHr
            : state.currentActivityBaseline.muHr;
        if (baseline > 0) {
          evidence.add({
            'source': 'personal_baseline',
            'metric': 'denyut jantung',
            'value': baseline,
            'unit': 'bpm',
          });
        }
      }
    }

    if (_containsAny(effectiveQuestion, const ['capar', 'pola pribadi']) &&
        state.hasCaparMetrics) {
      final caparState = _caparState(state);
      if (caparState != null) {
        evidence.add({
          'source': 'capar_summary',
          'status': caparState,
        });
      }
    }
    return evidence.take(15).toList();
  }

  String reply({
    required String question,
    required AppState state,
    required List<PersonalChatMessage> history,
  }) {
    final normalized = question.toLowerCase().trim();
    final followUp = _isFollowUp(normalized);
    final effectiveQuestion =
        followUp ? _previousUserQuestion(history) ?? normalized : normalized;
    final checkIns = _retrieveCheckIns(effectiveQuestion, state);

    final plan = _planWearableAnalysis(effectiveQuestion);
    final answer = _isClinicalOrUnsafeQuestion(effectiveQuestion)
        ? 'Saya tidak dapat mendiagnosis, menilai apakah kondisi Anda aman/normal, atau memberi saran medis dari data wearable. Saya hanya dapat membantu merangkum dan menghitung catatan personal. Untuk keluhan berat atau darurat, hubungi tenaga medis atau layanan darurat.'
        : isGuidanceQuestion(effectiveQuestion)
            ? 'Anda bisa mulai dengan langkah ini: (1) tekan Perbarui data agar wearable, check-in, dan CAPAR dimuat; (2) isi check-in harian tentang tidur, aktivitas, stres, dan gejala yang benar-benar dialami; (3) tanyakan satu hal yang spesifik, misalnya “Berapa rata-rata denyut jantung 7 hari terakhir?” atau “Apa yang tercatat tentang tidur saya?”; (4) sebutkan rentang waktu dan metrik yang ingin dibandingkan. Bila data belum cukup, gunakan tombol saran yang muncul untuk memperbarui data atau mencoba pertanyaan lain. Jawaban merujuk catatan yang ada dan bukan diagnosis.'
            : _requiresPairedData(effectiveQuestion)
                ? 'Pertanyaan ini membutuhkan catatan berpasangan dari beberapa hari agar hubungan atau perbandingan dapat dihitung. Data personal yang saat ini dimuat belum cukup untuk menyimpulkannya. Sinkronkan riwayat untuk rentang lebih panjang; saya tidak akan menebak hubungan dari satu catatan.'
                : plan != null
                    ? _runWearableAnalysis(plan, state)
                    : _containsAny(effectiveQuestion, const [
                        'wawasan',
                        'insight',
                        'analisis',
                        'pola',
                        'ringkas',
                        'rangkuman',
                      ])
                        ? _insightReply(state, checkIns)
                        : _containsAny(effectiveQuestion, const [
                            'tidur',
                            'istirahat',
                            'sleep',
                          ])
                            ? _sleepReply(checkIns)
                            : _containsAny(effectiveQuestion, const [
                                'stres',
                                'stress',
                                'tekanan',
                              ])
                                ? _stressReply(checkIns)
                                : _containsAny(effectiveQuestion, const [
                                    'gejala',
                                    'keluhan',
                                    'sakit',
                                    'berdebar',
                                    'pusing',
                                  ])
                                    ? _symptomReply(checkIns)
                                    : _containsAny(effectiveQuestion, const [
                                        'aktivitas',
                                        'olahraga',
                                        'gerak',
                                        'berjalan',
                                      ])
                                        ? _activityReply(checkIns)
                                        : _containsAny(
                                                effectiveQuestion, const [
                                            'jantung',
                                            'denyut',
                                            'detak',
                                            'bpm',
                                            'hrv',
                                          ])
                                            ? _heartReply(state,
                                                includeHrv:
                                                    normalized.contains('hrv'))
                                            : _fallbackReply(state);

    if (!followUp) return answer;
    final previous = _previousUserQuestion(history);
    return previous == null
        ? answer
        : 'Menindaklanjuti pertanyaan Anda tentang “$previous”: $answer';
  }

  List<Map<String, dynamic>> _retrieveCheckIns(
    String question,
    AppState state,
  ) {
    final checkIns = _checkIns(state);
    if (checkIns.isEmpty) return const [];
    final range = _calendarRangeFor(question);
    final dayMatch = RegExp(r'(\d{1,3})\s*hari').firstMatch(question);
    final days = dayMatch == null ? null : int.tryParse(dayMatch.group(1)!);
    final from = range?.start ??
        (days != null && days > 0 && days <= 365
            ? DateTime.now().subtract(Duration(days: days))
            : null);
    final rangedCheckIns = from == null
        ? checkIns
        : checkIns.where((checkIn) {
            final date = DateTime.tryParse(
              checkIn['recorded_at']?.toString() ?? '',
            );
            if (date == null || date.isBefore(from)) return false;
            return range == null || date.isBefore(range.end);
          }).toList();
    if (rangedCheckIns.isEmpty) return const [];
    if (_containsAny(question, const [
      'wawasan',
      'insight',
      'analisis',
      'pola',
      'ringkas',
      'rangkuman',
    ])) {
      return rangedCheckIns.length <= 5
          ? rangedCheckIns
          : rangedCheckIns.sublist(rangedCheckIns.length - 5);
    }

    final queryTokens = _searchTokens(question);
    if (queryTokens.isEmpty) return const [];
    final ranked =
        <({Map<String, dynamic> checkIn, int score, DateTime date})>[];
    for (final checkIn in rangedCheckIns) {
      final index = _checkInSearchIndex(checkIn);
      final score = queryTokens.intersection(index).length;
      if (score == 0) continue;
      ranked.add((
        checkIn: checkIn,
        score: score,
        date: DateTime.tryParse(checkIn['recorded_at']?.toString() ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0),
      ));
    }
    ranked.sort((a, b) {
      final relevance = b.score.compareTo(a.score);
      return relevance != 0 ? relevance : b.date.compareTo(a.date);
    });
    return ranked.take(5).map((result) => result.checkIn).toList()
      ..sort((a, b) {
        final first = DateTime.tryParse(a['recorded_at']?.toString() ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        final second = DateTime.tryParse(b['recorded_at']?.toString() ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        return first.compareTo(second);
      });
  }

  Set<String> _checkInSearchIndex(Map<String, dynamic> checkIn) {
    final words = <String>{'catatan', 'checkin'};
    final activity = checkIn['activity']?.toString();
    if (activity != null) {
      words.addAll(_searchTokens(activity));
      words.addAll(_searchTokens(_activityLabel(activity)));
      words.addAll(const {'aktivitas', 'gerak'});
    }
    final stress = _number(checkIn['stress_level']);
    if (stress != null) words.addAll(const {'stres', 'stress', 'tekanan'});
    final symptoms = checkIn['symptoms'];
    if (symptoms is List && symptoms.isNotEmpty) {
      words.addAll(const {'gejala', 'keluhan', 'sakit'});
      for (final symptom in symptoms) {
        words.addAll(_searchTokens(_symptomLabel(symptom)));
        words.addAll(_searchTokens(symptom.toString()));
      }
    }
    final sleep = checkIn['sleep'];
    if (sleep is Map) {
      words.addAll(const {'tidur', 'sleep', 'istirahat'});
      if (_number(sleep['duration_minutes']) != null) {
        words.addAll(const {'durasi', 'jam'});
      }
      final quality = sleep['quality']?.toString();
      if (quality != null) words.addAll(_searchTokens(_sleepQuality(quality)));
    }
    final recordedAt = DateTime.tryParse(
      checkIn['recorded_at']?.toString() ?? '',
    );
    if (recordedAt != null) {
      words.addAll(_searchTokens(_formatDate(recordedAt)));
      words.addAll(const {'tanggal', 'waktu', 'terakhir'});
    }
    return words;
  }

  Set<String> _searchTokens(String text) {
    const stopWords = {
      'apa',
      'apakah',
      'saya',
      'aku',
      'data',
      'catatan',
      'tercatat',
      'tentang',
      'yang',
      'dan',
      'dari',
      'untuk',
      'pada',
      'dengan',
      'berapa',
      'bagaimana',
      'terakhir',
      'personal',
      'pribadi',
    };
    final tokens = RegExp(r'[a-z0-9]+')
        .allMatches(text.toLowerCase())
        .map((match) => match.group(0)!)
        .where((token) => token.length > 1 && !stopWords.contains(token))
        .toSet();
    final expanded = Set<String>.of(tokens);
    if (tokens.any(const {'denyut', 'jantung', 'berdebar'}.contains)) {
      expanded.addAll(const {'denyut', 'jantung', 'berdebar', 'palpitasi'});
    }
    if (tokens.any(const {'stres', 'stress', 'tekanan'}.contains)) {
      expanded.addAll(const {'stres', 'stress', 'tekanan'});
    }
    if (tokens.any(const {'tidur', 'sleep', 'istirahat'}.contains)) {
      expanded.addAll(const {'tidur', 'sleep', 'istirahat'});
    }
    if (tokens
        .any(const {'aktivitas', 'olahraga', 'berjalan', 'langkah'}.contains)) {
      expanded.addAll(const {'aktivitas', 'olahraga', 'berjalan', 'langkah'});
    }
    if (tokens.any(const {'pusing', 'dizziness'}.contains)) {
      expanded.addAll(const {'pusing', 'dizziness'});
    }
    return expanded;
  }

  bool _isInsufficientAnswer(String answer) => _containsAny(
        answer.toLowerCase(),
        const [
          'belum ada',
          'belum cukup',
          'tidak menemukan sampel nyata',
          'membutuhkan catatan berpasangan',
          'belum tersedia',
        ],
      );

  int _supportingRecordCount(
    String question,
    AppState state,
    List<PersonalChatMessage> history,
  ) {
    final followUp = _isFollowUp(question.toLowerCase().trim());
    final effectiveQuestion =
        followUp ? _previousUserQuestion(history) ?? question : question;
    final checkIns = _retrieveCheckIns(effectiveQuestion, state).length;
    final plan = _planWearableAnalysis(effectiveQuestion);
    if (plan == null) return checkIns;
    final observations = _wearableObservations(plan, state);
    return checkIns +
        observations.length +
        (observations.isEmpty
            ? _currentWearableObservation(plan, state).length
            : 0);
  }

  List<_WearableObservation> _wearableObservations(
    _PersonalAnalysisPlan plan,
    AppState state,
  ) {
    final now = DateTime.now();
    final preferHistory = plan.metric != _HealthMetric.steps &&
        state.personalChatWearableHistory.isNotEmpty &&
        (plan.window != null ||
            plan.calendarRange != null ||
            plan.operation != _AnalysisOperation.latest ||
            state.wearableSamples.isEmpty);
    final source = preferHistory
        ? state.personalChatWearableHistory
        : state.wearableSamples;
    final observations = <_WearableObservation>[];
    for (final sample in source) {
      if (sample['is_simulated'] == true) continue;
      final recordedAt =
          DateTime.tryParse(sample['recorded_at']?.toString() ?? '');
      final value = _sampleValue(plan.metric, sample);
      if (recordedAt == null ||
          value == null ||
          !value.isFinite ||
          recordedAt.isAfter(now)) {
        continue;
      }
      if (plan.window != null &&
          now.difference(recordedAt) > plan.window!) {
        continue;
      }
      final calendarRange = plan.calendarRange;
      if (calendarRange != null &&
          (recordedAt.isBefore(calendarRange.start) ||
              !recordedAt.isBefore(calendarRange.end))) {
        continue;
      }
      observations.add(
        _WearableObservation(value: value, recordedAt: recordedAt),
      );
    }
    observations.sort((a, b) => a.recordedAt.compareTo(b.recordedAt));
    return observations;
  }

  List<_WearableObservation> _currentWearableObservation(
    _PersonalAnalysisPlan plan,
    AppState state,
  ) {
    final current = state.wearable;
    final recordedAt = current.lastSync;
    if (!current.hasServerSamples ||
        current.isSimulated ||
        recordedAt == null) {
      return const [];
    }
    final value = _sampleValue(plan.metric, {
      'heart_rate_bpm': current.heartRate,
      'steps': current.steps,
      'rmssd_ms': current.hrvRmssd,
    });
    final now = DateTime.now();
    if (value == null ||
        recordedAt.isAfter(now) ||
        (plan.window != null &&
            now.difference(recordedAt) > plan.window!)) {
      return const [];
    }
    final range = plan.calendarRange;
    if (range != null &&
        (recordedAt.isBefore(range.start) || !recordedAt.isBefore(range.end))) {
      return const [];
    }
    return [_WearableObservation(value: value, recordedAt: recordedAt)];
  }

  bool isGuidanceQuestion(String question) => _containsAny(
        question.toLowerCase(),
        const [
          'cara mengisi',
          'cara mencatat',
          'bagaimana cara',
          'apa saja yang bisa',
          'bisa saya tanyakan',
          'cara menggunakan',
        ],
      );

  bool isSafeForGemini(String question) =>
      !_isClinicalOrUnsafeQuestion(question.toLowerCase().trim()) &&
      !isGuidanceQuestion(question);

  _PersonalAnalysisPlan? _planWearableAnalysis(String question) {
    final metric = _metricFor(question);
    if (metric == null) return null;

    final operation = _operationFor(question);
    final calendarRange = _calendarRangeFor(question);
    return _PersonalAnalysisPlan(
      metric: metric,
      operation: operation,
      window: calendarRange == null ? _windowFor(question) : null,
      calendarRange: calendarRange,
    );
  }

  _HealthMetric? _metricFor(String question) {
    if (_containsAny(question, const [
      'langkah',
      'step',
      'jalan kaki',
    ])) {
      return _HealthMetric.steps;
    }
    if (_containsAny(question, const [
      'hrv',
      'rmssd',
      'variabilitas ritme',
    ])) {
      return _HealthMetric.hrv;
    }
    if (_containsAny(question, const [
      'denyut',
      'detak',
      'jantung',
      'bpm',
    ])) {
      return _HealthMetric.heartRate;
    }
    return null;
  }

  _AnalysisOperation _operationFor(String question) {
    if (_containsAny(
        question, const ['rata-rata', 'rerata', 'average', 'avg'])) {
      return _AnalysisOperation.average;
    }
    if (_containsAny(question, const ['tertinggi', 'maksimum', 'max'])) {
      return _AnalysisOperation.maximum;
    }
    if (_containsAny(question, const ['terendah', 'minimum', 'min'])) {
      return _AnalysisOperation.minimum;
    }
    if (_containsAny(question, const [
      'tren',
      'trend',
      'meningkat',
      'menurun',
      'berubah',
      'perubahan',
    ])) {
      return _AnalysisOperation.trend;
    }
    return _AnalysisOperation.latest;
  }

  Duration? _windowFor(String question) {
    final match = RegExp(r'(\d{1,3})\s*hari').firstMatch(question);
    if (match != null) {
      final days = int.tryParse(match.group(1)!);
      if (days != null && days > 0 && days <= 365) {
        return Duration(days: days);
      }
    }
    if (_containsAny(question, const ['minggu ini', 'pekan ini'])) {
      return const Duration(days: 7);
    }
    return null;
  }

  _CalendarRange? _calendarRangeFor(String question) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    if (_containsAny(question, const ['hari ini', 'today'])) {
      return _CalendarRange(
        start: today,
        end: today.add(const Duration(days: 1)),
        label: 'hari ini',
      );
    }
    if (_containsAny(question, const ['kemarin', 'yesterday'])) {
      return _CalendarRange(
        start: today.subtract(const Duration(days: 1)),
        end: today,
        label: 'kemarin',
      );
    }
    return null;
  }

  String _runWearableAnalysis(
    _PersonalAnalysisPlan plan,
    AppState state,
  ) {
    final now = DateTime.now();
    final observations = _wearableObservations(plan, state);
    if (observations.isEmpty) {
      observations.addAll(_currentWearableObservation(plan, state));
    }

    final metricName = _metricName(plan.metric);
    final unit = _metricUnit(plan.metric);
    if (observations.isEmpty) {
      if (plan.metric == _HealthMetric.heartRate &&
          plan.operation == _AnalysisOperation.latest &&
          plan.window == null &&
          plan.calendarRange == null &&
          state.wearable.hasServerSamples &&
          !state.wearable.isSimulated &&
          state.wearable.heartRate > 0) {
        return _heartReply(state);
      }
      final requestedWindow =
          'pada sampel wearable yang dimuat${plan.calendarRange != null ? ' untuk ${plan.calendarRange!.label}' : plan.window == null ? '' : ' dalam ${plan.window!.inDays} hari terakhir'}';
      final baselineNote = plan.metric == _HealthMetric.heartRate &&
              state.wearable.baselineHr > 0
          ? ' Baseline pribadi ${state.wearable.baselineHr} bpm tersedia, tetapi baseline bukan sampel historis untuk rentang ini.'
          : '';
      final historyNote = state.personalChatHistoryError == null
          ? ''
          : ' Riwayat lama belum berhasil dimuat: ${state.personalChatHistoryError}';
      return 'Saya memeriksa $metricName $requestedWindow, tetapi belum menemukan sampel nyata yang cocok pada riwayat yang dimuat. Data demo tidak dihitung.$baselineNote$historyNote Perbarui data lalu coba lagi.';
    }

    final values = observations.map((item) => item.value).toList();
    final minimum = values.reduce((a, b) => a < b ? a : b);
    final maximum = values.reduce((a, b) => a > b ? a : b);
    final average = values.reduce((a, b) => a + b) / values.length;
    final firstDate = _formatDate(observations.first.recordedAt);
    final lastDate = _formatDate(observations.last.recordedAt);
    final coverage = firstDate == lastDate
        ? 'pada $firstDate'
        : 'dari $firstDate sampai $lastDate';
    final result = switch (plan.operation) {
      _AnalysisOperation.latest =>
        '${_formatNumber(observations.last.value)} $unit pada ${_formatDate(observations.last.recordedAt)}${_heartBaselineDifference(plan, observations.last.value, state)}',
      _AnalysisOperation.average => 'rata-rata ${_formatNumber(average)} $unit',
      _AnalysisOperation.minimum =>
        'nilai terendah ${_formatNumber(minimum)} $unit',
      _AnalysisOperation.maximum =>
        'nilai tertinggi ${_formatNumber(maximum)} $unit',
      _AnalysisOperation.trend => _trendResult(values, average, unit),
    };

    final periodText = plan.calendarRange != null
        ? 'untuk ${plan.calendarRange!.label}'
        : plan.window == null
            ? 'pada rentang sampel yang tersedia'
            : 'dalam ${plan.window!.inDays} hari terakhir';
    final requestedStart = plan.calendarRange?.start ??
        now.subtract(plan.window ?? const Duration(days: 365));
    final coverageNote = (plan.calendarRange != null || plan.window != null) &&
            observations.first.recordedAt.isAfter(requestedStart)
        ? ' Data tersedia hanya mulai ${_formatDate(observations.first.recordedAt)}; tidak mencakup seluruh rentang yang diminta.'
        : '';
    final validation = values.every((value) => value.isFinite) &&
            minimum <= average &&
            average <= maximum
        ? 'Hasil hitung lolos pemeriksaan rentang nilai.'
        : 'Hasil tidak dapat diverifikasi, jadi saya tidak akan menyimpulkan.';
    return 'Saya memeriksa $metricName $periodText: $result, dari ${values.length} sampel nyata $coverage.$coverageNote $validation Ini ringkasan pengukuran, bukan diagnosis.';
  }

  String _heartBaselineDifference(
    _PersonalAnalysisPlan plan,
    double latestValue,
    AppState state,
  ) {
    if (plan.metric != _HealthMetric.heartRate ||
        plan.operation != _AnalysisOperation.latest) {
      return '';
    }
    final baseline = (state.wearable.baselineHr > 0
            ? state.wearable.baselineHr
            : state.currentActivityBaseline.muHr)
        .toDouble();
    if (baseline <= 0) return '';
    final difference = latestValue - baseline;
    final relation = difference > 0
        ? '${_formatNumber(difference)} bpm di atas'
        : difference < 0
            ? '${_formatNumber(difference.abs())} bpm di bawah'
            : 'setara dengan';
    return ', $relation baseline pribadi ${_formatNumber(baseline)} bpm';
  }

  double? _sampleValue(
    _HealthMetric metric,
    Map<String, dynamic> sample,
  ) {
    final key = switch (metric) {
      _HealthMetric.heartRate => 'heart_rate_bpm',
      _HealthMetric.steps => 'steps',
      _HealthMetric.hrv => 'rmssd_ms',
    };
    final value = _number(sample[key]);
    if (value == null || value <= 0) return null;
    return value;
  }

  String _trendResult(List<double> values, double average, String unit) {
    if (values.length < 2) {
      return 'belum cukup data untuk menghitung tren (perlu setidaknya 2 sampel)';
    }
    final midpoint = values.length ~/ 2;
    final firstHalf = values.take(midpoint).toList();
    final secondHalf = values.skip(midpoint).toList();
    if (firstHalf.isEmpty || secondHalf.isEmpty) {
      return 'belum cukup data untuk menghitung tren';
    }
    final firstAverage = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
    final secondAverage =
        secondHalf.reduce((a, b) => a + b) / secondHalf.length;
    final difference = secondAverage - firstAverage;
    if (difference == 0) {
      return 'relatif tetap pada dua bagian sampel (rerata ${_formatNumber(average)} $unit)';
    }
    final direction = difference > 0 ? 'meningkat' : 'menurun';
    return '$direction ${_formatNumber(difference.abs())} $unit antara dua bagian sampel';
  }

  bool _isClinicalOrUnsafeQuestion(String question) {
    return _containsAny(question, const [
          'diagnosis',
          'diagnosa',
          'saya sakit apa',
          'penyakit apa',
          'apakah saya sehat',
          'apakah saya normal',
          'apakah ini normal',
          'apakah aman',
          'aman tidak',
          'haruskah saya minum obat',
          'obat apa yang harus',
          'harus berhenti obat',
          'cara menyembuhkan',
          'mengobati penyakit',
          'bunuh diri',
          'menyakiti diri',
          'menahan makan',
          'cara kelaparan',
        ]) ||
        (question.contains('normal') &&
            _containsAny(question, const ['denyut', 'detak', 'jantung']));
  }

  bool _requiresPairedData(String question) {
    final asksForRelationship = _containsAny(question, const [
      'korelasi',
      'berhubungan',
      'hubungan antara',
      'setelah olahraga',
      'sesudah olahraga',
      'dibandingkan',
      'bandingkan',
    ]);
    const domains = [
      ['tidur', 'istirahat', 'sleep'],
      ['langkah', 'aktivitas', 'olahraga'],
      ['stres', 'stress'],
      ['mood', 'suasana hati'],
      ['denyut', 'detak', 'jantung', 'bpm'],
      ['hrv', 'rmssd'],
    ];
    final matchedDomains =
        domains.where((domain) => _containsAny(question, domain)).length;
    final comparesDays = _containsAny(question, const [
          'dibanding',
          'bandingkan',
          'perbandingan',
          ' versus ',
          ' vs ',
        ]) &&
        _containsAny(question, const ['hari ini', 'today']) &&
        _containsAny(question, const ['kemarin', 'yesterday']);
    return asksForRelationship && (matchedDomains >= 2 || comparesDays);
  }

  String _metricName(_HealthMetric metric) => switch (metric) {
        _HealthMetric.heartRate => 'denyut jantung',
        _HealthMetric.steps => 'jumlah langkah',
        _HealthMetric.hrv => 'RMSSD (HRV)',
      };

  String _metricUnit(_HealthMetric metric) => switch (metric) {
        _HealthMetric.heartRate => 'bpm',
        _HealthMetric.steps => 'langkah',
        _HealthMetric.hrv => 'ms',
      };

  String _formatDate(DateTime date) =>
      '${date.toLocal().day.toString().padLeft(2, '0')}/${date.toLocal().month.toString().padLeft(2, '0')}/${date.toLocal().year}';

  List<Map<String, dynamic>> _checkIns(AppState state) {
    final records = <Map<String, dynamic>>[
      ...state.personalChatCheckIns.map(Map<String, dynamic>.from),
    ];
    final daily = state.dailySummaryData?['check_ins'];
    if (daily is List) {
      records.addAll(
        daily.whereType<Map>().map(
              (item) => Map<String, dynamic>.from(item),
            ),
      );
    }
    final unique = <String, Map<String, dynamic>>{};
    for (final record in records) {
      final id = record['_id']?.toString();
      final recordedAt = record['recorded_at']?.toString() ?? '';
      unique[id != null && id.isNotEmpty
          ? id
          : '${recordedAt}_${_checkInSummary(record) ?? ''}'] = record;
    }
    return unique.values.toList()
      ..sort((a, b) {
        final first = DateTime.tryParse(a['recorded_at']?.toString() ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        final second = DateTime.tryParse(b['recorded_at']?.toString() ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        return first.compareTo(second);
      });
  }

  String _heartReply(AppState state, {bool includeHrv = false}) {
    final wearable = state.wearable;
    final baseline = wearable.baselineHr > 0
        ? wearable.baselineHr.toDouble()
        : state.currentActivityBaseline.muHr;
    final sentences = <String>[];
    if (wearable.hasServerSamples &&
        !wearable.isSimulated &&
        wearable.heartRate > 0) {
      if (baseline > 0) {
        final difference = wearable.heartRate - baseline;
        final relation = difference > 0
            ? '${_formatNumber(difference)} bpm di atas'
            : difference < 0
                ? '${_formatNumber(difference.abs())} bpm di bawah'
                : 'setara dengan';
        sentences.add(
          'Sampel wearable terakhir mencatat denyut ${wearable.heartRate} bpm, $relation baseline pribadi ${_formatNumber(baseline)} bpm.',
        );
      } else {
        sentences.add(
          'Sampel wearable terakhir mencatat denyut ${wearable.heartRate} bpm, tetapi baseline pribadi belum tersedia untuk dibandingkan.',
        );
      }
    } else {
      sentences.add(
        'Data denyut wearable terbaru belum tersedia atau yang tersedia adalah data simulasi.',
      );
    }

    if (includeHrv) {
      final hrvBaseline = state.currentActivityBaseline.muHrv;
      if (wearable.hrvRmssd > 0 && hrvBaseline > 0) {
        sentences.add(
          'RMSSD terbaru ${wearable.hrvRmssd} ms; rerata baseline personal ${_formatNumber(hrvBaseline)} ms.',
        );
      } else if (wearable.hrvRmssd > 0) {
        sentences.add(
          'RMSSD terbaru tercatat ${wearable.hrvRmssd} ms, tetapi baseline RMSSD personal belum tersedia.',
        );
      } else {
        sentences.add('Data HRV terbaru belum tersedia.');
      }
    }
    return '${sentences.join(' ')} Ini ringkasan data, bukan diagnosis.';
  }

  String _insightReply(AppState state, List<Map<String, dynamic>> checkIns) {
    final insights = <String>[];
    final wearable = state.wearable;
    final baseline = wearable.baselineHr > 0
        ? wearable.baselineHr.toDouble()
        : state.currentActivityBaseline.muHr;
    if (wearable.hasServerSamples &&
        !wearable.isSimulated &&
        wearable.heartRate > 0) {
      if (baseline > 0) {
        final delta = wearable.heartRate - baseline;
        final relation = delta > 0
            ? '${_formatNumber(delta)} bpm di atas'
            : delta < 0
                ? '${_formatNumber(delta.abs())} bpm di bawah'
                : 'setara dengan';
        insights.add(
          'denyut wearable ${wearable.heartRate} bpm ($relation baseline ${_formatNumber(baseline)} bpm)',
        );
      } else {
        insights.add('denyut wearable ${wearable.heartRate} bpm');
      }
    }

    final latest = checkIns.isEmpty ? null : checkIns.last;
    final context = latest == null ? null : _checkInSummary(latest);
    if (context != null) insights.add('catatan terakhir: $context');

    final stateLabel = _caparState(state);
    if (stateLabel != null) {
      insights.add('status perbandingan CAPAR: $stateLabel');
    }
    if (insights.isEmpty) {
      return 'Belum ada data personal yang cukup dimuat untuk membuat ringkasan. Sinkronkan wearable atau isi catatan harian terlebih dahulu.';
    }
    return 'Dari data personal yang saat ini tersedia, ${insights.join('; ')}. Ini hanya rangkuman catatan yang ada, bukan kesimpulan medis.';
  }

  String _sleepReply(List<Map<String, dynamic>> checkIns) {
    for (final checkIn in checkIns.reversed) {
      final sleep = checkIn['sleep'];
      if (sleep is! Map) continue;
      final details = <String>[];
      final duration = _number(sleep['duration_minutes']);
      if (duration != null && duration > 0) {
        details.add(
          'durasi ${(duration / 60).toStringAsFixed(1)} jam',
        );
      }
      final quality = sleep['quality']?.toString();
      if (quality != null && quality.isNotEmpty) {
        details.add('kualitas ${_sleepQuality(quality)}');
      }
      if (details.isNotEmpty) {
        return 'Pada catatan tidur terakhir, Anda mencatat ${details.join(' dan ')}. Ini berdasarkan catatan Anda, bukan penilaian medis.';
      }
    }
    return 'Belum ada catatan tidur yang tersedia pada ringkasan yang dimuat.';
  }

  String _stressReply(List<Map<String, dynamic>> checkIns) {
    for (final checkIn in checkIns.reversed) {
      final level = _number(checkIn['stress_level']);
      if (level != null) {
        final label = switch (level.round()) {
          1 => 'rendah',
          2 => 'sedang',
          3 => 'tinggi',
          _ => 'level ${level.round()}',
        };
        return 'Di catatan aktivitas terakhir, tingkat stres tercatat $label. Catatan ini adalah laporan Anda, bukan pengukuran klinis.';
      }
    }
    return 'Belum ada tingkat stres yang tercatat pada ringkasan yang dimuat.';
  }

  String _symptomReply(List<Map<String, dynamic>> checkIns) {
    for (final checkIn in checkIns.reversed) {
      final symptoms = checkIn['symptoms'];
      if (symptoms is List) {
        if (symptoms.isEmpty || symptoms.every((item) => item == 'none')) {
          return 'Pada catatan terakhir, tidak ada gejala yang dilaporkan.';
        }
        return 'Gejala yang tercatat terakhir: ${symptoms.map(_symptomLabel).join(', ')}. Jika keluhan terasa berat atau darurat, cari bantuan medis tanpa menunggu chatbot.';
      }
    }
    return 'Belum ada catatan gejala yang tersedia pada ringkasan yang dimuat.';
  }

  String _activityReply(List<Map<String, dynamic>> checkIns) {
    for (final checkIn in checkIns.reversed) {
      final activity = checkIn['activity']?.toString();
      if (activity != null && activity.isNotEmpty) {
        return 'Aktivitas yang terakhir tercatat adalah ${_activityLabel(activity)}. Ini merujuk pada check-in Anda, bukan deteksi otomatis aktivitas.';
      }
    }
    return 'Belum ada aktivitas yang tercatat pada ringkasan yang dimuat.';
  }

  String _fallbackReply(AppState state) {
    if (state.hasCaparMetrics) {
      return 'Saya dapat merangkum data denyut jantung, HRV, aktivitas, tidur, stres, atau gejala yang tercatat. Saat ini CAPAR memiliki perbandingan dengan baseline personal. Coba tanyakan salah satu topik tersebut.';
    }
    return 'Saya menjawab berdasarkan catatan pribadi yang tersedia di perangkat dan aplikasi. Coba tanyakan “bagaimana denyut jantung saya?”, “apa catatan tidur saya?”, “aktivitas apa yang tercatat?”, atau “beri wawasan personal”.';
  }

  String? _checkInSummary(Map<String, dynamic> checkIn) {
    final details = <String>[];
    final activity = checkIn['activity']?.toString();
    if (activity != null && activity.isNotEmpty) {
      details.add(_activityLabel(activity));
    }
    final stress = _number(checkIn['stress_level']);
    if (stress != null) details.add('stres ${stress.round()}');
    final symptoms = checkIn['symptoms'];
    if (symptoms is List && symptoms.isNotEmpty) {
      details.add('gejala ${symptoms.map(_symptomLabel).join(', ')}');
    }
    final sleep = checkIn['sleep'];
    if (sleep is Map) {
      final duration = _number(sleep['duration_minutes']);
      if (duration != null && duration > 0) {
        details.add('tidur ${(duration / 60).toStringAsFixed(1)} jam');
      }
    }
    return details.isEmpty ? null : details.join(', ');
  }

  String? _caparState(AppState state) {
    final value = state.latestCaparMahalanobis?['state']?.toString();
    return switch (value) {
      'within_personal_region' => 'dalam rentang pola pribadi',
      'moderately_displaced' => 'berbeda dari pola pribadi',
      'strongly_displaced' => 'lebih jauh berbeda dari pola pribadi',
      _ => null,
    };
  }

  String _activityLabel(String value) => switch (value.toLowerCase()) {
        'rest' => 'istirahat',
        'sitting' => 'duduk',
        'standing' => 'berdiri',
        'walking' => 'berjalan',
        'running' => 'berlari',
        'exercise' => 'olahraga',
        'work' => 'bekerja',
        'meal' => 'makan',
        _ => value,
      };

  String _symptomLabel(dynamic value) => switch (value.toString()) {
        'palpitations' => 'jantung berdebar',
        'breathlessness' => 'sesak napas',
        'chest_pain' => 'nyeri dada',
        'dizziness' => 'pusing',
        'fatigue' => 'lelah',
        'headache' => 'sakit kepala',
        'nausea' => 'mual',
        'weakness' => 'lemas',
        'fever' => 'demam',
        'none' => 'tidak ada gejala',
        _ => value.toString(),
      };

  String _sleepQuality(String quality) => switch (quality) {
        'very_good' || 'excellent' => 'sangat baik',
        'good' => 'baik',
        'fair' => 'cukup',
        'poor' => 'kurang baik',
        _ => quality,
      };

  bool _containsAny(String text, List<String> terms) =>
      terms.any(text.contains);

  bool _isFollowUp(String text) => _containsAny(text, const [
        'jelaskan lagi',
        'lebih detail',
        'yang tadi',
        'sebelumnya',
        'maksudnya',
        'itu bagaimana',
      ]);

  String? _previousUserQuestion(List<PersonalChatMessage> history) {
    for (final message in history.reversed) {
      if (message.role == PersonalChatRole.user) return message.text;
    }
    return null;
  }

  double? _number(dynamic value) {
    if (value is num && value.isFinite) return value.toDouble();
    final parsed = double.tryParse(value?.toString() ?? '');
    return parsed != null && parsed.isFinite ? parsed : null;
  }

  String _formatNumber(double value) => value == value.roundToDouble()
      ? value.toStringAsFixed(0)
      : value.toStringAsFixed(1);
}
