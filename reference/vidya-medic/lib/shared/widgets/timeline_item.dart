import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/functional_colors.dart';
import '../models/models.dart';

class TimelineItemWidget extends StatelessWidget {
  final TrajectoryEvent event;
  final VoidCallback? onTap;
  final bool isLast;

  const TimelineItemWidget({
    super.key,
    required this.event,
    this.onTap,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors =
        Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    Color dotColor;
    IconData icon;

    switch (event.type) {
      case 'stable':
        dotColor = colors.stableGreen;
        icon = Icons.check_circle_rounded;
        break;
      case 'recovering':
        dotColor = colors.attentionYellow;
        icon = Icons.sync_rounded;
        break;
      case 'deviation':
        dotColor = colors.deviationOrange;
        icon = Icons.warning_amber_rounded;
        break;
      case 'alert':
        dotColor = colors.alertRed;
        icon = Icons.error_rounded;
        break;
      default:
        dotColor = colors.dataBlue;
        icon = Icons.info_rounded;
    }

    final formattedTime = DateFormat('HH:mm').format(event.timestamp);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Timeline column
            SizedBox(
              width: 52,
              child: Column(
                children: [
                  const SizedBox(height: 14),
                  Text(
                    formattedTime,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 11,
                      color: Colors.grey[500],
                    ),
                  ),
                ],
              ),
            ),

            // Dot + line
            Column(
              children: [
                const SizedBox(height: 10),
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: dotColor.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, color: dotColor, size: 16),
                ),
                if (!isLast)
                  Container(
                    width: 1.5,
                    height: 40,
                    color: Colors.grey.withValues(alpha: 0.15),
                  ),
              ],
            ),

            const SizedBox(width: 12),

            // Content card
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 6, bottom: 16),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF1E293B) : Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: isDark
                        ? []
                        : [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.04),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              event.title,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                          ),
                          Icon(Icons.arrow_forward_ios_rounded,
                              size: 11, color: Colors.grey[400]),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        event.description,
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.grey[600],
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: colors.dataBlue.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          event.activity,
                          style: TextStyle(
                            fontSize: 10,
                            color: colors.dataBlue,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
