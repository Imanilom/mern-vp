import 'package:flutter/material.dart';
import '../../core/theme/functional_colors.dart';
import '../../shared/models/models.dart';

class ActivitySelectorGrid extends StatelessWidget {
  final List<ActivityItem> activities;
  final String selectedActivityId;
  final ValueChanged<ActivityItem> onSelect;

  const ActivitySelectorGrid({
    super.key,
    required this.activities,
    required this.selectedActivityId,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    final colors =
        Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 0.95,
      ),
      itemCount: activities.length,
      itemBuilder: (context, index) {
        final item = activities[index];
        final isSelected = item.id == selectedActivityId;

        return GestureDetector(
          onTap: () => onSelect(item),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            decoration: BoxDecoration(
              gradient: isSelected
                  ? LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        colors.dataBlue,
                        colors.dataBlue.withValues(alpha: 0.8),
                      ],
                    )
                  : null,
              color: isSelected
                  ? null
                  : (isDark ? const Color(0xFF1E293B) : Colors.white),
              borderRadius: BorderRadius.circular(18),
              border: isSelected
                  ? null
                  : Border.all(
                      color: Colors.grey.withValues(alpha: 0.15), width: 1.5),
              boxShadow: isSelected
                  ? [
                      BoxShadow(
                        color: colors.dataBlue.withValues(alpha: 0.35),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ]
                  : (isDark
                      ? []
                      : [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ]),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: isSelected
                          ? Colors.white.withValues(alpha: 0.2)
                          : colors.dataBlue.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      item.icon,
                      size: 22,
                      color: isSelected ? Colors.white : colors.dataBlue,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    item.name,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isSelected
                          ? Colors.white
                          : (isDark ? Colors.grey[300] : Colors.grey[800]),
                    ),
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
