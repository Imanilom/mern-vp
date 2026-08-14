import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';

class InsightScreen extends StatelessWidget {
  const InsightScreen({super.key});

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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Pola recovery — duduk (n = 12 episode)', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.navy)),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.purpleSoft,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('MEDIAN RECOVERY', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.purple)),
                          Text('18 menit', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.purple)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),

                    const Text('RENTANG PENGALAMAN', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray)),
                    const SizedBox(height: 6),
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('P25 · 11m', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.gray)),
                        Text('P75 · 27m', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.gray)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const _ThresholdRangeBand(startFraction: 0.20, endFraction: 0.80),
                    const SizedBox(height: 16),

                    const Text('THRESHOLD PERSONAL ADAPTIF', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray)),
                    const SizedBox(height: 8),
                    _buildParamRow('tau in (τin)', '1.67', 'Q99 stable score'),
                    _buildParamRow('tau out (τout)', '1.22', 'Q95 + hysteresis'),
                    _buildParamRow('tau normal (τnormal)', '0.84', 'Q90 stable score'),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Unlocked Insight Card (A06 Addendum)
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
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.purpleSoft,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text('Unlocked insight', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.purple)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text('Experience Builder', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.navy)),
                    const SizedBox(height: 4),
                    const Text(
                      'Sistem kini memiliki cukup episode duduk yang terselesaikan untuk merangkum pola pemulihan pribadi preliminary Anda. Lanjutkan penggunaan normal.',
                      style: TextStyle(fontSize: 11.5, color: AppColors.gray, height: 1.4),
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

  Widget _buildParamRow(String param, String val, String source) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(param, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppColors.ink)),
          Row(
            children: [
              Text(val, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.navy, fontFamily: 'JetBrains Mono')),
              const SizedBox(width: 8),
              Text('($source)', style: const TextStyle(fontSize: 10, color: AppColors.gray)),
            ],
          ),
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

class _ThresholdRangeBand extends StatelessWidget {
  final double startFraction;
  final double endFraction;

  const _ThresholdRangeBand({
    required this.startFraction,
    required this.endFraction,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final totalWidth = constraints.maxWidth;
        final left = totalWidth * startFraction;
        final width = totalWidth * (endFraction - startFraction);

        return Container(
          height: 8,
          width: double.infinity,
          decoration: BoxDecoration(
            color: AppColors.graySoft,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Stack(
            children: [
              Positioned(
                left: left,
                width: width,
                top: 0,
                bottom: 0,
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.teal,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

