import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';
import 'pedagogy_screen_recovery.dart';

class WhyScreen extends StatelessWidget {
  const WhyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final capar = state.rawCaparInsights?['capar'];
    final pedagogy = capar is Map ? capar['pedagogy'] : null;
    final why = pedagogy is Map && pedagogy['why'] is Map
        ? Map<String, dynamic>.from(pedagogy['why'] as Map)
        : <String, dynamic>{};
    final physiological = _items(why['physiological_contributors']);
    final contextFactors = _items(why['candidate_context_contributors']);
    final status = why['explanation_status']?.toString();
    final uncertainty = why['reasoning_uncertainty'] is Map
        ? Map<String, dynamic>.from(why['reasoning_uncertainty'] as Map)
        : null;
    final conflicts = _items(why['evidence_conflicts']);
    final evidence = why['scientific_evidence'];
    final citations = evidence is List
        ? evidence
            .whereType<Map>()
            .map((item) => ScientificCitation.fromJson(
                Map<String, dynamic>.from(item)))
            .where((citation) => citation.title.isNotEmpty)
            .toList()
        : const <ScientificCitation>[];

    return MockupScaffold(
      title: 'Mengapa?',
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _section(
            title: 'Kontributor fisiologis',
            subtitle: status == null ? 'Penjelasan belum tersedia dari backend.' : 'Status penjelasan CAPAR: $status',
            items: physiological,
            contextFactors: false,
          ),
          const SizedBox(height: 12),
          _section(
            title: 'Konteks yang mungkin berkaitan',
            subtitle: 'Konteks pasien dan data CAPAR merupakan asosiasi yang mungkin; bukan bukti sebab-akibat.',
            items: contextFactors,
            contextFactors: true,
          ),
          const SizedBox(height: 12),
          if (uncertainty != null) ...[
            _uncertaintyCard(uncertainty, conflicts),
            const SizedBox(height: 12),
          ],
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.statusYellowBg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.statusYellow.withValues(alpha: 0.35)),
            ),
            child: Text(
              'Tingkat tinggi/sedang/rendah pada faktor fisiologis ditentukan dari jarak z-score terhadap baseline untuk aktivitas dan waktu yang sama. Ini bukan probabilitas penyebab. Faktor konteks hanya menunjukkan keterkaitan yang tercatat; hubungan sebab-akibat belum terbukti.',
              style: AppTheme.font(size: 12, color: AppTheme.textSecondary, height: 1.35),
            ),
          ),
          if (citations.isNotEmpty) ...[
            const SizedBox(height: 18),
            Text('Evidence RAG dari backend', style: AppTheme.font(size: 14, weight: FontWeight.w800)),
            const SizedBox(height: 8),
            ...citations.map(_citationCard),
          ],
          if (citations.isEmpty) ...[
            const SizedBox(height: 12),
            Text(
              state.dataError ?? 'Evidence RAG belum tersedia dari backend.',
              style: AppTheme.font(size: 12, color: AppTheme.textMuted),
            ),
          ],
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const RecoveryScreen()),
            ),
            child: const Text('Lihat durasi dan pemulihan'),
          ),
        ],
      ),
    );
  }

  List<Map<String, dynamic>> _items(dynamic source) {
    if (source is! List || source.isEmpty) return const [];
    return source
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Widget _uncertaintyCard(
    Map<String, dynamic> uncertainty,
    List<Map<String, dynamic>> conflicts,
  ) {
    final status = uncertainty['evidence_status']?.toString() ?? 'Belum tersedia';
    final statusLabel = switch (status) {
      'conflicting_evidence' => 'Bukti berbeda',
      'insufficient_evidence' => 'Bukti belum cukup',
      'limited_evidence' => 'Bukti terbatas',
      'evidence_available_with_limits' => 'Bukti tersedia dengan batasan',
      _ => status.replaceAll('_', ' '),
    };
    final statusColor = status == 'conflicting_evidence'
        ? AppTheme.statusOrange
        : status == 'insufficient_evidence' || status == 'limited_evidence'
            ? AppTheme.statusYellow
            : AppTheme.primary;
    final dimensions = uncertainty['evidence_dimensions'] is Map
        ? Map<String, dynamic>.from(uncertainty['evidence_dimensions'] as Map)
        : <String, dynamic>{};
    final dimensionLabels = {
      'physiological_evidence': 'Bukti fisiologis',
      'personal_baseline': 'Baseline personal',
      'multivariate_contribution': 'Kontribusi multivariat',
      'context_evidence': 'Konteks tercatat',
      'signal_quality': 'Kualitas sinyal',
    };
    final interpretation = uncertainty['interpretation']?.toString();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: statusColor.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: statusColor.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Batas dan ketidakpastian penjelasan',
              style: AppTheme.font(size: 14, weight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(statusLabel,
              style: AppTheme.font(
                  size: 12, weight: FontWeight.w700, color: statusColor)),
          if (interpretation != null && interpretation.isNotEmpty) ...[
            const SizedBox(height: 5),
            Text(interpretation,
                style: AppTheme.font(
                    size: 12, color: AppTheme.textSecondary, height: 1.35)),
          ],
          const SizedBox(height: 8),
          Text(
            'Confidence numerik belum dikalibrasi. Faktor dan konteks yang ditampilkan bukan probabilitas atau kepastian penyebab.',
            style: AppTheme.font(
                size: 11.5, color: AppTheme.textSecondary, height: 1.35),
          ),
          if (dimensions.isNotEmpty) ...[
            const SizedBox(height: 9),
            ...dimensionLabels.entries.map((entry) {
              final value = dimensions[entry.key];
              final available = value is Map && value['available'] == true;
              return Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Text(
                  '${available ? 'Tersedia' : 'Belum tersedia'}: ${entry.value}',
                  style: AppTheme.font(size: 11, color: AppTheme.textMuted),
                ),
              );
            }),
          ],
          if (conflicts.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text('Bukti yang tidak selaras',
                style: AppTheme.font(size: 12, weight: FontWeight.w700)),
            ...conflicts.map((conflict) {
              final evidence = _items(conflict['evidence']);
              final details = evidence
                  .map((item) =>
                      '${item['source'] ?? 'Sumber'}: ${item['value'] ?? 'tidak tersedia'}')
                  .join(' • ');
              return Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  details.isEmpty
                      ? conflict['description']?.toString() ??
                          'Sumber data berbeda; tidak ada sumber yang dipilih sebagai benar.'
                      : '$details. Tidak ada sumber yang dipilih sebagai benar.',
                  style: AppTheme.font(
                      size: 11.5,
                      color: AppTheme.textSecondary,
                      height: 1.35),
                ),
              );
            }),
          ],
        ],
      ),
    );
  }

  String _label(Map<String, dynamic> item) {
    const labels = {
      'hr_mean': 'Denyut jantung rata-rata',
      'hr_delta': 'Perubahan denyut jantung',
      'hr_slope': 'Arah kenaikan denyut jantung',
      'sdnn': 'Variabilitas denyut jantung (SDNN)',
      'rmssd': 'Variabilitas denyut jantung (RMSSD)',
      'dfa_alpha1': 'Pola DFA α1',
      'motion_index': 'Intensitas gerak',
      'physical_activity': 'Aktivitas fisik',
      'stress': 'Stres',
      'poor_sleep': 'Kurang tidur',
      'medication': 'Obat/intervensi',
      'food_or_caffeine': 'Makanan/kafein',
      'illness': 'Kondisi sakit',
      'pain': 'Nyeri/ketidaknyamanan',
    };
    final key = (item['label'] ?? item['type'] ?? item['feature'] ?? item['name'] ?? 'Faktor').toString();
    return labels[key] ?? key.replaceAll('_', ' ');
  }

  String _level(Map<String, dynamic> item, bool contextFactors) {
    if (contextFactors) {
      return item['evidence_level'] == 'concordant_rule_evidence'
          ? 'Selaras'
          : 'Konteks';
    }
    switch (item['deviation_level']) {
      case 'significant':
        return 'Tinggi';
      case 'mild':
        return 'Sedang';
      case 'within_personal_variation':
        return 'Rendah';
      default:
        final zScore = (item['z_score'] as num?)?.abs();
        if (zScore == null) return 'Belum tersedia';
        return zScore >= 2 ? 'Tinggi' : zScore >= 1 ? 'Sedang' : 'Rendah';
    }
  }

  String _detail(Map<String, dynamic> item, bool contextFactors) {
    if (contextFactors) {
      final evidence = item['evidence'] is List
          ? (item['evidence'] as List).join(', ')
          : null;
      return evidence?.replaceAll('_', ' ') ??
          'Konteks tercatat berdekatan dengan deviasi; belum menunjukkan sebab.';
    }
    final value = item['value'];
    final unit = item['unit']?.toString() ?? '';
    final baseline = item['baseline_mean'];
    final zScore = item['z_score'];
    final contribution = item['contribution_share'];
    return [
      if (value != null) 'Saat ini $value $unit'.trim(),
      if (baseline != null) 'Rerata baseline aktivitas ini $baseline $unit'.trim(),
      if (zScore != null) 'z-score $zScore',
      if (contribution is num)
        'Kontribusi Mahalanobis ${(contribution * 100).toStringAsFixed(1)}%',
    ].join(' • ');
  }

  Widget _section({
    required String title,
    required String subtitle,
    required List<Map<String, dynamic>> items,
    required bool contextFactors,
  }) {
    return Container(
      width: double.infinity,
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
          Text(title, style: AppTheme.font(size: 14, weight: FontWeight.w800)),
          const SizedBox(height: 5),
          Text(subtitle, style: AppTheme.font(size: 12, color: AppTheme.textSecondary, height: 1.35)),
          const SizedBox(height: 8),
          if (items.isEmpty)
            Text('Belum tersedia dari backend.', style: AppTheme.font(size: 12, color: AppTheme.textMuted))
          else
            ...items.map((item) {
              final level = _level(item, contextFactors);
              final color = level == 'Tinggi'
                  ? AppTheme.statusOrange
                  : level == 'Sedang' || level == 'Selaras'
                      ? AppTheme.statusYellow
                      : level == 'Rendah'
                          ? AppTheme.statusGreen
                          : AppTheme.textMuted;
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.circle, size: 6, color: AppTheme.primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(_label(item),
                                    style: AppTheme.font(
                                        size: 12.5,
                                        weight: FontWeight.w700)),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 7, vertical: 2),
                                decoration: BoxDecoration(
                                  color: color.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(level,
                                    style: AppTheme.font(
                                        size: 10,
                                        weight: FontWeight.w700,
                                        color: color)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(_detail(item, contextFactors),
                              style: AppTheme.font(
                                  size: 11.5,
                                  color: AppTheme.textSecondary,
                                  height: 1.3)),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _citationCard(ScientificCitation citation) => Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.borderLight),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(citation.title, style: AppTheme.font(size: 12.5, weight: FontWeight.w700)),
            if (citation.summary.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(citation.summary, style: AppTheme.font(size: 11.5, color: AppTheme.textSecondary)),
            ],
            Text(
              [citation.authors, citation.source, citation.year].where((value) => value.isNotEmpty).join(' • '),
              style: AppTheme.font(size: 10.5, color: AppTheme.textMuted),
            ),
          ],
        ),
      );
}
