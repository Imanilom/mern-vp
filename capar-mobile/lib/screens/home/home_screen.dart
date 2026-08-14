import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/evidence_chip.dart';
import '../ema/ema_dialogs.dart';

enum HomeStateMode { evaluable, qualityWarning, uncertainContext, candidate, persistent, recovery, recovered }

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  HomeStateMode currentMode = HomeStateMode.evaluable;
  bool isSyncing = false;

  @override
  void initState() {
    super.initState();
    _loadLiveStatus();
  }

  Future<void> _loadLiveStatus() async {
    setState(() => isSyncing = true);
    final sq = await ApiService.fetchSignalQuality();
    if (sq != null && sq['status'] == 'warning') {
      if (mounted) setState(() => currentMode = HomeStateMode.qualityWarning);
    }
    if (mounted) setState(() => isSyncing = false);
  }

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
              _buildQuickContextCheckInBar(),
              const SizedBox(height: 14),

              // Animated Active State Content View
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 350),
                switchInCurve: Curves.easeOutCubic,
                switchOutCurve: Curves.easeInCubic,
                transitionBuilder: (child, animation) {
                  return FadeTransition(
                    opacity: animation,
                    child: SlideTransition(
                      position: Tween<Offset>(
                        begin: const Offset(0.0, 0.04),
                        end: Offset.zero,
                      ).animate(animation),
                      child: child,
                    ),
                  );
                },
                child: KeyedSubtree(
                  key: ValueKey<HomeStateMode>(currentMode),
                  child: _buildCurrentStateContent(currentMode),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCurrentStateContent(HomeStateMode mode) {
    switch (mode) {
      case HomeStateMode.evaluable:
        return _buildEvaluableState();
      case HomeStateMode.qualityWarning:
        return _buildQualityWarningState();
      case HomeStateMode.uncertainContext:
        return _buildUncertainContextState();
      case HomeStateMode.candidate:
        return _buildCandidateState();
      case HomeStateMode.persistent:
        return _buildPersistentState();
      case HomeStateMode.recovery:
        return _buildRecoveryState();
      case HomeStateMode.recovered:
        return _buildRecoveredState();
    }
  }



  Widget _buildQuickContextCheckInBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          const Icon(Icons.touch_app_rounded, size: 16, color: AppColors.teal),
          const SizedBox(width: 8),
          const Text(
            'Konteks:',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.navy),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildContextPill('🛋️ Duduk'),
                  _buildContextPill('🚶‍♂️ Berjalan'),
                  _buildContextPill('💻 Bekerja'),
                  _buildContextPill('🏃‍♂️ Olahraga'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContextPill(String label) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: InkWell(
        onTap: () {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('✓ Konteks dikonfirmasi: $label'),
              backgroundColor: AppColors.teal,
              duration: const Duration(seconds: 1),
            ),
          );
        },
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: AppColors.graySoft,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            label,
            style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.navy),
          ),
        ),
      ),
    );
  }

  // A05 Evaluable / Baseline Compatible
  Widget _buildEvaluableState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        EvidenceChip.evaluable(),
        const SizedBox(height: 12),

        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: const Border(left: BorderSide(color: AppColors.green, width: 5)),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8)],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              EvidenceChip.baselineCompatible(),
              const SizedBox(height: 8),
              const Text(
                'Data skor belum tersedia',
                style: TextStyle(
                  fontFamily: 'Plus Jakarta Sans',
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.gray,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Menunggu stream metrik...',
                style: TextStyle(fontSize: 11.5, color: AppColors.gray),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // A06 Quality Warning
  Widget _buildQualityWarningState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        EvidenceChip.qualityWarning(),
        const SizedBox(height: 12),

        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.waves_rounded, color: AppColors.gray, size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Data belum layak dianalisis',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.navy),
                  ),
                ],
              ),
              SizedBox(height: 6),
              Text(
                'Periksa sensor Polar H10 atau tunggu hingga kualitas data membaik. State sebelumnya tidak diubah.',
                style: TextStyle(fontSize: 11.5, color: AppColors.gray, height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: () {
              Navigator.pushNamed(context, '/pairing');
            },
            icon: const Icon(Icons.build_rounded, size: 16),
            label: const Text('Perbaiki Sensor'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.teal,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
      ],
    );
  }

  // A07 Uncertain Context
  Widget _buildUncertainContextState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        EvidenceChip.uncertainContext(),
        const SizedBox(height: 12),

        const Text(
          'Konfirmasikan aktivitas agar perubahan fisiologis dapat ditafsirkan pada konteks yang tepat.',
          style: TextStyle(fontSize: 12, color: AppColors.gray, height: 1.4),
        ),
        const SizedBox(height: 16),

        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => EmaDialogs.showEma1(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.teal,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Konfirmasi Aktivitas (Isi EMA 1)', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }

  // A08 Deviation Candidate
  Widget _buildCandidateState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        EvidenceChip.candidate(),
        const SizedBox(height: 12),

        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.amberSoft,
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'DEVIASI KANDIDAT',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.amber),
              ),
              SizedBox(height: 4),
              Text(
                'Data belum tersedia',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.amber),
              ),
              SizedBox(height: 4),
              Text(
                'Belum menjadi episode. Sistem menunggu persistensi pada beberapa window.',
                style: TextStyle(fontSize: 11.5, color: AppColors.ink, height: 1.4),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // A09 Persistent Deviation
  Widget _buildPersistentState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        EvidenceChip.persistent(),
        const SizedBox(height: 12),

        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.redSoft,
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'DEVIASI PERSISTEN',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.red),
              ),
              SizedBox(height: 4),
              Text(
                'Data belum tersedia',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.red),
              ),
              SizedBox(height: 4),
              Text(
                'Menunggu kalkulasi skor dari API...',
                style: TextStyle(fontSize: 11.5, color: AppColors.ink),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => EmaDialogs.showEma2(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.red,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Isi EMA 2 (Gejala / Strain)', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }

  // A11 Recovery
  Widget _buildRecoveryState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        EvidenceChip.recovery(),
        const SizedBox(height: 12),

        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.purpleSoft,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.purple.withValues(alpha: 0.2)),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'RECOVERY BERJALAN',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.purple),
              ),
              SizedBox(height: 4),
              Text(
                'Data durasi belum tersedia',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.purple),
              ),
              SizedBox(height: 6),
              Text(
                'Prediksi dari API belum tersedia',
                style: TextStyle(fontSize: 11.5, color: AppColors.ink),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // A12 Recovered
  Widget _buildRecoveredState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        EvidenceChip.recovered(),
        const SizedBox(height: 12),

        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: const Column(
            children: [
              Text('Kembali stabil', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.navy)),
              SizedBox(height: 12),
              Text('Detail statistik episode akan tersedia jika terhubung ke API', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: AppColors.gray)),
            ],
          ),
        ),
        const SizedBox(height: 16),

        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => EmaDialogs.showEma4(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.teal,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Isi EMA 4 (Refleksi Episode)', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }

  // Helper Widgets
  Widget _buildBaselineJourneySummaryCard() {
    return const SizedBox.shrink();
  }

  Widget _buildTodaysMissionsCard() {
    return const SizedBox.shrink();
  }

  Widget _buildMissionRow(String title, String status, bool isDone, VoidCallback? onTap) {
    return const SizedBox.shrink();
  }

  Widget _buildEpisodeProgressStepperCard() {
    return const SizedBox.shrink();
  }

  Widget _buildStepDot(String label, bool isDone, Color activeColor) {
    return Column(
      children: [
        CircleAvatar(
          radius: 8,
          backgroundColor: isDone ? activeColor : AppColors.graySoft,
          child: isDone ? const Icon(Icons.check, size: 10, color: Colors.white) : null,
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 9.5,
            fontWeight: isDone ? FontWeight.w700 : FontWeight.w500,
            color: isDone ? AppColors.navy : AppColors.gray,
          ),
        ),
      ],
    );
  }

  Widget _buildMetricRow(String label, String value, Color valColor) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.gray)),
          Text(value, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: valColor)),
        ],
      ),
    );
  }

  Widget _buildBullet(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4.0),
      child: Row(
        children: [
          const Icon(Icons.circle, size: 6, color: AppColors.gray),
          const SizedBox(width: 8),
          Text(text, style: const TextStyle(fontSize: 12, color: AppColors.ink)),
        ],
      ),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  final List<double> values;
  final Color color;

  _SparklinePainter({required this.values, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;

    final double minVal = values.reduce((a, b) => a < b ? a : b);
    final double maxVal = values.reduce((a, b) => a > b ? a : b);
    final double range = (maxVal - minVal) == 0 ? 1.0 : (maxVal - minVal);

    final double stepX = size.width / (values.length - 1);

    final path = Path();
    final areaPath = Path();

    double getX(int i) => i * stepX;
    double getY(double val) => size.height - ((val - minVal) / range) * (size.height * 0.70) - (size.height * 0.15);

    path.moveTo(getX(0), getY(values[0]));
    areaPath.moveTo(getX(0), size.height);
    areaPath.lineTo(getX(0), getY(values[0]));

    for (int i = 0; i < values.length - 1; i++) {
      final x1 = getX(i);
      final y1 = getY(values[i]);
      final x2 = getX(i + 1);
      final y2 = getY(values[i + 1]);

      final cx1 = x1 + (x2 - x1) / 2;
      final cy1 = y1;
      final cx2 = x1 + (x2 - x1) / 2;
      final cy2 = y2;

      path.cubicTo(cx1, cy1, cx2, cy2, x2, y2);
      areaPath.cubicTo(cx1, cy1, cx2, cy2, x2, y2);
    }

    areaPath.lineTo(size.width, size.height);
    areaPath.close();

    final areaShader = LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [
        color.withValues(alpha: 0.25),
        color.withValues(alpha: 0.0),
      ],
    ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    canvas.drawPath(areaPath, Paint()..shader = areaShader..style = PaintingStyle.fill);

    final linePaint = Paint()
      ..color = color
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final glowPaint = Paint()
      ..color = color.withValues(alpha: 0.35)
      ..strokeWidth = 5.0
      ..style = PaintingStyle.stroke;

    canvas.drawPath(path, glowPaint);
    canvas.drawPath(path, linePaint);
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter oldDelegate) => oldDelegate.values != values;
}
