import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';
import '../input/guided_daily_flow_screen.dart';

/// Mockup Lanjutan Halaman 9: Layar 6 - Apa yang Harus Dilakukan? ("What Should I Do?")
class ActionGuidanceScreen extends StatelessWidget {
  const ActionGuidanceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final activeLevel = s.triageLevel;
    final isOrangeOrRed = (activeLevel == ActionTriageLevel.orange ||
            activeLevel == ActionTriageLevel.red) &&
        !s.hasCaparMetrics;
    final isDataLimited = activeLevel == ActionTriageLevel.unknown;
    final serverAction = s.serverAction;
    final serverPolicy = serverAction?['policy'] is Map
        ? Map<String, dynamic>.from(serverAction!['policy'] as Map)
        : null;

    return MockupScaffold(
      title: 'Apa yang Harus Dilakukan?',
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Panduan Tindakan Sesuai Kondisi',
            style: AppTheme.font(size: 15, weight: FontWeight.w700),
          ),
          const SizedBox(height: 2),
          Text(
            'Warna menunjukkan tingkat perhatian yang dibutuhkan. Segmen aktif saat ini: ${activeLevel.title}.',
            style: AppTheme.font(size: 12, color: AppTheme.textSecondary),
          ),
          const SizedBox(height: 14),
          if (serverAction != null) ...[
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: activeLevel.color.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: activeLevel.color.withValues(alpha: 0.4)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    serverAction['title']?.toString() ?? 'Panduan dari CAPAR',
                    style: AppTheme.font(size: 13, weight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    serverAction['message']?.toString() ??
                        'Belum ada penjelasan tindakan dari backend.',
                    style: AppTheme.font(
                        size: 12, color: AppTheme.textSecondary, height: 1.35),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Kebijakan: ${serverPolicy?['status']?.toString() ?? 'metadata tidak tersedia'}',
                    style: AppTheme.font(
                        size: 10.5,
                        weight: FontWeight.w700,
                        color: AppTheme.textMuted),
                  ),
                ],
              ),
            ),
          ],
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFFCD34D)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.info_outline_rounded,
                    color: Color(0xFFD97706), size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'KEBIJAKAN DEMO: NON-KLINIS / PLACEHOLDER. Panduan ini bukan diagnosis dan belum divalidasi untuk keputusan klinis. Jangan menunda pertolongan bila kondisi terasa darurat.',
                    style: AppTheme.font(
                        size: 11.5,
                        color: const Color(0xFF78350F),
                        height: 1.3),
                  ),
                ),
              ],
            ),
          ),

          // Peringatan Minim Data untuk Oranye & Merah
          if (isOrangeOrRed)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFFCD34D)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.info_outline_rounded,
                      color: Color(0xFFD97706), size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Peringatan Data Terbatas (Minim Data)',
                            style: AppTheme.font(
                                size: 12.5,
                                weight: FontWeight.w800,
                                color: const Color(0xFF92400E))),
                        const SizedBox(height: 2),
                        Text(
                          'Data pendukung wearable untuk segmen ${activeLevel.code} terbatas. Jangan tunda mencari pertolongan medis jika mengalami keluhan tidak biasa.',
                          style: AppTheme.font(
                              size: 11.5,
                              color: const Color(0xFF78350F),
                              height: 1.3),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          if (isDataLimited)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.fieldFill,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.borderLight),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.info_outline_rounded,
                      color: AppTheme.textMuted, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Data belum cukup untuk dinilai',
                            style: AppTheme.font(
                                size: 12.5,
                                weight: FontWeight.w800,
                                color: AppTheme.textPrimary)),
                        const SizedBox(height: 2),
                        Text(
                          'Status kesehatan belum dapat ditentukan. Ini bukan deteksi deviasi atau kondisi stabil. Hubungkan wearable dan lengkapi konteks harian agar analisis personal dapat dimulai.',
                          style: AppTheme.font(
                              size: 11.5,
                              color: AppTheme.textSecondary,
                              height: 1.3),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

          if (!isDataLimited) ...[
            _ActionCard(
              color: const Color(0xFF10B981),
              title: 'Hijau',
              action: 'Lanjutkan aktivitas',
              desc:
                  'Panduan umum saja; ini bukan penilaian pribadi atau diagnosis.',
              isCurrent: activeLevel == ActionTriageLevel.green,
              onTap: () =>
                  _showTransitionDialog(context, ActionTriageLevel.green),
            ),
            _ActionCard(
              color: const Color(0xFFF59E0B),
              title: 'Kuning',
              action: 'Observasi & catat',
              desc:
                  'Catat perubahan yang Anda rasakan; aplikasi tidak menentukan penyebabnya.',
              isCurrent: activeLevel == ActionTriageLevel.yellow,
              onTap: () =>
                  _showTransitionDialog(context, ActionTriageLevel.yellow),
            ),
            _ActionCard(
              color: const Color(0xFFF97316),
              title: 'Oranye',
              action: 'Hubungi tenaga kesehatan',
              desc:
                  'Pertimbangkan konsultasi bila Anda khawatir atau keluhan berlanjut.',
              isCurrent: activeLevel == ActionTriageLevel.orange,
              onTap: () =>
                  _showTransitionDialog(context, ActionTriageLevel.orange),
            ),
            _ActionCard(
              color: const Color(0xFFDC2626),
              title: 'Merah',
              action: 'Ke IGD / darurat',
              desc:
                  'Untuk keadaan darurat, cari pertolongan segera dan jangan menunggu aplikasi.',
              isCurrent: activeLevel == ActionTriageLevel.red,
              onTap: () =>
                  _showTransitionDialog(context, ActionTriageLevel.red),
            ),
          ],
          const SizedBox(height: 14),

          // Tanda Bahaya (Red Flags)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFFCA5A5)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.warning_rounded,
                        color: Color(0xFFDC2626), size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Tanda Bahaya',
                        style: AppTheme.font(
                            size: 13.5,
                            weight: FontWeight.w800,
                            color: const Color(0xFF991B1B)),
                      ),
                    ),
                    Text('Lihat Semua',
                        style: AppTheme.font(
                            size: 11.5,
                            weight: FontWeight.w700,
                            color: const Color(0xFFDC2626))),
                  ],
                ),
                const SizedBox(height: 4),
                Text('Segera cari pertolongan medis jika mengalami:',
                    style: AppTheme.font(
                        size: 11.5, color: const Color(0xFF7F1D1D))),
                const SizedBox(height: 12),

                // 4 Red Flag Icons
                Row(
                  children: [
                    Expanded(
                        child: _RedFlagIcon(
                            Icons.heart_broken_outlined, 'Nyeri dada\nberat')),
                    Expanded(
                        child: _RedFlagIcon(
                            Icons.air_outlined, 'Sesak napas\nberat')),
                    Expanded(
                        child: _RedFlagIcon(
                            Icons.sick_outlined, 'Pingsan')),
                    Expanded(
                        child: _RedFlagIcon(
                            Icons.speed_outlined, 'Kondisi memburuk\ncepat')),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Action Button: + Catatan Harian Kesehatan
          OutlinedButton.icon(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                  builder: (_) => const GuidedDailyFlowScreen(initialStep: 5)),
            ),
            icon: const Icon(Icons.edit_note, color: AppTheme.primary),
            label: Text(
              '+ Catatan Harian Kesehatan',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTheme.font(
                  size: 13.5, weight: FontWeight.w700, color: AppTheme.primary),
            ),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: AppTheme.primaryLight, width: 1.2),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              minimumSize: const Size(double.infinity, 48),
            ),
          ),
          const SizedBox(height: 8),

          // Action Button: Bagikan ke Keluarga / Dokter
          ElevatedButton.icon(
            onPressed: () => _showShareDialog(context),
            icon: const Icon(Icons.share_outlined, size: 18),
            label: Text(
              'Bagikan ke Keluarga / Nakes',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTheme.font(
                  size: 14, weight: FontWeight.w700, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }

  void _showTransitionDialog(BuildContext context, ActionTriageLevel level) {
    final isOrangeOrRed =
        level == ActionTriageLevel.orange || level == ActionTriageLevel.red;
    final isDataLimited =
        isOrangeOrRed && !context.read<AppState>().hasCaparMetrics;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              width: 14,
              height: 14,
              decoration:
                  BoxDecoration(color: level.color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Panduan: ${level.code} – ${level.title}',
                style: AppTheme.font(
                    size: 15.5, weight: FontWeight.w800, color: level.color),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              level.description,
              style: AppTheme.font(
                  size: 13, color: AppTheme.textPrimary, height: 1.35),
            ),
            if (isDataLimited) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFFCA5A5)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.warning_amber_rounded,
                        color: Color(0xFFDC2626), size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Peringatan: Data sensor wearable saat ini bersifat minim/terbatas. Utamakan kondisi klinis Anda. Jika merasakan sesak napas berat atau nyeri dada, segera hubungi dokter atau IGD.',
                        style: AppTheme.font(
                            size: 11.5,
                            color: const Color(0xFF7F1D1D),
                            height: 1.3),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Tutup',
                style: AppTheme.font(
                    weight: FontWeight.w600, color: AppTheme.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(backgroundColor: level.color),
            child: const Text('Mengerti'),
          ),
        ],
      ),
    );
  }

  void _showShareDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Material(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Bagikan Laporan Kesehatan',
                  style: AppTheme.font(size: 16, weight: FontWeight.w700)),
              const SizedBox(height: 8),
              Text(
                'Ringkasan data observasi personal dan tren 7 hari siap diekspor dalam format PDF / ringkasan tautan aman.',
                style: AppTheme.font(
                    size: 12.5, color: AppTheme.textSecondary, height: 1.35),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: const Icon(Icons.picture_as_pdf_outlined,
                    color: AppTheme.primary),
                title: Text('Unduh Laporan PDF',
                    style: AppTheme.font(size: 13.5, weight: FontWeight.w600)),
                subtitle: Text(
                    'Laporan ringkas untuk dokter spesialis / faskes',
                    style: AppTheme.font(size: 11.5)),
                onTap: () {
                  Navigator.pop(ctx);
                  showSaved(context, 'Laporan PDF VidyaMedic berhasil dibuat');
                },
              ),
              ListTile(
                leading:
                    const Icon(Icons.groups_outlined, color: Color(0xFF0EA5E9)),
                title: Text('Kirim ke Keluarga / Caregiver',
                    style: AppTheme.font(size: 13.5, weight: FontWeight.w600)),
                subtitle: Text('Notifikasi pemantauan recovery aman',
                    style: AppTheme.font(size: 11.5)),
                onTap: () {
                  Navigator.pop(ctx);
                  showSaved(context, 'Ringkasan terkirim ke caregiver');
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final Color color;
  final String title;
  final String action;
  final String desc;
  final bool isCurrent;
  final VoidCallback? onTap;

  const _ActionCard({
    required this.color,
    required this.title,
    required this.action,
    required this.desc,
    this.isCurrent = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isCurrent ? color.withValues(alpha: 0.08) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isCurrent ? color : AppTheme.borderLight,
            width: isCurrent ? 1.8 : 1,
          ),
          boxShadow: isCurrent
              ? [
                  BoxShadow(
                    color: color.withValues(alpha: 0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : AppTheme.shadowSoft,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 12,
              height: 12,
              margin: const EdgeInsets.only(top: 4),
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(title,
                          style: AppTheme.font(
                              size: 13.5,
                              weight: FontWeight.w800,
                              color: color)),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text('— $action',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTheme.font(
                                size: 13, weight: FontWeight.w700)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(desc,
                      style: AppTheme.font(
                          size: 11.5,
                          color: AppTheme.textSecondary,
                          height: 1.25)),
                ],
              ),
            ),
            if (isCurrent)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                    color: color, borderRadius: BorderRadius.circular(6)),
                child: Text('Aktif',
                    style: AppTheme.font(
                        size: 9.5,
                        weight: FontWeight.w800,
                        color: Colors.white)),
              ),
          ],
        ),
      ),
    );
  }
}

class _RedFlagIcon extends StatelessWidget {
  final IconData icon;
  final String label;
  const _RedFlagIcon(this.icon, this.label);

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration:
              const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
          child: Icon(icon, size: 20, color: Color(0xFFDC2626)),
        ),
        const SizedBox(height: 6),
        Text(
          label,
          textAlign: TextAlign.center,
          style: AppTheme.font(
              size: 10,
              weight: FontWeight.w600,
              color: const Color(0xFF7F1D1D),
              height: 1.15),
        ),
      ],
    );
  }
}
