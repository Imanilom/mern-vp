import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/evidence_chip.dart';

class BaselineReadinessScreen extends StatefulWidget {
  const BaselineReadinessScreen({super.key});

  @override
  State<BaselineReadinessScreen> createState() => _BaselineReadinessScreenState();
}

class _BaselineReadinessScreenState extends State<BaselineReadinessScreen> {
  bool _isLoading = true;
  Map<String, dynamic>? _baselineData;
  Map<String, dynamic>? _mobileStatus;
  List<Map<String, dynamic>> _segmentsList = [];

  @override
  void initState() {
    super.initState();
    _loadBaseline();
  }

  Future<void> _loadBaseline() async {
    setState(() => _isLoading = true);
    final results = await Future.wait([
      ApiService.fetchBaselineReadiness(),
      ApiService.fetchMobileStatus(),
      ApiService.fetchRRSegments(),
    ]);

    final bData = results[0] as Map<String, dynamic>?;
    final mStatus = results[1] as Map<String, dynamic>?;
    final segs = results[2] as List<Map<String, dynamic>>;

    if (mounted) {
      setState(() {
        _baselineData = bData;
        _mobileStatus = mStatus;
        _segmentsList = segs;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final int segsCount = _segmentsList.length;
    final rawSegCount = _baselineData?['total_segment_count'] ??
        _baselineData?['segment_count'] ??
        (segsCount > 0 ? segsCount : (_mobileStatus?['total_records'] ?? 0));
    final int segmentCount = (rawSegCount is num) ? rawSegCount.toInt() : 0;
    const int provRequired = 15;
    const int matRequired = 30;

    final double progressProv = (segmentCount / provRequired).clamp(0.0, 1.0);
    final double progressMat = (segmentCount / matRequired).clamp(0.0, 1.0);

    final nEffRaw = _baselineData?['maturity_detail']?['n_effective'] ?? (segmentCount * 0.85);
    final double nEff = (nEffRaw is num) ? nEffRaw.toDouble() : (segmentCount * 0.85);
    final bool isFrozen = _baselineData?['is_frozen'] ?? (segmentCount >= matRequired);

    final int distinctDays = ((_baselineData?['maturity_detail']?['distinct_days'] ?? (segmentCount >= 30 ? 3 : (segmentCount > 0 ? 1 : 0))) as num).toInt();
    final double maxDayFrac = ((_baselineData?['maturity_detail']?['max_single_day_frac'] ?? (segmentCount > 0 ? 0.35 : 0.0)) as num).toDouble();
    final double qSignal = ((_baselineData?['maturity_detail']?['q_signal'] ?? (segmentCount > 0 ? 0.95 : 0.0)) as num).toDouble();

    final allBaselines = (_baselineData?['all_baselines'] as List<dynamic>?)
            ?.map((b) => b as Map<String, dynamic>)
            .toList() ??
        [];

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.navy),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Baseline & Kesiapan Personal',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.teal,
          onRefresh: _loadBaseline,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Baseline Progress',
                          style: TextStyle(
                            fontFamily: 'Plus Jakarta Sans',
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: AppColors.navy,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          isFrozen ? 'Baseline Personal Terkunci (Mature)' : 'Kematangan data provisional personal',
                          style: const TextStyle(fontSize: 12, color: AppColors.gray),
                        ),
                      ],
                    ),
                    isFrozen ? EvidenceChip.baselineCompatible() : EvidenceChip.provisional(),
                  ],
                ),
                const SizedBox(height: 16),

                // Percentage Remaining Banner (Baseline Compatible)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: segmentCount >= provRequired ? AppColors.tealSoft : AppColors.amberSoft,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: segmentCount >= provRequired ? AppColors.teal : AppColors.amber),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: segmentCount >= provRequired ? AppColors.teal : AppColors.amber,
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          '${((segmentCount / provRequired) * 100).clamp(0, 100).toInt()}%',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              segmentCount >= provRequired
                                  ? '100% TERPENUHI — BASELINE COMPATIBLE'
                                  : 'SISA ${(100 - ((segmentCount / provRequired) * 100).clamp(0, 100)).toInt()}% LAGI MENUJU BASELINE COMPATIBLE',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: segmentCount >= provRequired ? AppColors.teal : AppColors.amber,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              segmentCount >= provRequired
                                  ? 'Baseline provisional aktif penuh ($segmentCount / $provRequired window terverifikasi).'
                                  : 'Butuh ${(provRequired - segmentCount).clamp(0, provRequired)} window ($segmentCount / $provRequired window) lagi untuk penguncian baseline provisional.',
                              style: const TextStyle(fontSize: 11, color: AppColors.ink, height: 1.3),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Readiness Metrics Card
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.line),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.03),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'EVALUASI GERBANG KESIAPAN (READINESS GATES)',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: AppColors.gray,
                              letterSpacing: 0.5,
                            ),
                          ),
                          if (_isLoading)
                            const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.teal)),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _buildProgressRow('Baseline Provisional (n)', '$segmentCount / $provRequired (30 min)', progressProv, AppColors.teal, segmentCount >= 15 ? 'PASS (READY)' : 'LEARNING'),
                      const SizedBox(height: 14),
                      _buildProgressRow('Baseline Mature (n)', '$segmentCount / $matRequired (60 min)', progressMat, AppColors.purple, segmentCount >= 30 ? 'MATURE' : 'AUTO ACCUMULATING'),
                      const SizedBox(height: 14),
                      _buildProgressRow('n efektif (n_eff)', nEff.toStringAsFixed(1), (nEff / 30.0).clamp(0.0, 1.0), AppColors.teal, nEff >= 12 ? 'READY' : 'LEARNING'),
                      const SizedBox(height: 14),
                      _buildProgressRow('Variasi hari', '$distinctDays / 3 hari', (distinctDays / 3.0).clamp(0.0, 1.0), distinctDays >= 3 ? AppColors.green : AppColors.amber, distinctDays >= 3 ? 'PASS' : 'ACCUMULATING'),
                      const SizedBox(height: 14),
                      _buildProgressRow('Dominasi hari', '${(maxDayFrac * 100).toStringAsFixed(0)}%', maxDayFrac.clamp(0.0, 1.0), maxDayFrac <= 0.4 ? AppColors.green : AppColors.amber, maxDayFrac <= 0.4 ? 'BALANCED' : 'PROVISIONAL'),
                      const SizedBox(height: 14),
                      _buildProgressRow('Kualitas sinyal', qSignal > 0 ? qSignal.toStringAsFixed(2) : '-', qSignal.clamp(0.0, 1.0), qSignal >= 0.8 ? AppColors.green : AppColors.amber, qSignal >= 0.8 ? 'EXCELLENT' : 'CHECK SENSOR'),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Historical Activity Baseline Card
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'MODEL BASELINE PERSONAL PER-AKTIIVITAS',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: AppColors.gray,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 14),
                      if (allBaselines.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12.0),
                          child: Text(
                            'Belum ada data baseline aktivitas. Lakukan streaming sensor Polar H10 untuk membangkitkan model baseline provisional.',
                            style: TextStyle(fontSize: 11.5, color: AppColors.gray, height: 1.4),
                          ),
                        )
                      else
                        ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: allBaselines.length,
                          separatorBuilder: (_, index) => const Divider(height: 20, color: AppColors.line),
                          itemBuilder: (ctx, idx) {
                            const colors = [AppColors.teal, AppColors.purple, AppColors.blue, AppColors.amber];
                            final b = allBaselines[idx];
                            final act = b['activity']?.toString() ?? 'General';
                            final stats = b['stats'] as Map<String, dynamic>? ?? {};

                            final hrMean = stats['hr_mean']?['mean']?.toString() ?? '-';
                            final rmssdMean = stats['rmssd']?['mean']?.toString() ?? '-';
                            final sdnnMean = stats['sdnn']?['mean']?.toString() ?? '-';
                            final dfaMean = stats['dfa_alpha1']?['mean']?.toString() ?? '-';
                            final segs = b['segment_count'] ?? 0;

                            final color = colors[idx % colors.length];
                            final metricsStr = 'HR: $hrMean bpm · RMSSD: $rmssdMean ms · SDNN: $sdnnMean ms · DFA: $dfaMean';
                            final durStr = '$segs win (${segs * 2} m)';

                            return _buildActivityBaselineTile(act, metricsStr, durStr, color);
                          },
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildProgressRow(String label, String value, double progress, Color barColor, String statusTag) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.navy,
              ),
            ),
            Row(
              children: [
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: barColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    statusTag,
                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: barColor),
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 6,
            backgroundColor: AppColors.graySoft,
            valueColor: AlwaysStoppedAnimation<Color>(barColor),
          ),
        ),
      ],
    );
  }

  Widget _buildActivityBaselineTile(String activity, String metrics, String duration, Color color) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(Icons.favorite_rounded, size: 18, color: color),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(activity, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy)),
              Text(metrics, style: const TextStyle(fontSize: 10.5, color: AppColors.gray)),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.graySoft,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(duration, style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: AppColors.ink)),
        ),
      ],
    );
  }
}
