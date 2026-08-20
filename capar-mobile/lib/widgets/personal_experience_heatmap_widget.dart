import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class PersonalExperienceHeatmapWidget extends StatelessWidget {
  final Map<String, dynamic> heatmapMatrix;

  const PersonalExperienceHeatmapWidget({
    super.key,
    required this.heatmapMatrix,
  });

  static const List<Map<String, String>> periods = [
    {'key': 'morning', 'label': 'Pagi (06-12)'},
    {'key': 'afternoon', 'label': 'Siang (12-18)'},
    {'key': 'evening', 'label': 'Sore (18-24)'},
    {'key': 'night', 'label': 'Malam (00-06)'},
  ];

  static const List<Map<String, String>> contexts = [
    {'key': 'sitting', 'label': 'Duduk'},
    {'key': 'standing', 'label': 'Berdiri'},
    {'key': 'walking', 'label': 'Jalan'},
    {'key': 'driving', 'label': 'Kemudi'},
    {'key': 'resting', 'label': 'Istirahat'},
  ];

  Color _getStateColor(String state, double avgAnomaly) {
    switch (state.toUpperCase()) {
      case 'BASELINE_COMPATIBLE':
        return AppColors.teal;
      case 'DEVIATION_CANDIDATE':
        return AppColors.amber;
      case 'PERSISTENT_DEVIATION':
        return AppColors.red;
      case 'RECOVERY':
      case 'RECOVERY_START':
      case 'RECOVERED':
        return AppColors.purple;
      default:
        if (avgAnomaly > 2.0) return AppColors.red;
        if (avgAnomaly > 1.0) return AppColors.amber;
        return AppColors.graySoft;
    }
  }

  @override
  Widget build(BuildContext context) {
    int totalWindowCount = 0;
    heatmapMatrix.forEach((_, cell) {
      if (cell is Map) {
        totalWindowCount += (cell['count'] as num?)?.toInt() ?? 0;
      }
    });

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
                    '2D CONTEXT x TIME HEATMAP',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: AppColors.gray,
                      letterSpacing: 0.5,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Distribusi Memori Pengalaman Fisiologis',
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
                  'n=$totalWindowCount window',
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
              defaultColumnWidth: const FixedColumnWidth(64),
              children: [
                // Header Row (Periods)
                TableRow(
                  children: [
                    const SizedBox(
                      height: 32,
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          'Konteks↓Waktu→',
                          style: TextStyle(fontSize: 8.5, color: AppColors.gray, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                    ...periods.map((p) => SizedBox(
                          height: 32,
                          child: Center(
                            child: Text(
                              p['label']!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: AppColors.navy),
                            ),
                          ),
                        )),
                  ],
                ),

                // Context Rows
                ...contexts.map((c) {
                  final ctxKey = c['key']!;
                  final ctxLabel = c['label']!;

                  return TableRow(
                    children: [
                      // Context Label
                      SizedBox(
                        height: 44,
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            ctxLabel,
                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.navy),
                          ),
                        ),
                      ),

                      // Period Cells
                      ...periods.map((p) {
                        final periodKey = p['key']!;
                        final cellKey = '$periodKey-$ctxKey';
                        final cell = heatmapMatrix[cellKey] as Map<String, dynamic>?;

                        final int count = (cell?['count'] as num?)?.toInt() ?? 0;
                        final double avgAnomaly = (cell?['avgAnomaly'] as num?)?.toDouble() ?? 0.0;
                        final String state = cell?['state']?.toString() ?? 'NONE';

                        if (count == 0 && state == 'NONE') {
                          return Container(
                            height: 40,
                            margin: const EdgeInsets.all(2),
                            decoration: BoxDecoration(
                              color: AppColors.graySoft,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Center(
                              child: Text(
                                '—',
                                style: TextStyle(color: AppColors.gray, fontSize: 12),
                              ),
                            ),
                          );
                        }

                        final baseColor = _getStateColor(state, avgAnomaly);
                        final opacity = (count > 0) ? (0.25 + (count / 30).clamp(0.0, 0.65)) : 0.12;

                        return Container(
                          height: 40,
                          margin: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            color: baseColor.withValues(alpha: opacity),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: baseColor.withValues(alpha: 0.35)),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'n=$count',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  color: opacity > 0.5 ? Colors.white : AppColors.navy,
                                ),
                              ),
                              Text(
                                '${avgAnomaly.toStringAsFixed(1)} SD',
                                style: TextStyle(
                                  fontSize: 8,
                                  fontWeight: FontWeight.w600,
                                  color: opacity > 0.5 ? Colors.white70 : AppColors.gray,
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
          const SizedBox(height: 10),

          // Legend Footer
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildLegendDot('Baseline', AppColors.teal),
              _buildLegendDot('Candidate', AppColors.amber),
              _buildLegendDot('Persistent', AppColors.red),
              _buildLegendDot('Recovery', AppColors.purple),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLegendDot(String label, Color color) {
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 9.5, color: AppColors.gray, fontWeight: FontWeight.w600)),
      ],
    );
  }
}
