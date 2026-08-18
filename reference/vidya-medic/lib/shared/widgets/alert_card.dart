import 'package:flutter/material.dart';
import '../../core/theme/functional_colors.dart';

class AlertCard extends StatelessWidget {
  final String title;
  final String description;
  final String magnitude;
  final String duration;
  final String activity;
  final VoidCallback onTap;

  const AlertCard({
    super.key,
    required this.title,
    required this.description,
    required this.magnitude,
    required this.duration,
    required this.activity,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;

    return Container(
      decoration: BoxDecoration(
        color: colors.deviationOrange.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: colors.deviationOrange.withValues(alpha: 0.3),
          width: 1.5,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                children: [
                  Icon(Icons.warning_rounded, color: colors.deviationOrange, size: 24),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      title,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: colors.deviationOrange,
                      ),
                    ),
                  ),
                  const Icon(Icons.arrow_forward_ios_rounded, size: 16),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                description,
                style: const TextStyle(fontSize: 13),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 12,
                runSpacing: 6,
                children: [
                  _infoBadge(Icons.straighten, "Magnitude: $magnitude"),
                  _infoBadge(Icons.timer_outlined, "Durasi: $duration"),
                  _infoBadge(Icons.directions_run, "Aktivitas: $activity"),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

  Widget _infoBadge(IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: Colors.grey[600]),
        const SizedBox(width: 4),
        Text(
          text,
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }
}
