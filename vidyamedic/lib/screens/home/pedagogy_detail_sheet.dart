import 'package:flutter/material.dart';
import '../../models/health_models.dart';
import '../../theme/app_theme.dart';

/// Modal lembar bawah yang menjelaskan cara analisis dan makna bagi pasien
class PedagogyDetailSheet extends StatelessWidget {
  final PedagogyAnswer answer;

  const PedagogyDetailSheet({super.key, required this.answer});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(color: AppTheme.border, borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 16),

            Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: const BoxDecoration(color: AppTheme.primary, shape: BoxShape.circle),
                  child: Center(
                    child: Text(
                      '${answer.number}',
                      style: AppTheme.font(size: 14, weight: FontWeight.w800, color: Colors.white),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    answer.question,
                    style: AppTheme.font(size: 15.5, weight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Card Penjelasan Cara Analisis
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.primarySoft,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.primaryLight.withValues(alpha: 0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.psychology_alt_outlined, size: 16, color: AppTheme.primary),
                      const SizedBox(width: 6),
                      Text(
                        'Bagaimana VidyaMedic Memantau?',
                        style: AppTheme.font(size: 11.5, weight: FontWeight.w700, color: AppTheme.primaryDark),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    answer.algorithm,
                    style: AppTheme.font(size: 12.5, weight: FontWeight.w600, color: AppTheme.primaryDark),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            Text('Ringkasan Kondisi Anda', style: AppTheme.font(size: 13, weight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(
              answer.summary,
              style: AppTheme.font(size: 13.5, color: AppTheme.textPrimary, height: 1.4),
            ),
            const SizedBox(height: 12),

            Text('Penjelasan Lebih Lanjut', style: AppTheme.font(size: 13, weight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(
              answer.detail,
              style: AppTheme.font(size: 12.5, color: AppTheme.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 18),

            SizedBox(
              width: double.infinity,
              height: 44,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Mengerti'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
