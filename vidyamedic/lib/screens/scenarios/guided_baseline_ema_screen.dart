import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/app_state.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

class GuidedBaselineEmaScreen extends StatefulWidget {
  const GuidedBaselineEmaScreen({
    super.key,
    required this.stageResults,
  });

  final List<Map<String, dynamic>> stageResults;

  @override
  State<GuidedBaselineEmaScreen> createState() =>
      _GuidedBaselineEmaScreenState();
}

class _GuidedBaselineEmaScreenState extends State<GuidedBaselineEmaScreen> {
  final _noteController = TextEditingController();
  String? _feeling;
  String? _error;
  bool _saving = false;

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _saveEma() async {
    if (_feeling == null || _saving) {
      if (_feeling == null) {
        setState(() => _error = 'Pilih jawaban yang paling sesuai.');
      }
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    final response = await ApiService.createEvent({
      'event_type': 'ema',
      'occurred_at': DateTime.now().toUtc().toIso8601String(),
      'details': 'EMA sesi perekaman baseline terpandu.',
      'value': {
        'instrument': 'guided_baseline_session',
        'version': 1,
        'feeling': _feeling,
        'note': _noteController.text.trim(),
        'samples': widget.stageResults
            .map(
              (item) => {
                'activity': item['activity'],
                'skipped': item['skipped'],
                'incomplete': item['incomplete'],
                'reading_count': item['reading_count'],
                'window_count': item['window_count'],
                'rr_interval_count': item['rr_interval_count'],
                'minimum_hr': item['minimum_hr'],
                'maximum_hr': item['maximum_hr'],
              },
            )
            .toList(),
      },
      'unit': 'baseline_session',
    });
    if (!mounted) return;
    if (!response.success) {
      setState(() {
        _saving = false;
        _error = response.message ?? 'Jawaban EMA belum berhasil disimpan.';
      });
      return;
    }
    await context.read<AppState>().fetchRecentEvents();
    if (mounted) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final recorded = widget.stageResults
        .where((item) => item['skipped'] != true && item['incomplete'] != true)
        .length;
    final skipped =
        widget.stageResults.where((item) => item['skipped'] == true).length;
    final partial =
        widget.stageResults.where((item) => item['incomplete'] == true).length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Tahap 7 · Pengalaman Anda'),
        leading: IconButton(
          tooltip: 'Kembali ke interpretasi',
          onPressed: _saving ? null : () => Navigator.pop(context, false),
          icon: const Icon(Icons.arrow_back_rounded),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _stepProgress(),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Catatan pengalaman sesi',
                      style: AppTheme.font(size: 17, weight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  Text(
                    'Setelah melihat ringkasan rekaman, bagaimana pengalaman Anda? Jawaban ini merupakan laporan pribadi dan tidak mengubah atau menggantikan hasil sensor.',
                    style: AppTheme.font(
                        size: 12, color: AppTheme.textSecondary, height: 1.4),
                  ),
                ],
              ),
            ),
          ),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Rangkuman pengukuran',
                      style: AppTheme.font(size: 14, weight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(
                    '$recorded konteks terekam · $partial dihentikan lebih awal · $skipped dilewati',
                    style: AppTheme.font(
                        size: 11.5,
                        color: AppTheme.textSecondary,
                        height: 1.35),
                  ),
                  const SizedBox(height: 10),
                  ...widget.stageResults.map(_sampleSummary),
                ],
              ),
            ),
          ),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Bagaimana perasaan Anda?',
                      style: AppTheme.font(size: 14, weight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: const [
                      ('calmer', 'Lebih tenang'),
                      ('same', 'Sama seperti awal'),
                      ('more_tired', 'Lebih lelah'),
                      ('uncomfortable', 'Tidak nyaman'),
                    ]
                        .map(
                          (answer) => ChoiceChip(
                            label: Text(answer.$2),
                            selected: _feeling == answer.$1,
                            onSelected: _saving
                                ? null
                                : (selected) => setState(() {
                                      _feeling = selected ? answer.$1 : null;
                                      _error = null;
                                    }),
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _noteController,
                    enabled: !_saving,
                    maxLength: 120,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Catatan pengalaman (opsional)',
                      hintText: 'Tuliskan hal yang ingin Anda sampaikan',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 4),
            _message(_error!),
          ],
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: _saving ? null : _saveEma,
            icon: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.save_outlined),
            label: Text(_saving ? 'Menyimpan...' : 'Simpan pengalaman'),
          ),
          const SizedBox(height: 12),
          Text(
            'Jika belum ingin menjawab, Anda bisa kembali tanpa menyimpan. Catatan ini tidak dianggap sebagai hasil fisiologis.',
            style: AppTheme.font(
                size: 10.5, color: AppTheme.textMuted, height: 1.35),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _stepProgress() => Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.format_list_numbered_rounded,
                      color: AppTheme.primary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text('Layar 7 dari 7',
                        style:
                            AppTheme.font(size: 13, weight: FontWeight.w800)),
                  ),
                  Text('EMA',
                      style: AppTheme.font(
                          size: 11,
                          weight: FontWeight.w700,
                          color: AppTheme.primary)),
                ],
              ),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: const LinearProgressIndicator(
                  value: 1,
                  minHeight: 6,
                  backgroundColor: AppTheme.fieldFill,
                  color: AppTheme.primary,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Persiapan → rekaman → profil → perubahan → koreksi → interpretasi → pengalaman',
                style: AppTheme.font(
                    size: 10.5, color: AppTheme.textSecondary, height: 1.35),
              ),
            ],
          ),
        ),
      );

  Widget _sampleSummary(Map<String, dynamic> sample) {
    const labels = {
      'sitting': 'Duduk',
      'standing': 'Berdiri',
      'walking': 'Berjalan',
    };
    final activity = labels[sample['activity']] ?? 'Konteks';
    final status = sample['skipped'] == true
        ? 'Dilewati'
        : sample['incomplete'] == true
            ? 'Dihentikan sebelum selesai'
            : 'Terekam';
    final minimum = sample['minimum_hr'];
    final maximum = sample['maximum_hr'];
    return ListTile(
      contentPadding: EdgeInsets.zero,
      dense: true,
      leading: Icon(
        sample['skipped'] == true ? Icons.skip_next : Icons.sensors_outlined,
        color:
            sample['skipped'] == true ? AppTheme.textMuted : AppTheme.primary,
      ),
      title: Text(activity,
          style: AppTheme.font(size: 12, weight: FontWeight.w700)),
      subtitle: Text(
        '$status · HR minimum ${minimum ?? '—'} bpm · HR maksimum ${maximum ?? '—'} bpm · ${sample['reading_count'] ?? 0} titik · ${sample['rr_interval_count'] ?? 0} interval RR/IBI',
        style: AppTheme.font(
            size: 10.5, color: AppTheme.textSecondary, height: 1.3),
      ),
    );
  }

  Widget _message(String text) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF1F0),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(text,
            style: AppTheme.font(
                size: 11.5, color: AppTheme.textSecondary, height: 1.35)),
      );
}
