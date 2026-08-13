import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../theme/app_colors.dart';
import '../../services/api_service.dart';

class InsightScreen extends StatefulWidget {
  const InsightScreen({super.key});

  @override
  State<InsightScreen> createState() => _InsightScreenState();
}

class _InsightScreenState extends State<InsightScreen> {
  bool isLoading = true;
  String userId = '';

  // Personal recovery profile
  int sampleSize = 0;
  String medianRecovery = '—';
  String quantile25 = '—';
  String quantile75 = '—';

  // Threshold
  String tauIn = '—';
  String tauOut = '—';

  // Prediction probabilities
  double probBaseline = 0.0;
  double probPersistent = 0.0;
  double probRecovery = 0.0;
  double probRecovered = 0.0;
  String mainPrediction = '—';
  double mainPredictionProb = 0.0;

  @override
  void initState() {
    super.initState();
    _loadInsights();
  }

  Future<void> _loadInsights() async {
    setState(() => isLoading = true);

    final prefs = await SharedPreferences.getInstance();
    final uid = prefs.getString('user_id') ?? '';
    if (mounted) setState(() => userId = uid);

    if (uid.isEmpty) {
      if (mounted) setState(() => isLoading = false);
      return;
    }

    try {
      // Load full metrics (recovery stats)
      final metricsRes = await ApiService.getFullMetrics(uid);
      if (metricsRes != null) {
        final payload = metricsRes is Map ? (metricsRes['data'] ?? metricsRes) : <String, dynamic>{};
        final avgRecoveryMs = payload['avg_recovery_ms'] ?? payload['avgRecoveryMs'];
        final p25Ms = payload['recovery_p25_ms'] ?? payload['p25_recovery_ms'];
        final p75Ms = payload['recovery_p75_ms'] ?? payload['p75_recovery_ms'];
        final count = payload['baseline_count'] ?? payload['baselineCount'] ?? payload['episode_count'] ?? 0;

        if (mounted) {
          setState(() {
            sampleSize = count is int ? count : int.tryParse('$count') ?? 0;
            medianRecovery = avgRecoveryMs != null
                ? '${((avgRecoveryMs as num) / 60000).round()} menit'
                : '—';
            quantile25 = p25Ms != null
                ? '${((p25Ms as num) / 60000).round()} menit'
                : '—';
            quantile75 = p75Ms != null
                ? '${((p75Ms as num) / 60000).round()} menit'
                : '—';
          });
        }
      }

      // Load baselines for thresholds
      final baselineRes = await ApiService.getUserBaselines(uid);
      if (baselineRes != null) {
        final payload = baselineRes is Map
            ? (baselineRes['data'] ?? baselineRes)
            : <String, dynamic>{};
        final baselines = payload is List ? payload : (payload['baselines'] ?? [payload]);
        if (baselines is List && baselines.isNotEmpty) {
          final latest = baselines.first as Map<String, dynamic>;
          final tauInVal = latest['tau_in'] ?? latest['tauIn'] ?? latest['threshold_in'];
          final tauOutVal = latest['tau_out'] ?? latest['tauOut'] ?? latest['threshold_out'];
          if (mounted) {
            setState(() {
              tauIn = tauInVal != null ? (tauInVal as num).toStringAsFixed(2) : '—';
              tauOut = tauOutVal != null ? (tauOutVal as num).toStringAsFixed(2) : '—';
            });
          }
        }
      }

      // Load H3a metrics for prediction probabilities
      final h3aRes = await ApiService.getMetricsH3a(uid);
      if (h3aRes != null) {
        final payload = h3aRes is Map ? (h3aRes['data'] ?? h3aRes) : <String, dynamic>{};
        final probs = payload['probabilities'] ?? payload['state_probabilities'] ?? payload['next_state_probs'];
        if (probs is Map && mounted) {
          double pBase = _toDouble(probs['BASELINE_COMPATIBLE'] ?? probs['baseline_compatible']);
          double pPers = _toDouble(probs['PERSISTENT_DEVIATION'] ?? probs['persistent_deviation']);
          double pRec = _toDouble(probs['RECOVERY'] ?? probs['recovery']);
          double pRecovered = _toDouble(probs['RECOVERED'] ?? probs['recovered']);

          // Normalize if needed
          final total = pBase + pPers + pRec + pRecovered;
          if (total > 0) {
            pBase /= total; pPers /= total; pRec /= total; pRecovered /= total;
          }

          // Find dominant prediction
          final entries = {
            'Baseline compatible': pBase,
            'Persistent deviation': pPers,
            'Recovery': pRec,
            'Recovered': pRecovered,
          };
          final dominant = entries.entries.reduce((a, b) => a.value > b.value ? a : b);

          setState(() {
            probBaseline = pBase;
            probPersistent = pPers;
            probRecovery = pRec;
            probRecovered = pRecovered;
            mainPrediction = dominant.key.toUpperCase();
            mainPredictionProb = (dominant.value * 100).round().toDouble();
          });
        }
      }
    } catch (_) {
      // Keep defaults
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  double _toDouble(dynamic v) {
    if (v is num) {
      final d = v.toDouble();
      if (d.isNaN || d.isInfinite) return 0.0;
      return d;
    }
    return 0.0;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: isLoading
            ? const Center(child: CircularProgressIndicator())
            : SingleChildScrollView(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Insight & Prediksi',
                                style: TextStyle(fontFamily: 'Plus Jakarta Sans', fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.navy),
                              ),
                              SizedBox(height: 2),
                              Text('Personal recovery profile & horizon prediction', style: TextStyle(fontSize: 12, color: AppColors.gray)),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.refresh_rounded, color: AppColors.teal),
                          onPressed: _loadInsights,
                          tooltip: 'Refresh',
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Prediction State Card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.line),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('PREDIKSI STATE (HORIZON: ~6 MIN)', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray)),
                          const SizedBox(height: 12),
                          _buildProbBar('Baseline compatible', probBaseline, AppColors.green, '${(probBaseline * 100).toInt()}%'),
                          _buildProbBar('Persistent deviation', probPersistent, AppColors.red, '${(probPersistent * 100).toInt()}%'),
                          _buildProbBar('Recovery', probRecovery, AppColors.purple, '${(probRecovery * 100).toInt()}%'),
                          _buildProbBar('Recovered', probRecovered, AppColors.blue, '${(probRecovered * 100).toInt()}%'),

                          if (mainPrediction != '—') ...[
                            const SizedBox(height: 14),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(color: AppColors.blueSoft, borderRadius: BorderRadius.circular(12)),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('PREDIKSI UTAMA', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.blue)),
                                  Text('$mainPrediction (${mainPredictionProb.toInt()}%)', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.blue)),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Personal Insight Card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.line),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Pola recovery (n = $sampleSize episode)',
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.navy),
                          ),
                          const SizedBox(height: 12),
                          _buildMetricRow('Median recovery', medianRecovery),
                          _buildMetricRow('Q25 (cepat)', quantile25),
                          _buildMetricRow('Q75 (lambat)', quantile75),
                          const SizedBox(height: 14),

                          const Text('THRESHOLD PERSONAL', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray)),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Chip(
                                label: Text('τ_in: $tauIn', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700)),
                                backgroundColor: AppColors.amberSoft,
                              ),
                              const SizedBox(width: 8),
                              Chip(
                                label: Text('τ_out: $tauOut', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700)),
                                backgroundColor: AppColors.blueSoft,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildMetricRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.gray)),
          Text(value, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.ink)),
        ],
      ),
    );
  }

  Widget _buildProbBar(String label, double val, Color barColor, String pctText) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.ink)),
          ),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: val.clamp(0.0, 1.0),
                minHeight: 7,
                backgroundColor: AppColors.graySoft,
                valueColor: AlwaysStoppedAnimation<Color>(barColor),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Text(pctText, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.ink)),
        ],
      ),
    );
  }
}
