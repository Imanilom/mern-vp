import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class MarkovHeatmapWidget extends StatelessWidget {
  final Map<String, dynamic> markovData;

  const MarkovHeatmapWidget({
    super.key,
    required this.markovData,
  });

  static const Map<String, String> stateLabels = {
    'BASELINE_COMPATIBLE': 'Base',
    'DEVIATION_CANDIDATE': 'Cand',
    'PERSISTENT_DEVIATION': 'Persist',
    'RECOVERY_START': 'Recov',
    'RECOVERED': 'Done',
  };

  static const List<String> canonicalStates = [
    'BASELINE_COMPATIBLE',
    'DEVIATION_CANDIDATE',
    'PERSISTENT_DEVIATION',
    'RECOVERY_START',
    'RECOVERED',
  ];

  @override
  Widget build(BuildContext context) {
    final episodeCount = (markovData['episode_count'] as num?)?.toInt() ?? 
        (markovData['total_transitions'] as num?)?.toInt() ?? 0;
    final alpha = (markovData['alpha'] as num?)?.toDouble() ?? 0.5;

    List<dynamic> rawMatrix = [];
    if (markovData['matrix'] is List) {
      rawMatrix = markovData['matrix'] as List<dynamic>;
    } else if (markovData['matrix'] is Map) {
      final map = markovData['matrix'] as Map<String, dynamic>;
      map.forEach((currSt, nextMap) {
        final List<dynamic> trans = [];
        if (nextMap is Map) {
          nextMap.forEach((nextSt, prob) {
            final double p = (prob is num) ? prob.toDouble() : 0.0;
            trans.add({
              'next_state': nextSt,
              'allowed': p > 0,
              'probability': p,
              'count': (p * (episodeCount > 0 ? episodeCount : 10)).round(),
            });
          });
        }
        rawMatrix.add({
          'current_state': currSt,
          'transitions': trans,
        });
      });
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
                    'MARKOV TRANSITION HEATMAP',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: AppColors.gray,
                      letterSpacing: 0.5,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Matriks Transisi Fisiologis Personal',
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
                  color: AppColors.tealSoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'n=$episodeCount ep',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.teal,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Heatmap Matrix Table
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Table(
              defaultColumnWidth: const FixedColumnWidth(54),
              children: [
                // Header Row
                TableRow(
                  children: [
                    const SizedBox(
                      height: 30,
                      child: Center(
                        child: Text(
                          'From↓To→',
                          style: TextStyle(fontSize: 8.5, color: AppColors.gray, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                    ...canonicalStates.map((st) => SizedBox(
                      height: 30,
                      child: Center(
                        child: Text(
                          stateLabels[st] ?? st,
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.navy),
                        ),
                      ),
                    )),
                  ],
                ),

                // Data Rows
                ...rawMatrix.map((rowObj) {
                  final currState = rowObj['current_state']?.toString() ?? '';
                  final transitions = rowObj['transitions'] as List<dynamic>? ?? [];

                  return TableRow(
                    children: [
                      // Origin label
                      SizedBox(
                        height: 48,
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            stateLabels[currState] ?? currState,
                            style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: AppColors.navy),
                          ),
                        ),
                      ),

                      // Transition cells
                      ...canonicalStates.map((nextSt) {
                        final cell = transitions.firstWhere(
                          (t) => t['next_state'] == nextSt,
                          orElse: () => {'allowed': false, 'probability': null, 'count': 0},
                        );

                        final bool allowed = cell['allowed'] == true;
                        final double? prob = cell['probability'] != null ? (cell['probability'] as num).toDouble() : null;
                        final int count = (cell['count'] as num?)?.toInt() ?? 0;

                        if (!allowed) {
                          return Container(
                            height: 44,
                            margin: const EdgeInsets.all(2),
                            decoration: BoxDecoration(
                              color: AppColors.graySoft,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Center(
                              child: Text(
                                '—',
                                style: TextStyle(color: AppColors.gray, fontSize: 13, fontWeight: FontWeight.w600),
                              ),
                            ),
                          );
                        }

                        final probPct = ((prob ?? 0.0) * 100).toStringAsFixed(0);
                        final opacity = (prob ?? 0.0).clamp(0.12, 0.90);

                        return Container(
                          height: 44,
                          margin: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            color: AppColors.teal.withValues(alpha: opacity),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppColors.teal.withValues(alpha: 0.3)),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                '$probPct%',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: opacity > 0.45 ? Colors.white : AppColors.navy,
                                ),
                              ),
                              Text(
                                'n=$count',
                                style: TextStyle(
                                  fontSize: 8,
                                  fontWeight: FontWeight.w600,
                                  color: opacity > 0.45 ? Colors.white70 : AppColors.gray,
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                    ],
                  );
                }),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Governance note
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.bg,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                const Icon(Icons.shield_outlined, size: 14, color: AppColors.teal),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Guarded First-Order Markov (α=$alpha). Diperbarui hanya dari episode terverifikasi.',
                    style: const TextStyle(fontSize: 10, color: AppColors.gray),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
