import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../theme/app_colors.dart';
import '../../widgets/evidence_chip.dart';
import '../../services/api_service.dart';

class BaselineReadinessScreen extends StatefulWidget {
  const BaselineReadinessScreen({super.key});

  @override
  State<BaselineReadinessScreen> createState() => _BaselineReadinessScreenState();
}

class _BaselineReadinessScreenState extends State<BaselineReadinessScreen> {
  bool isLoading = true;

  // Baseline readiness fields
  String windowCount = '—';
  double windowProgress = 0.0;
  String nEff = '—';
  double nEffProgress = 0.0;
  String uniqueDays = '—';
  double uniqueDaysProgress = 0.0;
  String dayDominance = '—';
  double dayDominanceProgress = 0.0;
  String qualityScore = '—';
  double qualityProgress = 0.0;

  bool isReady = false;

  @override
  void initState() {
    super.initState();
    _loadBaseline();
  }

  Future<void> _loadBaseline() async {
    setState(() => isLoading = true);

    final prefs = await SharedPreferences.getInstance();
    final uid = prefs.getString('user_id') ?? '';

    if (uid.isEmpty) {
      if (mounted) setState(() => isLoading = false);
      return;
    }

    try {
      final res = await ApiService.getUserBaselines(uid);
      if (res != null && mounted) {
        final payload = res is Map ? (res['data'] ?? res) : <String, dynamic>{};
        final baselines = payload is List ? payload : (payload['baselines'] ?? [payload]);

        if (baselines is List && baselines.isNotEmpty) {
          final b = baselines.first as Map<String, dynamic>;

          // Window count: target = 30
          final wc = (b['window_count'] ?? b['windowCount'] ?? b['n_windows'] ?? 0) as num;
          final wcTarget = (b['window_target'] ?? b['windowTarget'] ?? 30) as num;

          // n_eff: target = 30
          final ne = (b['n_eff'] ?? b['nEff'] ?? b['effective_n'] ?? 0.0) as num;
          final neTarget = (b['n_eff_target'] ?? b['nEffTarget'] ?? 30.0) as num;

          // Unique days: target = 3
          final ud = (b['unique_days'] ?? b['uniqueDays'] ?? b['n_days'] ?? 0) as num;
          final udTarget = (b['unique_days_target'] ?? b['uniqueDaysTarget'] ?? 3) as num;

          // Day dominance: ideal <= 80%
          final dd = (b['day_dominance'] ?? b['dayDominance'] ?? b['dominance'] ?? 0.0) as num;

          // Quality score: target >= 0.80
          final qs = (b['quality_score'] ?? b['qualityScore'] ?? b['avg_quality'] ?? 0.0) as num;

          // Is ready
          final ready = b['is_ready'] ?? b['isReady'] ?? b['status'] == 'READY' || false;

          setState(() {
            windowCount = '${wc.toInt()} / ${wcTarget.toInt()}';
            windowProgress = (wc / wcTarget).clamp(0.0, 1.0).toDouble();

            nEff = ne.toStringAsFixed(1);
            nEffProgress = (ne / neTarget).clamp(0.0, 1.0).toDouble();

            uniqueDays = '${ud.toInt()} / ${udTarget.toInt()}';
            uniqueDaysProgress = (ud / udTarget).clamp(0.0, 1.0).toDouble();

            // Day dominance: below 80% is green, above is amber
            dayDominance = '${(dd * 100).toStringAsFixed(0)}%';
            dayDominanceProgress = dd.clamp(0.0, 1.0).toDouble();

            qualityScore = qs.toStringAsFixed(2);
            qualityProgress = qs.clamp(0.0, 1.0).toDouble();

            isReady = ready is bool ? ready : ready == true;
            isLoading = false;
          });
          return;
        }
      }
    } catch (_) {
      // Fallback to zeros
    }

    if (mounted) setState(() => isLoading = false);
  }

  Color _dominanceColor(double progress) {
    return progress <= 0.80 ? AppColors.green : AppColors.amber;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.navy),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppColors.teal),
            onPressed: _loadBaseline,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: SafeArea(
        child: isLoading
            ? const Center(child: CircularProgressIndicator())
            : Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    isReady ? EvidenceChip.evaluable() : EvidenceChip.provisional(),
                    const SizedBox(height: 10),
                    Text(
                      isReady ? 'Baseline sudah matang' : 'Baseline belum sepenuhnya matang',
                      style: const TextStyle(
                        fontFamily: 'Plus Jakarta Sans',
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppColors.navy,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      isReady
                          ? 'Data cukup untuk mendeteksi deviasi fisiologis secara akurat.'
                          : 'Data dapat dikumpulkan, tetapi keputusan episode belum digunakan sebagai alert final.',
                      style: const TextStyle(fontSize: 12, color: AppColors.gray, height: 1.4),
                    ),
                    const SizedBox(height: 24),

                    // Progress Indicators Card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.line),
                      ),
                      child: Column(
                        children: [
                          _buildProgressRow('Window valid (n)', windowCount, windowProgress, AppColors.teal),
                          const SizedBox(height: 16),
                          _buildProgressRow('n efektif (n_eff)', nEff, nEffProgress, AppColors.teal),
                          const SizedBox(height: 16),
                          _buildProgressRow('Hari berbeda', uniqueDays, uniqueDaysProgress, uniqueDaysProgress >= 1.0 ? AppColors.green : AppColors.teal),
                          const SizedBox(height: 16),
                          _buildProgressRow('Dominasi hari', dayDominance, dayDominanceProgress, _dominanceColor(dayDominanceProgress)),
                          const SizedBox(height: 16),
                          _buildProgressRow('Kualitas sinyal', qualityScore, qualityProgress, qualityProgress >= 0.8 ? AppColors.green : AppColors.teal),
                        ],
                      ),
                    ),

                    const Spacer(),

                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () => Navigator.pushReplacementNamed(context, '/app'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.teal,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          elevation: 0,
                        ),
                        child: const Text('Masuk ke Beranda', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildProgressRow(String label, String value, double progress, Color barColor) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.gray, letterSpacing: 0.3)),
            Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.ink)),
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
}
