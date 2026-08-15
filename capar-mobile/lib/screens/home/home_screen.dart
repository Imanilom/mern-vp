import 'package:flutter/material.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/api_service.dart';
import '../../services/telemetry_controller.dart';
import '../../services/ble_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/evidence_chip.dart';
import '../ema/ema_dialogs.dart';

enum HomeStateMode { evaluable, qualityWarning, uncertainContext, candidate, persistent, recovery, recovered }

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
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
              _buildStreamingStatusBar(),
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



  Widget _buildStreamingStatusBar() {
    final telemetry = ref.watch(telemetryControllerProvider);
    final readingAsync = ref.watch(currentSensorReadingProvider);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: telemetry.isStreaming ? AppColors.tealSoft : AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: telemetry.isStreaming ? AppColors.teal : AppColors.line),
      ),
      child: Row(
        children: [
          Icon(
            telemetry.isStreaming ? Icons.rss_feed_rounded : Icons.sensors_off_rounded,
            size: 20,
            color: telemetry.isStreaming ? AppColors.teal : AppColors.gray,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  telemetry.isStreaming ? 'Streaming Aktif' : 'Streaming Tidak Aktif',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: telemetry.isStreaming ? AppColors.teal : AppColors.gray,
                  ),
                ),
                if (telemetry.isStreaming)
                  readingAsync.when(
                    data: (reading) => Text(
                      'HR: ${reading.heartRate} bpm | RMSSD: ${reading.rmssd} ms',
                      style: const TextStyle(fontSize: 11, color: AppColors.navy),
                    ),
                    loading: () => const Text('Menerima data...', style: TextStyle(fontSize: 11, color: AppColors.navy)),
                    error: (error, stackTrace) => const Text('Error membaca sensor', style: TextStyle(fontSize: 11, color: Colors.red)),
                  ),
              ],
            ),
          ),
          if (telemetry.isStreaming)
            TextButton(
              onPressed: () {
                ref.read(telemetryControllerProvider).stopStreaming();
              },
              child: const Text('Hentikan', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 12)),
            )
        ],
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

}
