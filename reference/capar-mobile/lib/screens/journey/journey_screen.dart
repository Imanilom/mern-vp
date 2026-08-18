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

              // Evidence Level Card (L4 Episode Observer)
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
                      'EVIDENCE LEVEL',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray, letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 4),
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'L4 — Episode Observer',
                          style: TextStyle(
                            fontFamily: 'Plus Jakarta Sans',
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: AppColors.navy,
                          ),
                        ),
                        Text(
                          '3 / 5 episode',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.teal),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      '3 dari 5 episode selesai menuju L5 Experience Builder',
                      style: TextStyle(fontSize: 11, color: AppColors.gray),
                    ),
                    const SizedBox(height: 12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: const LinearProgressIndicator(
                        value: 0.60,
                        minHeight: 8,
                        backgroundColor: AppColors.graySoft,
                        valueColor: AlwaysStoppedAnimation<Color>(AppColors.purple),
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Level menggambarkan kematangan data bukti, bukan tingkat kebugaran atau kesehatan.',
                      style: TextStyle(fontSize: 10, color: AppColors.gray, fontStyle: FontStyle.italic),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Context Baseline Journeys
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
                      'CONTEXT BASELINE JOURNEYS',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray, letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      'Kesiapan baseline personal per aktivitas',
                      style: TextStyle(fontSize: 11, color: AppColors.gray),
                    ),
                    const SizedBox(height: 14),
                    _buildContextJourneyRow('Sitting (Duduk)', '82%', 'READY', 0.82, AppColors.green),
                    const SizedBox(height: 12),
                    _buildContextJourneyRow('Walking (Berjalan)', '68%', 'LEARNING', 0.68, AppColors.teal),
                    const SizedBox(height: 12),
                    _buildContextJourneyRow('Work / focus (Bekerja)', '54%', 'LEARNING', 0.54, AppColors.teal),
                    const SizedBox(height: 12),
                    _buildContextJourneyRow('Sleep / rest (Istirahat)', '35%', 'EARLY', 0.35, AppColors.amber),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Mission Center
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
                      'MISSION CENTER',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray, letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      'Tindakan berorientasi kualitas bukti',
                      style: TextStyle(fontSize: 11, color: AppColors.gray),
                    ),
                    const SizedBox(height: 14),
                    _buildMissionItem('Rekam 1 sesi kualitas tinggi', '1 / 1', true),
                    _buildMissionItem('Konfirmasi konteks aktivitas', '2 / 2', true),
                    _buildMissionItem('Lengkapi EMA episode', '3 / 4', false),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Recent Badges
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
                      'LENCANA NIKMATI (RECENT BADGES)',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray, letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 12),
                    GridView.count(
                      crossAxisCount: 3,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: 0.85,
                      children: [
                        _buildBadgeCard('Baseline Builder', 'Baseline matang', Icons.check_circle, AppColors.green),
                        _buildBadgeCard('Context Explorer', '4 konteks aktif', Icons.explore, AppColors.blue),
                        _buildBadgeCard('Reflection Contributor', '3 refleksi EMA', Icons.psychology, AppColors.purple),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.amberSoft,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.shield_outlined, size: 16, color: AppColors.amber),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Gamifikasi ini memberi penghargaan pada kualitas partisipasi dan dokumentasi data — bukan pada nilai denyut jantung atau kecepatan pemulihan.',
                              style: TextStyle(fontSize: 10, color: AppColors.ink, height: 1.35),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContextJourneyRow(String title, String pct, String statusLabel, double value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.navy)),
            Row(
              children: [
                Text(pct, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.ink)),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    statusLabel,
                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: color),
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 5),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: value,
            minHeight: 6,
            backgroundColor: AppColors.graySoft,
            valueColor: AlwaysStoppedAnimation<Color>(color),
          ),
        ),
      ],
    );
  }

  Widget _buildMissionItem(String title, String count, bool isDone) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Icon(
                isDone ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
                size: 16,
                color: isDone ? AppColors.green : AppColors.gray,
              ),
              const SizedBox(width: 8),
              Text(
                title,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isDone ? FontWeight.w700 : FontWeight.w600,
                  color: isDone ? AppColors.navy : AppColors.ink,
                ),
              ),
            ],
          ),
          Text(
            count,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: isDone ? AppColors.green : AppColors.gray,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBadgeCard(String title, String desc, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.25)),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color, color.withValues(alpha: 0.75)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.35),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Icon(icon, size: 16, color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: AppColors.navy),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            desc,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: AppColors.gray),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
