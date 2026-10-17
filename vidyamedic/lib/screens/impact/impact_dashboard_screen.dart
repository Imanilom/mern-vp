import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/app_state.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';

class ImpactDashboardScreen extends StatefulWidget {
  const ImpactDashboardScreen({super.key});

  @override
  State<ImpactDashboardScreen> createState() => _ImpactDashboardScreenState();
}

class _ImpactDashboardScreenState extends State<ImpactDashboardScreen> {
  int? _checkInCount;
  int? _eventCount;
  int? _reportedActionCount;
  Map<String, dynamic>? _actionStatuses;
  String? _summaryError;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadActivity();
  }

  Future<void> _loadActivity() async {
    setState(() {
      _isLoading = true;
      _summaryError = null;
    });
    final now = DateTime.now().toUtc();
    final from = now.subtract(const Duration(days: 30)).toIso8601String();
    final to = now.toIso8601String();
    final appState = context.read<AppState>();
    final responses = await Future.wait([
      ApiService.getPatientImpactSummary(from: from, to: to),
      appState.fetchCaparInsights(),
    ]);
    final summary = responses[0] as ApiResponse<Map<String, dynamic>>;
    if (!mounted) return;

    final counts = _asMap(summary.data?['counts']);
    setState(() {
      _isLoading = false;
      _summaryError = summary.success && summary.data != null
          ? null
          : summary.message ?? 'Ringkasan dampak gagal dimuat.';
      _checkInCount = counts?['check_ins'] is num
          ? (counts!['check_ins'] as num).toInt()
          : null;
      _eventCount =
          counts?['events'] is num ? (counts!['events'] as num).toInt() : null;
      _reportedActionCount = counts?['reported_patient_actions'] is num
          ? (counts!['reported_patient_actions'] as num).toInt()
          : null;
      _actionStatuses = _asMap(summary.data?['action_statuses']);
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final capar = _asMap(state.rawCaparInsights?['capar']);
    final recovery = _asMap(capar?['recovery']);
    final inventory = _asMap(capar?['data_inventory']);
    final why = _asMap(_asMap(capar?['pedagogy'])?['why']);
    final uncertainty = _asMap(why?['reasoning_uncertainty']);
    final conflicts = uncertainty?['evidence_conflicts'];
    final conflictCount = conflicts is List ? conflicts.length : null;
    final resolved = _number(recovery?['resolved_episodes_30d']);
    final unresolved = _number(recovery?['unresolved_episodes_30d']);
    final denominator = _number(recovery?['recovery_rate_denominator']);
    final recoveryRate = recovery?['observed_episode_recovery_rate_pct'];

    return MockupScaffold(
      title: 'Dampak & Keselamatan',
      trailing: IconButton(
        tooltip: 'Perbarui data dampak',
        onPressed: _isLoading ? null : _loadActivity,
        icon: const Icon(Icons.refresh_rounded, color: AppTheme.primary),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _introCard(),
          const SizedBox(height: 14),
          _sectionCard(
            icon: Icons.favorite_outline_rounded,
            title: 'Outcome yang teramati',
            children: [
              _metricRow(
                'Episode pulih (30 hari)',
                resolved?.toString() ?? 'Belum tersedia',
              ),
              _metricRow(
                'Episode belum pulih (30 hari)',
                unresolved?.toString() ?? 'Belum tersedia',
              ),
              _metricRow(
                'Episode dengan outcome tercatat',
                denominator?.toString() ?? 'Belum tersedia',
              ),
              _metricRow(
                'Proporsi recovery historis',
                recoveryRate is num
                    ? '${recoveryRate.toString()}%'
                    : 'Belum tersedia',
              ),
              const SizedBox(height: 6),
              Text(
                recovery?['recovery_rate_definition']?.toString() ??
                    'Persentase recovery belum tersedia bila tidak ada episode dengan outcome terdokumentasi.',
                style: AppTheme.font(
                    size: 10.5, color: AppTheme.textMuted, height: 1.4),
              ),
              const SizedBox(height: 4),
              Text(
                'Angka ini adalah ringkasan historis CAPAR, bukan prediksi, bukti keberhasilan intervensi, atau diagnosis.',
                style: AppTheme.font(
                    size: 10.5, color: AppTheme.textSecondary, height: 1.4),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _sectionCard(
            icon: Icons.fact_check_outlined,
            title: 'Aktivitas dan tindak lanjut (30 hari)',
            children: [
              if (_isLoading)
                const LinearProgressIndicator()
              else if (_summaryError != null)
                _errorLine(_summaryError!)
              else ...[
                _metricRow('Check-in tersimpan', '$_checkInCount'),
                _metricRow('Event tercatat', '$_eventCount'),
                _metricRow(
                  'Tindakan pribadi yang dilaporkan',
                  '$_reportedActionCount',
                ),
                _metricRow(
                  'Tindakan terstruktur tercatat',
                  _statusTotal().toString(),
                ),
                for (final status in const [
                  'CREATED',
                  'DELIVERED',
                  'ACKNOWLEDGED',
                  'COMPLETED',
                  'FAILED',
                ])
                  _metricRow(
                    'Status $status',
                    _display(_actionStatuses?[status]),
                  ),
              ],
              const SizedBox(height: 6),
              Text(
                'Jumlah catatan menggambarkan penggunaan dan dokumentasi, bukan dampak klinis atau efektivitas tindakan.',
                style: AppTheme.font(
                    size: 10.5, color: AppTheme.textMuted, height: 1.4),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _sectionCard(
            icon: Icons.sensors_outlined,
            title: 'Ketersediaan data dan mutu proses',
            children: [
              _metricRow(
                'Baseline CAPAR',
                _display(inventory?['baselines']),
              ),
              _metricRow(
                'Segmen analisis',
                _display(inventory?['segments_returned']),
              ),
              _metricRow(
                'Analisis episode',
                _display(inventory?['episode_analyses_returned']),
              ),
              _metricRow(
                'Status bukti',
                uncertainty?['evidence_status']?.toString() ?? 'Belum tersedia',
              ),
              _metricRow(
                'Konflik bukti yang ditampilkan',
                conflictCount?.toString() ?? 'Belum tersedia',
              ),
              const SizedBox(height: 6),
              Text(
                'Jumlah data bukan skor kualitas. Audit kualitas sinyal dan performa alert memerlukan indikator backend khusus.',
                style: AppTheme.font(
                    size: 10.5, color: AppTheme.textMuted, height: 1.4),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _sectionCard(
            icon: Icons.privacy_tip_outlined,
            title: 'Keselamatan & tata kelola',
            children: const [
              _AvailabilityRow(
                label: 'False alarm dan alert terlewat',
                value: 'Belum diukur oleh API pasien',
              ),
              _AvailabilityRow(
                label: 'Acknowledgment klinisi dan waktu respons',
                value: 'Integrasi klinisi belum tersedia',
              ),
              _AvailabilityRow(
                label: 'Analitik populasi',
                value: 'Tidak ditampilkan pada akun individual',
              ),
              _AvailabilityRow(
                label: 'Pembaruan model atau kebijakan',
                value: 'Memerlukan validasi dan persetujuan terpisah',
              ),
            ],
          ),
          const SizedBox(height: 12),
          _sectionCard(
            icon: Icons.lightbulb_outline_rounded,
            title: 'Wawasan pencegahan',
            children: const [
              Text(
                'Tidak ada rekomendasi pencegahan baru yang tervalidasi untuk ditampilkan saat ini. Riwayat dan keterkaitan konteks tidak cukup untuk membuktikan penyebab.',
                style: TextStyle(
                    fontSize: 11.5, color: AppTheme.textSecondary, height: 1.4),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _introCard() => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.primarySoft,
          borderRadius: BorderRadius.circular(15),
          border: Border.all(color: AppTheme.borderLight),
        ),
        child: Text(
          'Ringkasan ini mengevaluasi data dan outcome yang memang tercatat pada akun Anda. Metrik yang belum disediakan API ditandai secara eksplisit, bukan diperkirakan.',
          style: AppTheme.font(
              size: 12,
              color: AppTheme.primaryDark,
              weight: FontWeight.w600,
              height: 1.4),
        ),
      );

  Widget _sectionCard({
    required IconData icon,
    required String title,
    required List<Widget> children,
  }) =>
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(15),
          border: Border.all(color: AppTheme.borderLight),
          boxShadow: AppTheme.shadowSoft,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: AppTheme.primary, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(title,
                      style: AppTheme.font(size: 13, weight: FontWeight.w800)),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ...children,
          ],
        ),
      );

  Widget _metricRow(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(label,
                  style: AppTheme.font(size: 11.5, color: AppTheme.textMuted)),
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                value,
                textAlign: TextAlign.right,
                style: AppTheme.font(size: 11.5, weight: FontWeight.w700),
              ),
            ),
          ],
        ),
      );

  Widget _errorLine(String error) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Text(
          error,
          style:
              AppTheme.font(size: 11, color: AppTheme.statusRed, height: 1.35),
        ),
      );

  String _display(dynamic value) =>
      value is num ? value.toString() : 'Belum tersedia';

  int? _number(dynamic value) => value is num ? value.round() : null;

  int _statusTotal() => (_actionStatuses?.values ?? const [])
      .whereType<num>()
      .fold(0, (total, value) => total + value.toInt());

  Map<String, dynamic>? _asMap(dynamic value) =>
      value is Map ? Map<String, dynamic>.from(value) : null;
}

class _AvailabilityRow extends StatelessWidget {
  const _AvailabilityRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: AppTheme.font(size: 11.5, weight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(value,
                style: AppTheme.font(size: 10.5, color: AppTheme.textMuted)),
          ],
        ),
      );
}
