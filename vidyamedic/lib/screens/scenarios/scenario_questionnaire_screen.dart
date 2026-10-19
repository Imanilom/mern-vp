import 'package:flutter/material.dart';

import '../../services/api_service.dart';

enum ScenarioQuestionnaireType { sus, nasaTlx }

class ScenarioQuestionnaireScreen extends StatefulWidget {
  const ScenarioQuestionnaireScreen({
    required this.sessionId,
    required this.type,
    super.key,
  });

  final String sessionId;
  final ScenarioQuestionnaireType type;

  @override
  State<ScenarioQuestionnaireScreen> createState() =>
      _ScenarioQuestionnaireScreenState();
}

class _ScenarioQuestionnaireScreenState
    extends State<ScenarioQuestionnaireScreen> {
  static const _susQuestions = <String>[
    'Saya berpikir akan sering menggunakan Vidyamedic.',
    'Saya merasa Vidyamedic rumit untuk digunakan.',
    'Saya merasa Vidyamedic mudah digunakan.',
    'Saya pikir saya memerlukan bantuan dari orang lain untuk dapat menggunakan Vidyamedic.',
    'Saya merasa berbagai fungsi dalam Vidyamedic terintegrasi dengan baik.',
    'Saya merasa terdapat terlalu banyak ketidakkonsistenan dalam Vidyamedic.',
    'Saya merasa kebanyakan orang akan cepat mempelajari cara menggunakan Vidyamedic.',
    'Saya merasa Vidyamedic membingungkan.',
    'Saya merasa tidak ada hambatan dalam menggunakan Vidyamedic.',
    'Saya perlu membiasakan diri terlebih dahulu sebelum dapat menggunakan Vidyamedic.',
  ];

  static const _tlxDimensions = <String, String>{
    'mental_demand': 'Beban mental',
    'physical_demand': 'Beban fisik',
    'temporal_demand': 'Tekanan waktu',
    'performance': 'Kinerja',
    'effort': 'Usaha',
    'frustration': 'Frustrasi',
  };

  static const _tlxDescriptions = <String, String>{
    'mental_demand':
        'Seberapa besar usaha berpikir dan memahami informasi yang Anda rasakan?',
    'physical_demand':
        'Seberapa besar aktivitas fisik yang diperlukan untuk menggunakan Vidyamedic?',
    'temporal_demand':
        'Seberapa besar tekanan waktu yang Anda rasakan saat menyelesaikan tugas?',
    'performance':
        'Seberapa tidak berhasil atau tidak puas Anda merasa dalam menyelesaikan tugas?',
    'effort': 'Seberapa besar usaha mental dan fisik yang Anda keluarkan?',
    'frustration':
        'Seberapa besar perasaan kesal, tidak nyaman, atau tertekan yang Anda rasakan?',
  };

  final List<int?> _susResponses = List<int?>.filled(10, null);
  final Map<String, int?> _tlxResponses = {
    for (final dimension in _tlxDimensions.keys) dimension: null,
  };
  bool _busy = false;
  String? _error;

  bool get _isSus => widget.type == ScenarioQuestionnaireType.sus;

  bool get _isComplete => _isSus
      ? _susResponses.every((response) => response != null)
      : _tlxResponses.values.every((response) => response != null);

  String get _instrument => _isSus ? 'SUS' : 'NASA_TLX';

  Future<void> _submit() async {
    if (!_isComplete || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final responses = _isSus
        ? _susResponses.cast<int>()
        : _tlxResponses.map((key, value) => MapEntry(key, value!));
    final result = await ApiService.submitPatientScenarioQuestionnaire(
      sessionId: widget.sessionId,
      instrument: _instrument,
      responses: responses,
    );
    if (!mounted) return;
    if (!result.success) {
      setState(() {
        _busy = false;
        _error = result.message ?? 'Kuesioner belum dapat disimpan.';
      });
      return;
    }
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final title = _isSus ? 'Kuesioner SUS' : 'Kuesioner NASA-TLX';
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              FilledButton.icon(
                onPressed: _busy || !_isComplete ? null : _submit,
                icon: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_outlined),
                label: Text(_busy ? 'Menyimpan...' : 'Kirim kuesioner'),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                ),
              ),
              if (!_isComplete)
                const Padding(
                  padding: EdgeInsets.only(top: 6),
                  child: Text(
                    'Lengkapi semua jawaban sebelum mengirim.',
                    textAlign: TextAlign.center,
                  ),
                ),
            ],
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            color: const Color(0xFFEFF8F4),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                _isSus
                    ? 'Nilai pengalaman Anda menggunakan Vidyamedic pada sesi skenario C. Pilih satu jawaban untuk setiap pernyataan; 1 berarti sangat tidak setuju dan 5 sangat setuju.'
                    : 'Nilai beban kerja yang Anda rasakan selama sesi skenario C. Geser setiap skala dari 0 (sangat rendah) sampai 100 (sangat tinggi). Skor yang dilaporkan adalah rata-rata enam dimensi tanpa pembobotan.',
              ),
            ),
          ),
          const SizedBox(height: 12),
          if (_isSus)
            ...List.generate(_susQuestions.length, _susQuestionCard)
          else
            ..._tlxDimensions.entries.map(_tlxQuestionCard),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Card(
              color: const Color(0xFFFFF1F0),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Text(
                  _error!,
                  style: const TextStyle(color: Color(0xFF9F2D20)),
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  Widget _susQuestionCard(int index) {
    final selected = _susResponses[index];
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${index + 1}. ${_susQuestions[index]}',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 10),
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              spacing: 8,
              runSpacing: 8,
              children: List.generate(5, (optionIndex) {
                final value = optionIndex + 1;
                return ChoiceChip(
                  label: Text('$value'),
                  selected: selected == value,
                  onSelected: (_) =>
                      setState(() => _susResponses[index] = value),
                );
              }),
            ),
            const SizedBox(height: 6),
            const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(child: Text('Sangat tidak setuju')),
                Flexible(
                  child: Text('Sangat setuju', textAlign: TextAlign.end),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _tlxQuestionCard(MapEntry<String, String> dimension) {
    final value = _tlxResponses[dimension.key];
    final sliderValue = value?.toDouble() ?? 0;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              dimension.value,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(_tlxDescriptions[dimension.key]!),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: Slider(
                    value: sliderValue,
                    min: 0,
                    max: 100,
                    divisions: 20,
                    label: value?.toString() ?? 'Pilih nilai',
                    onChanged: _busy
                        ? null
                        : (next) => setState(
                              () => _tlxResponses[dimension.key] = next.round(),
                            ),
                  ),
                ),
                SizedBox(
                  width: 68,
                  child: Text(
                    value?.toString() ?? 'Belum dipilih',
                    textAlign: TextAlign.end,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [Text('Sangat rendah'), Text('Sangat tinggi')],
              ),
            ),
            if (dimension.key == 'performance')
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text(
                  'Nilai yang lebih tinggi menunjukkan kinerja yang dirasakan lebih buruk.',
                  style: TextStyle(color: Color(0xFF8A5A00)),
                ),
              ),
            if (value == null)
              const Padding(
                padding: EdgeInsets.only(top: 6),
                child: Text(
                  'Geser skala untuk memilih jawaban; nilai belum dipilih.',
                  style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
