import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

class EvidenceChip extends StatelessWidget {
  final String label;
  final IconData? icon;
  final Color background;
  final Color textColor;

  const EvidenceChip({
    super.key,
    required this.label,
    this.icon,
    required this.background,
    required this.textColor,
  });

  factory EvidenceChip.evaluable() {
    return const EvidenceChip(
      label: 'EVALUABLE',
      icon: Icons.check_circle,
      background: AppColors.greenSoft,
      textColor: AppColors.green,
    );
  }

  factory EvidenceChip.baselineCompatible() {
    return const EvidenceChip(
      label: 'BASELINE COMPATIBLE',
      icon: Icons.check_circle_outline,
      background: AppColors.greenSoft,
      textColor: AppColors.green,
    );
  }

  factory EvidenceChip.qualityWarning() {
    return const EvidenceChip(
      label: 'QUALITY WARNING',
      icon: Icons.warning_amber_rounded,
      background: AppColors.graySoft,
      textColor: AppColors.gray,
    );
  }

  factory EvidenceChip.uncertainContext() {
    return const EvidenceChip(
      label: 'KONTEKS BELUM PASTI',
      icon: Icons.help_outline_rounded,
      background: AppColors.amberSoft,
      textColor: AppColors.amber,
    );
  }

  factory EvidenceChip.candidate() {
    return const EvidenceChip(
      label: 'CANDIDATE',
      icon: Icons.search_rounded,
      background: AppColors.amberSoft,
      textColor: AppColors.amber,
    );
  }

  factory EvidenceChip.persistent() {
    return const EvidenceChip(
      label: 'PERSISTENT',
      icon: Icons.notifications_active_rounded,
      background: AppColors.redSoft,
      textColor: AppColors.red,
    );
  }

  factory EvidenceChip.recovery() {
    return const EvidenceChip(
      label: 'RECOVERY',
      icon: Icons.trending_down_rounded,
      background: AppColors.purpleSoft,
      textColor: AppColors.purple,
    );
  }

  factory EvidenceChip.recovered() {
    return const EvidenceChip(
      label: 'RECOVERED',
      icon: Icons.check_circle_rounded,
      background: AppColors.greenSoft,
      textColor: AppColors.green,
    );
  }

  factory EvidenceChip.provisional() {
    return const EvidenceChip(
      label: 'PROVISIONAL',
      icon: Icons.hourglass_bottom,
      background: AppColors.amberSoft,
      textColor: AppColors.amber,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: textColor),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              color: textColor,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}
