import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';

import '../../services/api_service.dart';

class InsightScreen extends StatefulWidget {
  const InsightScreen({super.key});

  @override
  State<InsightScreen> createState() => _InsightScreenState();
}

class _InsightScreenState extends State<InsightScreen> {
  bool isLoading = true;
  int sampleSize = 0;
  String medianRecovery = '0 menit';
  String quantile25 = '0 menit';
  String quantile75 = '0 menit';
  
  @override
  void initState() {
    super.initState();
    _loadExperience();
  }

  Future<void> _loadExperience() async {
    const userId = 'P012';
    try {
      final res = await ApiService.getFullMetrics(userId);
      if (res != null && mounted) {
        final payload = res is Map ? (res['data'] ?? res) : <String, dynamic>{};
        final avgRecoveryMs = payload['avg_recovery_ms'] ?? payload['avgRecoveryMs'];
        final baselineCount = payload['baseline_count'] ?? payload['baselineCount'] ?? 0;

        setState(() {
          sampleSize = baselineCount is int ? baselineCount : int.tryParse('$baselineCount') ?? 0;
          medianRecovery = avgRecoveryMs != null
              ? '${((avgRecoveryMs as num) / 60000).round()} menit'
              : '18 menit';
          quantile25 = '12 menit';
          quantile75 = '26 menit';
          isLoading = false;
        });
        return;
      }

      if (mounted) {
        setState(() {
          sampleSize = 0;
          medianRecovery = '0 menit';
          quantile25 = '0 menit';
          quantile75 = '0 menit';
          isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Insight & Prediksi',
                style: TextStyle(
                  fontFamily: 'Plus Jakarta Sans',
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(height: 2),
              const Text(
                'Personal recovery profile & horizon prediction',
                style: TextStyle(fontSize: 12, color: AppColors.gray),
              ),
              const SizedBox(height: 20),

              // A13 Prediksi State Card
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
                    _buildProbBar('Baseline compatible', 0.13, AppColors.green, '13%'),
                    _buildProbBar('Persistent deviation', 0.18, AppColors.red, '18%'),
                    _buildProbBar('Recovery', 0.28, AppColors.purple, '28%'),
                    _buildProbBar('Recovered', 0.41, AppColors.blue, '41%'),

                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.blueSoft,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('PREDIKSI UTAMA', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.blue)),
                          Text('RECOVERED (41%)', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.blue)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // A16 Personal Insight Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.line),
                ),
                child: isLoading ? const Center(child: CircularProgressIndicator()) : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Pola recovery — duduk (n = $sampleSize episode)', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.navy)),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.purpleSoft,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const LinearProgressIndicator(
                        value: 0.6,
                        minHeight: 8,
                        backgroundColor: AppColors.graySoft,
                        valueColor: AlwaysStoppedAnimation<Color>(AppColors.teal),
                      ),
                    ),
                    const SizedBox(height: 14),

                    const Text('THRESHOLD PERSONAL', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray)),
                    const SizedBox(height: 6),
                    const Row(
                      children: [
                        Chip(label: Text('tau_in: 1,86', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700))),
                        SizedBox(width: 8),
                        Chip(label: Text('tau_out: 1,18', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700))),
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
                value: val,
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
