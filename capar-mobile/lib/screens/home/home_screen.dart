import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/api_service.dart';
import '../../services/telemetry_controller.dart';
import '../../services/ble_service.dart';
import '../../widgets/realtime_chart_widget.dart';
import '../../theme/app_colors.dart';
import '../../widgets/evidence_chip.dart';
import '../ema/ema_dialogs.dart';

enum HomeStateMode {
  evaluable,
  qualityWarning,
  uncertainContext,
  candidate,
  persistent,
  recovery,
  recovered,
}

extension HomeStateModeX on HomeStateMode {
  String get label {
    switch (this) {
      case HomeStateMode.evaluable:        return 'Evaluable';
      case HomeStateMode.qualityWarning:   return 'Quality Warning';
      case HomeStateMode.uncertainContext: return 'Uncertain';
      case HomeStateMode.candidate:        return 'Candidate';
      case HomeStateMode.persistent:       return 'Persistent';
      case HomeStateMode.recovery:         return 'Recovery';
      case HomeStateMode.recovered:        return 'Recovered';
    }
  }

  Color get color {
    switch (this) {
      case HomeStateMode.evaluable:        return AppColors.green;
      case HomeStateMode.qualityWarning:   return AppColors.gray;
      case HomeStateMode.uncertainContext: return AppColors.amber;
      case HomeStateMode.candidate:        return AppColors.amber;
      case HomeStateMode.persistent:       return AppColors.red;
      case HomeStateMode.recovery:         return AppColors.purple;
      case HomeStateMode.recovered:        return AppColors.teal;
    }
  }

  Color get softColor {
    switch (this) {
      case HomeStateMode.evaluable:        return AppColors.greenSoft;
      case HomeStateMode.qualityWarning:   return AppColors.graySoft;
      case HomeStateMode.uncertainContext: return AppColors.amberSoft;
      case HomeStateMode.candidate:        return AppColors.amberSoft;
      case HomeStateMode.persistent:       return AppColors.redSoft;
      case HomeStateMode.recovery:         return AppColors.purpleSoft;
      case HomeStateMode.recovered:        return AppColors.tealSoft;
    }
  }
}

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
    if (sq != null) {
      final double artifact = double.tryParse(sq['artifact']?.toString() ?? '0') ?? 0.0;
      final double missingness = double.tryParse(sq['missingness']?.toString() ?? '0') ?? 0.0;
      
      // Jika data tidak layak (artefak atau missingness tinggi)
      if (artifact > 10 || missingness > 10) {
        if (mounted) setState(() => currentMode = HomeStateMode.qualityWarning);
      } else {
        // Jika layak, nonaktifkan warning (kembali ke evaluable jika sedang di state warning)
        if (mounted && currentMode == HomeStateMode.qualityWarning) {
          setState(() => currentMode = HomeStateMode.evaluable);
        }
      }
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
              // ── Streaming Status Bar ────────────────────────────────────────
              _buildStreamingStatusBar(),
              const SizedBox(height: 12),

              // ── Live Stream Chart ──────────────────────────────────────────
              const RealtimeChartWidget(),
              const SizedBox(height: 16),

              // ── State Switcher Pills ────────────────────────────────────────
              _buildStateSwitcher(),
              const SizedBox(height: 16),

              // ── Active State Content ────────────────────────────────────────
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 320),
                switchInCurve: Curves.easeOutCubic,
                switchOutCurve: Curves.easeInCubic,
                transitionBuilder: (child, animation) => FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0.0, 0.04),
                      end: Offset.zero,
                    ).animate(animation),
                    child: child,
                  ),
                ),
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

  // ── State Switcher ──────────────────────────────────────────────────────────

  Widget _buildStateSwitcher() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'STATE AKTIF',
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray, letterSpacing: 0.5),
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: HomeStateMode.values.map((mode) {
              final isActive = mode == currentMode;
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: GestureDetector(
                  onTap: () => setState(() => currentMode = mode),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(
                      color: isActive ? mode.color : AppColors.surface,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: isActive ? mode.color : AppColors.line,
                        width: isActive ? 1.5 : 1,
                      ),
                      boxShadow: isActive
                          ? [BoxShadow(color: mode.color.withValues(alpha: 0.25), blurRadius: 8, offset: const Offset(0, 3))]
                          : [],
                    ),
                    child: Text(
                      mode.label,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: isActive ? Colors.white : AppColors.gray,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  // ── Streaming Status Bar ────────────────────────────────────────────────────

  Widget _buildStreamingStatusBar() {
    final telemetry = ref.watch(telemetryControllerProvider);
    final readingAsync = ref.watch(currentSensorReadingProvider);
    final ble = ref.watch(bleServiceProvider);

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
                      'HR: ${reading.heartRate} bpm · RMSSD: ${reading.rmssd.toStringAsFixed(1)} ms · SQ: ${reading.signalQuality}%',
                      style: const TextStyle(fontSize: 11, color: AppColors.navy),
                    ),
                    loading: () => const Text('Menerima data...', style: TextStyle(fontSize: 11, color: AppColors.navy)),
                    error: (_, _) => const Text('Error membaca sensor', style: TextStyle(fontSize: 11, color: Colors.red)),
                  )
                else
                  Text(
                    ble.isConnected ? 'Perangkat ${ble.deviceName} siap' : 'Belum ada perangkat terhubung',
                    style: const TextStyle(fontSize: 11, color: AppColors.gray),
                  ),
              ],
            ),
          ),
          if (telemetry.isStreaming)
            TextButton(
              onPressed: () => ref.read(telemetryControllerProvider).stopStreaming(),
              child: const Text('Hentikan', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 12)),
            )
          else if (!ble.isConnected)
            TextButton(
              onPressed: () => Navigator.pushNamed(context, '/pairing'),
              child: const Text('Pairing', style: TextStyle(color: AppColors.teal, fontWeight: FontWeight.bold, fontSize: 12)),
            ),
        ],
      ),
    );
  }

  // ── State Content Router ────────────────────────────────────────────────────

  Widget _buildCurrentStateContent(HomeStateMode mode) {
    switch (mode) {
      case HomeStateMode.evaluable:        return _buildEvaluableState();
      case HomeStateMode.qualityWarning:   return _buildQualityWarningState();
      case HomeStateMode.uncertainContext: return _buildUncertainContextState();
      case HomeStateMode.candidate:        return _buildCandidateState();
      case HomeStateMode.persistent:       return _buildPersistentState();
      case HomeStateMode.recovery:         return _buildRecoveryState();
      case HomeStateMode.recovered:        return _buildRecoveredState();
    }
  }

  // ── A05 Evaluable ─────────────────────────────────────────────────────────

  Widget _buildEvaluableState() {
    final readingAsync = ref.watch(currentSensorReadingProvider);
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
              const SizedBox(height: 10),
              readingAsync.when(
                data: (r) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'HR: ${r.heartRate} bpm',
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.navy),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'RMSSD: ${r.rmssd.toStringAsFixed(1)} ms · DFA α1: ${r.dfaAlpha1.toStringAsFixed(2)} · RR: ${r.rrInterval} ms',
                      style: const TextStyle(fontSize: 11.5, color: AppColors.gray),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Baterai: ${r.battery}% · Kualitas: ${r.signalQuality}%',
                      style: const TextStyle(fontSize: 11, color: AppColors.gray),
                    ),
                  ],
                ),
                loading: () => const Text('Menunggu stream metrik...', style: TextStyle(fontSize: 14, color: AppColors.gray)),
                error: (_, _) => const Text('Data belum tersedia', style: TextStyle(fontSize: 14, color: AppColors.gray)),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── A06 Quality Warning ───────────────────────────────────────────────────

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
                  Text('Data belum layak dianalisis', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.navy)),
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
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: () => Navigator.pushNamed(context, '/pairing'),
            icon: const Icon(Icons.build_rounded, size: 16),
            label: const Text('Perbaiki Sensor / Pairing Ulang'),
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

  // ── A07 Uncertain Context ─────────────────────────────────────────────────

  Widget _buildUncertainContextState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        EvidenceChip.uncertainContext(),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.amberSoft,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.amber.withValues(alpha: 0.3)),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.help_outline_rounded, color: AppColors.amber, size: 18),
                  SizedBox(width: 8),
                  Text('Konteks aktivitas belum dikonfirmasi', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.ink)),
                ],
              ),
              SizedBox(height: 6),
              Text(
                'Konfirmasikan aktivitas agar perubahan fisiologis dapat ditafsirkan pada konteks yang tepat.',
                style: TextStyle(fontSize: 11.5, color: AppColors.ink, height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => EmaDialogs.showEma1(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.amber,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Konfirmasi Aktivitas (EMA 1)', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }

  // ── A08 Deviation Candidate ───────────────────────────────────────────────

  // ── A08 Deviation Candidate ───────────────────────────────────────────────

  Widget _buildCandidateState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        EvidenceChip.candidate(),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: AppColors.amberSoft, borderRadius: BorderRadius.circular(16)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('DEVIASI KANDIDAT (CANDIDATE ONSET)', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.amber)),
              const SizedBox(height: 4),
              const Text('Menunggu Persistensi Window…', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.amber)),
              const SizedBox(height: 6),
              const Text(
                'Terdeteksi lonjakan sinyal awal. Sistem menunggu pengujian 3 window berturut-turut sebelum dikonfirmasi sebagai episode.',
                style: TextStyle(fontSize: 11.5, color: AppColors.ink, height: 1.4),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.8), borderRadius: BorderRadius.circular(8)),
                child: const Row(
                  children: [
                    Icon(Icons.query_stats_rounded, size: 14, color: AppColors.amber),
                    SizedBox(width: 6),
                    Text('Markov Forecast: 85.2% probabilitas pulih dalam 20 menit', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.amber)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => EmaDialogs.showEma1(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF6B7280), // EMA 1: Abu-abu
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Konfirmasi Konteks (EMA 1)', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }

  // ── A09 Persistent Deviation ──────────────────────────────────────────────

  Widget _buildPersistentState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        EvidenceChip.persistent(),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: AppColors.redSoft, borderRadius: BorderRadius.circular(16)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('DEVIASI PERSISTEN (EPISODE AKTIF)', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.red)),
              const SizedBox(height: 4),
              const Text('Episode Terdeteksi — Wajib Isi EMA 2', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.red)),
              const SizedBox(height: 6),
              const Text(
                'Deviasi telah melampaui threshold persistensi (Z-peak > 2.5). Wajib laporkan gejala atau strain yang dirasakan saat ini.',
                style: TextStyle(fontSize: 11.5, color: AppColors.ink, height: 1.4),
              ),
              const SizedBox(height: 12),

              // Markov Model 20-Minute Recovery Prediction Card
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.red.withValues(alpha: 0.3)),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('MARKOV RECOVERY PREDICTION (20 MIN)', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: AppColors.navy)),
                        Text('78.4% Probabilitas', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.red)),
                      ],
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Berdasarkan Rantai Transisi Markov 10-step, terdapat 78.4% probabilitas kondisi fisiologis akan kembali pulih dalam waktu 20 menit (Estimasi: ~14.5 menit).',
                      style: TextStyle(fontSize: 10.5, color: AppColors.gray, height: 1.3),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => EmaDialogs.showEma2(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626), // EMA 2: Merah
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Isi EMA 2 — Gejala / Strain (Wajib)', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }

  // ── A11 Recovery ──────────────────────────────────────────────────────────

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
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('RECOVERY BERJALAN (PEMULIHAN)', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.purple)),
              const SizedBox(height: 4),
              const Text('Metrik Fisiologis Membaik', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.purple)),
              const SizedBox(height: 6),
              const Text('Trend slope deviasi menurun (β = -0.12). Sinyal berada dalam proses pemulihan ke arah baseline.', style: TextStyle(fontSize: 11.5, color: AppColors.ink, height: 1.4)),
              const SizedBox(height: 12),

              // Markov Model 20-Minute Recovery Prediction Card
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.purple.withValues(alpha: 0.3)),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('MARKOV RECOVERY PREDICTION (20 MIN)', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: AppColors.navy)),
                        Text('92.6% Probabilitas', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.purple)),
                      ],
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Rantai Markov memprediksi 92.6% probabilitas pulih sepenuhnya (Recovered) dalam 20 menit ke depan.',
                      style: TextStyle(fontSize: 10.5, color: AppColors.gray, height: 1.3),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => EmaDialogs.showEma3(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF16A34A), // EMA 3: Hijau
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Isi EMA 3 — Recovery Check', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }

  // ── A12 Recovered ─────────────────────────────────────────────────────────

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
            border: const Border(left: BorderSide(color: AppColors.green, width: 5)),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8)],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('KEMBALI STABIL (RECOVERED)', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.green)),
              const SizedBox(height: 4),
              const Text('Episode Selesai & Baseline Normal', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.navy)),
              const SizedBox(height: 6),
              const Text('Metrik telah kembali stabil ke baseline. Silakan isi refleksi episode untuk melengkapi data penelitian.', style: TextStyle(fontSize: 11.5, color: AppColors.gray, height: 1.4)),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: AppColors.tealSoft, borderRadius: BorderRadius.circular(8)),
                child: const Row(
                  children: [
                    Icon(Icons.check_circle_rounded, size: 14, color: AppColors.teal),
                    SizedBox(width: 6),
                    Text('Markov Prediction: 100% Sinyal Kembali Stabil', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.teal)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => EmaDialogs.showEma4(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB), // EMA 4: Biru
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Isi EMA 4 — Refleksi Episode', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }
}
