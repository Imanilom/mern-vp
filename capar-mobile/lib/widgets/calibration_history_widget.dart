import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class CalibrationHistoryWidget extends StatelessWidget {
  final List<Map<String, dynamic>> history;

  const CalibrationHistoryWidget({
    super.key,
    required this.history,
  });

  @override
  Widget build(BuildContext context) {
    if (history.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
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
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'BASELINE GOVERNANCE',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: AppColors.gray,
                      letterSpacing: 0.5,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Riwayat Kalibrasi Threshold',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: AppColors.navy,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.bg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.line),
                ),
                child: Text(
                  '${history.length} Versi',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.navy,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: history.length,
            separatorBuilder: (_, index) => const Divider(color: AppColors.line, height: 16),
            itemBuilder: (context, index) {
              final item = history[index];
              final version = item['version']?.toString() ?? 'v1.0';
              final activity = item['activity']?.toString() ?? 'sitting';
              final days = item['distinct_days']?.toString() ?? '3';
              final learnedTau = item['learned_tau'] as Map<String, dynamic>?;
              final tauIn = learnedTau?['tau_in']?.toString() ?? '1.86';
              final tauOut = learnedTau?['tau_out']?.toString() ?? '1.18';
              final tauNorm = learnedTau?['tau_normal']?.toString() ?? '0.75';
              final isMature = item['is_mature'] == true;

              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Text(
                            version,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: AppColors.navy,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: isMature ? AppColors.tealSoft : AppColors.amberSoft,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              isMature ? 'Approved' : 'Provisional',
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                                color: isMature ? AppColors.teal : AppColors.amber,
                              ),
                            ),
                          ),
                        ],
                      ),
                      Text(
                        'Konteks: $activity · $days Hari Data',
                        style: const TextStyle(fontSize: 10, color: AppColors.gray),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      _buildTauBadge('τin: $tauIn', AppColors.red),
                      const SizedBox(width: 6),
                      _buildTauBadge('τout: $tauOut', AppColors.amber),
                      const SizedBox(width: 6),
                      _buildTauBadge('τnorm: $tauNorm', AppColors.green),
                    ],
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildTauBadge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 9.5,
          fontWeight: FontWeight.w800,
          color: color,
        ),
      ),
    );
  }
}
