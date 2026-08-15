import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';

class JourneyScreen extends StatelessWidget {
  const JourneyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'CAPAR Journey',
                        style: TextStyle(
                          fontFamily: 'Plus Jakarta Sans',
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppColors.navy,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Kematangan evidence & partisipasi riset',
                        style: TextStyle(fontSize: 12, color: AppColors.gray),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: AppColors.greenSoft,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.green.withValues(alpha: 0.3)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.sensors, size: 12, color: AppColors.green),
                        SizedBox(width: 4),
                        Text(
                          'H10 connected',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.green),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // Empty state for Evidence Level Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.line),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'EVIDENCE LEVEL & JOURNEY',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray, letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 14),
                    const Center(
                      child: Text(
                        'Data level dan perjalanan baseline belum tersedia.',
                        style: TextStyle(fontSize: 12, color: AppColors.gray),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Empty state for Mission Center
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.line),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'MISSION CENTER & BADGES',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray, letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 14),
                    const Center(
                      child: Text(
                        'Misi dan badge belum tersedia.',
                        style: TextStyle(fontSize: 12, color: AppColors.gray),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

}
