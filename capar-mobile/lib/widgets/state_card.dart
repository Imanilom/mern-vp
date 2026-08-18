import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class StateCard extends StatelessWidget {
  final Widget chip;
  final String title;
  final String score;
  final String contextText;
  final Color borderColor;
  final Color backgroundColor;
  final Color scoreColor;

  const StateCard({
    super.key,
    required this.chip,
    required this.title,
    required this.score,
    required this.contextText,
    required this.borderColor,
    this.backgroundColor = AppColors.surface,
    this.scoreColor = AppColors.ink,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(14),
        border: Border(
          left: BorderSide(color: borderColor, width: 4),
          top: BorderSide(color: backgroundColor == AppColors.surface ? AppColors.line : Colors.transparent, width: 1),
          right: BorderSide(color: backgroundColor == AppColors.surface ? AppColors.line : Colors.transparent, width: 1),
          bottom: BorderSide(color: backgroundColor == AppColors.surface ? AppColors.line : Colors.transparent, width: 1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title.isNotEmpty) ...[
            Text(
              title,
              style: TextStyle(
                fontSize: 10,
                textBaseline: TextBaseline.alphabetic,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.6,
                color: borderColor,
              ),
            ),
            const SizedBox(height: 8),
          ] else ...[
            chip,
            const SizedBox(height: 8),
          ],
          Text(
            score,
            style: TextStyle(
              fontFamily: 'Plus Jakarta Sans',
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: scoreColor,
              height: 1.1,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            contextText,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.gray,
            ),
          ),
        ],
      ),
    );
  }
}
