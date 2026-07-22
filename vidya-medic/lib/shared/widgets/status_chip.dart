import 'package:flutter/material.dart';
import '../../core/theme/functional_colors.dart';
import '../../core/theme/htm_colors.dart';
import '../../core/theme/htm_typography.dart';

enum HealthStatusType {
  stable,
  attention,
  deviation,
  alert,
  noData,
}

class StatusChip extends StatelessWidget {
  final HealthStatusType status;
  final String? customLabel;
  final bool compact;

  const StatusChip({
    super.key,
    required this.status,
    this.customLabel,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors =
        Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;

    Color bgColor;
    Color textColor;
    IconData icon;
    String label;

    switch (status) {
      case HealthStatusType.stable:
        bgColor = colors.stableGreen.withValues(alpha: 0.12);
        textColor = colors.stableGreen;
        icon = Icons.check_circle_rounded;
        label = customLabel ?? "STABIL";
        break;
      case HealthStatusType.attention:
        bgColor = colors.attentionYellow.withValues(alpha: 0.12);
        textColor = colors.attentionYellow;
        icon = Icons.info_rounded;
        label = customLabel ?? "PERLU PERHATIAN";
        break;
      case HealthStatusType.deviation:
        bgColor = colors.deviationOrange.withValues(alpha: 0.12);
        textColor = colors.deviationOrange;
        icon = Icons.warning_amber_rounded;
        label = customLabel ?? "DEVIASI";
        break;
      case HealthStatusType.alert:
        bgColor = colors.alertRed.withValues(alpha: 0.12);
        textColor = colors.alertRed;
        icon = Icons.error_rounded;
        label = customLabel ?? "ANOMALI";
        break;
      case HealthStatusType.noData:
        bgColor = colors.inactiveGrey.withValues(alpha: 0.12);
        textColor = colors.inactiveGrey;
        icon = Icons.help_outline_rounded;
        label = customLabel ?? "BELUM ADA DATA";
        break;
    }

    final htmColors = HtmColors.of(context);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 12,
        vertical: compact ? 4 : 6,
      ),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: textColor.withValues(alpha: 0.2), width: 1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: compact ? 12 : 14, color: textColor),
          const SizedBox(width: 5),
          Text(
            label,
            style: HtmTypography.labelSmall.copyWith(
              color: textColor,
              letterSpacing: 0.4,
            ),
          ),
        ],
      ),
    );
  }
}
