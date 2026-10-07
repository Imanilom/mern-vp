import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/app_state.dart';
import '../../services/deviation_location_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';
import 'pedagogy_screen_why.dart';

class WhatChangedScreen extends StatefulWidget {
  const WhatChangedScreen({super.key});

  @override
  State<WhatChangedScreen> createState() => _WhatChangedScreenState();
}

class _WhatChangedScreenState extends State<WhatChangedScreen> {
  final Map<String, Set<String>> _multipleAnswers = {};
  final Map<String, String> _singleAnswers = {};
  final Map<String, TextEditingController> _textAnswers = {};
  final TextEditingController _mealCountController = TextEditingController();
  final DeviationLocationService _locationService =
      const DeviationLocationService();
  DeviationLocation? _location;
  String? _locationMessage;
  String? _locationAttemptedForSegment;
  bool _isCapturingLocation = false;
  bool _isSubmitting = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final appState = context.watch<AppState>();
    final prompt = appState.followUpPrompt;
    final segmentId = prompt.segmentId;
    if (prompt.status == 'requested' &&
        segmentId != null &&
        _locationAttemptedForSegment != segmentId) {
      _locationAttemptedForSegment = segmentId;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _captureLocation();
      });
    }
  }

  @override
  void dispose() {
    _mealCountController.dispose();
    for (final controller in _textAnswers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _captureLocation() async {
    if (_isCapturingLocation) return;
    setState(() {
      _isCapturingLocation = true;
      _locationMessage = null;
    });
    final result = await _locationService.capture();
    if (!mounted) return;
    setState(() {
      _isCapturingLocation = false;
      _location = result.location;
      _locationMessage = result.error;
    });
  }

  bool _hasRequiredContext() {
    final mealCount = int.tryParse(_mealCountController.text.trim());
    return (_singleAnswers['recent_context']?.isNotEmpty ?? false) &&
        (_multipleAnswers['possible_factors']?.isNotEmpty ?? false) &&
        mealCount != null &&
        mealCount >= 0 &&
        mealCount <= 20;
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final deviation = state.latestCaparMahalanobis;
    final questions = state.followUpPrompt.questions;
    final rawFollowUp =
        (state.rawCaparInsights?['capar']?['pedagogy']?['follow_up']);
    final uncertainty = rawFollowUp is Map &&
            rawFollowUp['reasoning_uncertainty'] is Map
        ? Map<String, dynamic>.from(rawFollowUp['reasoning_uncertainty'] as Map)
        : null;
    final isRequested = state.followUpPrompt.status == 'requested' &&
        state.followUpPrompt.segmentId != null;

    return PopScope(
      canPop: !isRequested,
      child: MockupScaffold(
        title: 'Apa yang Berubah?',
        body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _serverCard(
            title: 'Hasil analisis CAPAR',
            values: [
              _detail('Status personal', deviation?['state']),
              _detail('Jarak Mahalanobis', deviation?['distance']),
              _detail('Aktivitas', deviation?['activity']),
              _detail('Kualitas sinyal', deviation?['signal_quality']),
              if (state.followUpPrompt.onsetTime != null)
                'Onset: ${state.followUpPrompt.onsetTime!.toLocal()}',
              if (state.followUpPrompt.peakTime != null)
                'Puncak: ${state.followUpPrompt.peakTime!.toLocal()}',
              if (state.followUpPrompt.mainFactors.isNotEmpty)
                'Fitur berkontribusi terbesar: ${_factorLabel(state.followUpPrompt.mainFactors.first)}',
            ],
          ),
          const SizedBox(height: 14),
          if (!isRequested)
            _messageCard(
              state.followUpPrompt.status == 'already_answered'
                  ? 'Jawaban follow-up untuk deviasi terbaru sudah tercatat di backend.'
                  : 'Tidak ada pertanyaan lanjutan yang diminta CAPAR saat ini.',
            )
          else ...[
            _messageCard(
              state.followUpPrompt.message ??
                  'CAPAR meminta konteks tambahan terkait deviasi ini. Jawaban Anda dicatat sebagai persepsi, bukan bukti penyebab.',
            ),
            if (uncertainty != null) ...[
              const SizedBox(height: 8),
              _uncertaintyMessage(uncertainty),
            ],
            if (state.rawCaparInsights?['capar']?['pedagogy']?['follow_up']
                    ?['safety_notice'] !=
                null) ...[
              const SizedBox(height: 8),
              _messageCard(state.rawCaparInsights!['capar']['pedagogy']
                      ['follow_up']['safety_notice']
                  .toString()),
            ],
            const SizedBox(height: 12),
            ...questions.map(_buildQuestion),
            _questionCard(
              'Jumlah makan hari ini (wajib)',
              TextField(
                controller: _mealCountController,
                keyboardType: TextInputType.number,
                maxLength: 2,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  hintText: 'Masukkan 0 sampai 20',
                  suffixText: 'kali',
                  counterText: '',
                ),
              ),
            ),
            _questionCard(
              'Lokasi saat mengisi konteks (opsional)',
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _location?.placeName ??
                        (_isCapturingLocation
                            ? 'Mengambil lokasi perangkat...'
                            : _locationMessage ??
                                'Lokasi belum disertakan. Izin lokasi diperlukan untuk mengambil koordinat dan nama tempat.'),
                    style:
                        AppTheme.font(size: 12, color: AppTheme.textSecondary),
                  ),
                  if (_location != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Lat ${_location!.latitude.toStringAsFixed(5)}, Lon ${_location!.longitude.toStringAsFixed(5)}',
                      style: AppTheme.font(size: 11, color: AppTheme.textMuted),
                    ),
                  ],
                  if (_locationMessage != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      _locationMessage!,
                      style: AppTheme.font(size: 11, color: AppTheme.textMuted),
                    ),
                  ],
                  TextButton.icon(
                    onPressed: _isCapturingLocation ? null : _captureLocation,
                    icon: const Icon(Icons.my_location),
                    label: Text(_location == null
                        ? 'Ambil lokasi sekarang'
                        : 'Perbarui lokasi'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            _messageCard(
              'Opsional: jika Anda sudah melakukan suatu langkah atas keputusan sendiri, catat apa yang dilakukan dan bagaimana Anda merasakannya setelah itu. Ini adalah laporan pribadi, bukan penilaian efektivitas atau anjuran tindakan.',
            ),
            _questionCard(
              'Langkah yang saya lakukan (opsional)',
              TextField(
                controller: _textAnswers.putIfAbsent(
                    'action_taken_feedback', TextEditingController.new),
                maxLines: 2,
                maxLength: 300,
                decoration: const InputDecoration(
                    hintText: 'Catat langkah yang sudah dilakukan'),
              ),
            ),
            _questionCard(
              'Respons yang saya rasakan setelahnya (opsional)',
              TextField(
                controller: _textAnswers.putIfAbsent(
                    'response_after_action_feedback',
                    TextEditingController.new),
                maxLines: 2,
                maxLength: 500,
                decoration: const InputDecoration(
                    hintText: 'Catat perubahan yang Anda rasakan'),
              ),
            ),
            if (!_hasRequiredContext())
              _messageCard(
                'Untuk merekam konteks deviasi, pilih aktivitas, sedikitnya satu faktor (atau “tidak tahu”), dan jumlah makan.',
              ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isSubmitting ||
                        (isRequested && !_hasRequiredContext())
                    ? null
                    : () => _submit(state),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Kirim jawaban ke server'),
              ),
            ),
          ],
          const SizedBox(height: 14),
          OutlinedButton(
            onPressed: isRequested
                ? null
                : () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const WhyScreen()),
                    ),
            child: const Text('Lihat faktor CAPAR yang berkontribusi'),
          ),
        ],
      ),
      ),
    );
  }

  Widget _buildQuestion(Map<String, dynamic> question) {
    final id = question['id']?.toString() ?? '';
    final prompt = question['question']?.toString() ?? 'Pertanyaan';
    final type = question['input_type']?.toString() ?? '';
    final options =
        (question['options'] as List?)?.map((e) => e.toString()).toList() ??
            const [];

    if (id == 'meal_count') return const SizedBox.shrink();
    if (type == 'text') {
      final controller =
          _textAnswers.putIfAbsent(id, TextEditingController.new);
      return _questionCard(
        prompt,
        TextField(
          controller: controller,
          maxLines: 3,
          maxLength: 500,
          decoration: const InputDecoration(
              hintText: 'Tulis konteks tambahan (opsional)'),
        ),
      );
    }

    final isMultiple = type == 'multi_select';
    final selected = _multipleAnswers.putIfAbsent(id, () => <String>{});
    return _questionCard(
      prompt,
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: options.map((option) {
          final active = isMultiple
              ? selected.contains(option)
              : _singleAnswers[id] == option;
          return FilterChip(
            label: Text(_label(option)),
            selected: active,
            onSelected: (value) {
              setState(() {
                if (isMultiple) {
                  if (value) {
                    selected.add(option);
                    if (option == 'no_known_factor') {
                      selected.removeWhere((e) => e != option);
                    }
                    if (option != 'no_known_factor') {
                      selected.remove('no_known_factor');
                    }
                  } else {
                    selected.remove(option);
                  }
                } else {
                  _singleAnswers[id] = value ? option : '';
                }
              });
            },
          );
        }).toList(),
      ),
    );
  }

  Widget _questionCard(String prompt, Widget input) => Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.borderLight),
          boxShadow: AppTheme.shadowSoft,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(prompt,
                style: AppTheme.font(size: 13.5, weight: FontWeight.w700)),
            const SizedBox(height: 10),
            input,
          ],
        ),
      );

  Widget _serverCard({required String title, required List<String> values}) =>
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.borderLight),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: AppTheme.font(size: 14, weight: FontWeight.w800)),
            const SizedBox(height: 8),
            ...values.map((value) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Text(value,
                      style: AppTheme.font(
                          size: 12.5, color: AppTheme.textSecondary)),
                )),
          ],
        ),
      );

  Widget _messageCard(String message) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.fieldFill,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(message,
            style: AppTheme.font(
                size: 12.5, color: AppTheme.textSecondary, height: 1.35)),
      );

  Widget _uncertaintyMessage(Map<String, dynamic> uncertainty) {
    final status =
        uncertainty['evidence_status']?.toString().replaceAll('_', ' ') ??
            'belum tersedia';
    final interpretation = uncertainty['interpretation']?.toString() ??
        'Penjelasan masih memiliki keterbatasan data.';
    return _messageCard(
      'Batas penjelasan ($status): $interpretation Confidence numerik belum dikalibrasi; jawaban Anda menambahkan konteks, bukan membuktikan penyebab.',
    );
  }

  String _detail(String label, dynamic value) =>
      '$label: ${value == null || value.toString().isEmpty ? 'Belum tersedia' : value}';

  String _label(String option) {
    const labels = {
      'fatigue': 'Lelah',
      'dizziness': 'Pusing',
      'palpitations': 'Jantung terasa berdebar/tidak teratur',
      'breathlessness': 'Sesak napas',
      'chest_pain': 'Nyeri dada',
      'headache': 'Sakit kepala',
      'pain': 'Nyeri',
      'nausea': 'Mual',
      'weakness': 'Lemah',
      'fever': 'Demam',
      'physical_activity': 'Aktivitas fisik',
      'stress': 'Stres',
      'poor_sleep': 'Kurang tidur',
      'medication': 'Obat/intervensi',
      'food_or_caffeine': 'Makanan/kafein',
      'illness': 'Sedang sakit',
      'other': 'Lainnya',
      'no_known_factor': 'Tidak mengetahui faktor',
      'prefer_not_to_say': 'Memilih tidak menjawab',
      'rest': 'Istirahat',
      'sitting': 'Duduk',
      'standing': 'Berdiri',
      'walking': 'Berjalan',
      'exercise': 'Olahraga',
      'work': 'Bekerja',
      'meal': 'Makan',
      'before_deviation': 'Sebelum deviasi',
      'around_deviation': 'Sekitar waktu deviasi',
      'after_deviation': 'Setelah deviasi',
      'unknown': 'Tidak tahu',
    };
    return labels[option] ?? option;
  }

  Future<void> _submit(AppState state) async {
    if (!_hasRequiredContext()) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Pilih aktivitas, faktor konteks (atau “tidak tahu”), dan jumlah makan untuk melanjutkan.',
          ),
        ),
      );
      return;
    }
    final mealCount = int.parse(_mealCountController.text.trim());
    final symptoms =
        _multipleAnswers['current_symptoms']?.toList() ?? <String>[];
    final factors =
        _multipleAnswers['possible_factors']?.toList() ?? <String>[];
    final activity = _singleAnswers['recent_context'];
    final onset = _singleAnswers['symptom_timing'] ?? '';
    final note = _textAnswers['additional_context']?.text.trim() ?? '';
    final actionTaken =
        _textAnswers['action_taken_feedback']?.text.trim() ?? '';
    final responseAfterAction =
        _textAnswers['response_after_action_feedback']?.text.trim() ?? '';

    setState(() => _isSubmitting = true);
    final saved = await state.submitFollowUpResponse(
      symptomCodes: symptoms,
      factors: factors,
      symptomOnset: onset,
      mealCount: mealCount,
      notes: note,
      actionTaken: actionTaken,
      responseAfterAction: responseAfterAction,
      contextActivity: activity!,
      location: _location?.toJson(),
    );
    if (!mounted) return;
    setState(() => _isSubmitting = false);
    if (!saved) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content:
                Text(state.dataError ?? 'Jawaban gagal disimpan ke server.')),
      );
      return;
    }
    showSaved(context, 'Jawaban follow-up tersimpan di server');
    Navigator.pop(context);
  }

  String _factorLabel(Map<String, dynamic> factor) {
    final label = factor['label'] ?? factor['feature'] ?? factor['key'] ?? 'Fitur';
    final contribution =
        factor['contribution_pct'] ?? factor['contribution'] ?? factor['share'];
    return contribution == null ? '$label' : '$label ($contribution)';
  }
}
