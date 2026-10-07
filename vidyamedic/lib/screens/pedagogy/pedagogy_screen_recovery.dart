import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';
import 'pedagogy_screen_action.dart';

class RecoveryScreen extends StatelessWidget {
  const RecoveryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final capar = state.rawCaparInsights?['capar'];
    final pedagogy = capar is Map ? capar['pedagogy'] : null;
    final recovery = capar is Map && capar['recovery'] is Map
        ? Map<String, dynamic>.from(capar['recovery'] as Map)
        : <String, dynamic>{};
    final persistence = capar is Map && capar['persistence'] is Map
        ? Map<String, dynamic>.from(capar['persistence'] as Map)
        : <String, dynamic>{};
    final episode = pedagogy is Map && pedagogy['how_long'] is Map
        ? Map<String, dynamic>.from(pedagogy['how_long'] as Map)
        : <String, dynamic>{};
    final trajectory = capar is Map && capar['trajectory_24h'] is List
        ? (capar['trajectory_24h'] as List).whereType<Map>().toList()
        : const <Map>[];
    final progress = recovery['recovery_progress_pct'];

    return MockupScaffold(
      title: 'Berapa Lama & Apakah Pulih?',
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _dataCard('Pemulihan', [
            _entry('Status', recovery['state']),
            _entry('Tren deviasi', recovery['distance_trend']),
            _entry('Perubahan jarak per menit',
                recovery['distance_derivative_per_minute']),
            _entry('Waktu pemulihan',
                _withUnit(recovery['time_to_recovery_minutes'], 'menit')),
            _entry('Waktu sejak puncak',
                _withUnit(recovery['time_since_peak_minutes'], 'menit')),
            _entry('Relapse', recovery['relapse_detected']),
            _entry('Progres', _withUnit(progress, '%')),
          ]),
          if (progress is num) ...[
            const SizedBox(height: 10),
            LinearProgressIndicator(
              value: (progress.toDouble() / 100).clamp(0.0, 1.0),
              minHeight: 7,
              borderRadius: BorderRadius.circular(8),
              color: AppTheme.primary,
              backgroundColor: AppTheme.fieldFill,
            ),
          ],
          const SizedBox(height: 12),
          _dataCard('Persistensi deviasi', [
            _entry('Persistent', persistence['persistent']),
            _entry(
                'Dwell time', _withUnit(persistence['dwell_minutes'], 'menit')),
            _entry('Jumlah window', persistence['window_count']),
            _entry('Aturan k-of-m', persistence['rule']),
          ]),
          const SizedBox(height: 12),
          _dataCard('Episode terbaru', [
            _entry('State', episode['state']),
            _entry('Mulai', episode['onset_time']),
            _entry('Puncak', episode['peak_time']),
            _entry('Durasi', _withUnit(episode['elapsed_minutes'], 'menit')),
            _entry('Dwell persisten',
                _withUnit(episode['persistent_dwell_minutes'], 'menit')),
          ]),
          const SizedBox(height: 12),
          Text('Riwayat CAPAR dari backend',
              style: AppTheme.font(size: 14, weight: FontWeight.w800)),
          const SizedBox(height: 8),
          if (trajectory.isEmpty)
            _dataCard('Belum ada riwayat', [
              _entry(
                  'Sumber',
                  state.dataError ??
                      'Belum ada trajectory yang tersedia dari backend.'),
            ])
          else
            ...trajectory.take(20).map((point) => _trajectoryRow(point)),
          const SizedBox(height: 12),
          Text('Evidence RAG pemulihan',
              style: AppTheme.font(size: 14, weight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(
            recovery['rag_status'] == 'retrieved'
                ? 'Literatur difilter untuk CAPAR Recovery Capacity (RC), pemulihan, dan status episode saat ini.'
                : 'Evidence pemulihan muncul saat CAPAR mendeteksi proses pulih, pulih kembali, atau relapse.',
            style: AppTheme.font(
                size: 11.5, color: AppTheme.textSecondary, height: 1.35),
          ),
          const SizedBox(height: 8),
          if (state.recoveryScientificCitations.isEmpty)
            _dataCard('Evidence belum tersedia', [
              _entry(
                  'Status RAG',
                  recovery['rag_status'] == 'not_triggered'
                      ? 'Belum ada state pemulihan aktif untuk dicari.'
                      : state.dataError ?? 'Tidak ada literatur yang cocok.'),
            ])
          else
            ...state.recoveryScientificCitations.map(_citationCard),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ActionGuidanceScreen()),
            ),
            child: const Text('Lihat rekomendasi tindakan'),
          ),
        ],
      ),
    );
  }

  String _entry(String label, dynamic value) =>
      '$label: ${value == null || value.toString().isEmpty ? 'Belum tersedia' : value}';

  String? _withUnit(dynamic value, String unit) =>
      value == null ? null : '$value $unit';

  Widget _dataCard(String title, List<String?> values) => Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 2),
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
            const SizedBox(height: 7),
            ...values.whereType<String>().map((value) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Text(value,
                      style: AppTheme.font(
                          size: 12, color: AppTheme.textSecondary)),
                )),
          ],
        ),
      );

  Widget _trajectoryRow(Map point) {
    final timestamp = DateTime.tryParse(point['recorded_at']?.toString() ?? '');
    final time = timestamp?.toLocal().toString() ?? 'Waktu tidak tersedia';
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.borderLight),
      ),
      child: Text(
        '$time • ${point['personal_state'] ?? point['state'] ?? 'State belum tersedia'} • Mahalanobis ${point['mahalanobis_distance'] ?? '—'}',
        style: AppTheme.font(size: 11.5, color: AppTheme.textSecondary),
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
            Text(citation.title,
                style: AppTheme.font(size: 12.5, weight: FontWeight.w700)),
            if (citation.summary.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(citation.summary,
                  style: AppTheme.font(
                      size: 11.5, color: AppTheme.textSecondary, height: 1.3)),
            ],
            const SizedBox(height: 4),
            Text(
              [
                citation.authors,
                citation.source,
                citation.year,
              ].where((value) => value.isNotEmpty).join(' • '),
              style: AppTheme.font(size: 10.5, color: AppTheme.textMuted),
            ),
          ],
        ),
      );
}
