import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/api_service.dart';
import '../../services/ble_service.dart';
import '../../theme/app_colors.dart';

class InsightScreen extends ConsumerStatefulWidget {
  const InsightScreen({super.key});

  @override
  ConsumerState<InsightScreen> createState() => _InsightScreenState();
}

class _InsightScreenState extends ConsumerState<InsightScreen> {
  Map<String, dynamic>? forecastData;
  bool isLoading = true;
  String? errorMsg;

  @override
  void initState() {
    super.initState();
    _loadForecast();
  }

  Future<void> _loadForecast() async {
    setState(() {
      isLoading = true;
      errorMsg = null;
    });
    try {
      final data = await ApiService.fetchForecast();
      if (mounted) {
        setState(() {
          forecastData = data;
          isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          errorMsg = e.toString();
          isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final readingAsync = ref.watch(currentSensorReadingProvider);
    final ble = ref.watch(bleServiceProvider);

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.teal,
          onRefresh: _loadForecast,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Header ─────────────────────────────────────────────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Insight & Prediksi',
                          style: TextStyle(
                            fontFamily: 'Plus Jakarta Sans',
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: AppColors.navy,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Personal recovery profile & horizon prediction',
                          style: TextStyle(fontSize: 12, color: AppColors.gray),
                        ),
                      ],
                    ),
                    IconButton(
                      tooltip: 'Refresh',
                      icon: isLoading
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.teal))
                          : const Icon(Icons.refresh_rounded, color: AppColors.teal),
                      onPressed: isLoading ? null : _loadForecast,
                    ),
                  ],
                ),
                const SizedBox(height: 18),

                // ── Live Sensor Mini-Card ───────────────────────────────────
                readingAsync.when(
                  data: (r) => _buildLiveSensorCard(r, ble),
                  loading: () => const SizedBox.shrink(),
                  error: (_, _) => const SizedBox.shrink(),
                ),
                const SizedBox(height: 14),

                // ── Forecast / Prediksi State ──────────────────────────────
                _buildForecastCard(),
                const SizedBox(height: 14),

                // ── Recovery Profile ───────────────────────────────────────
                _buildRecoveryProfileCard(),
                const SizedBox(height: 14),

                // ── Horizon Prediction ─────────────────────────────────────
                _buildHorizonCard(),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Live Sensor Mini-Card ─────────────────────────────────────────────────

  Widget _buildLiveSensorCard(dynamic r, BleService ble) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.tealSoft,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.teal.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.favorite_rounded, color: AppColors.teal, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'HR: ${r.heartRate} bpm · RMSSD: ${r.rmssd.toStringAsFixed(1)} ms',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.teal),
                ),
                Text(
                  'DFA α1: ${r.dfaAlpha1.toStringAsFixed(2)} · Kualitas: ${r.signalQuality}% · ${ble.motionState}',
                  style: const TextStyle(fontSize: 11, color: AppColors.navy),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: AppColors.teal, borderRadius: BorderRadius.circular(6)),
            child: const Text('LIVE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Colors.white)),
          ),
        ],
      ),
    );
  }

  // ── Forecast Card ─────────────────────────────────────────────────────────

  Widget _buildForecastCard() {
    return Container(
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
            'PREDIKSI STATE & INSIGHT',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray, letterSpacing: 0.5),
          ),
          const SizedBox(height: 12),
          if (isLoading)
            const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator(color: AppColors.teal, strokeWidth: 2)))
          else if (errorMsg != null)
            _buildErrorState()
          else if (forecastData == null)
            _buildEmptyForecast()
          else
            _buildForecastContent(forecastData!),
        ],
      ),
    );
  }

  Widget _buildEmptyForecast() {
    return Column(
      children: [
        const Icon(Icons.auto_graph_rounded, size: 40, color: AppColors.graySoft),
        const SizedBox(height: 10),
        const Text(
          'Prediksi belum tersedia',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.navy),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
        const Text(
          'Kumpulkan minimal 3 hari data sensor untuk mengaktifkan prediksi horizon.',
          style: TextStyle(fontSize: 12, color: AppColors.gray),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 14),
        OutlinedButton.icon(
          onPressed: _loadForecast,
          icon: const Icon(Icons.refresh_rounded, size: 14),
          label: const Text('Coba Lagi'),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.teal,
            side: const BorderSide(color: AppColors.teal),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
      ],
    );
  }

  Widget _buildErrorState() {
    return Column(
      children: [
        const Icon(Icons.cloud_off_rounded, size: 36, color: AppColors.gray),
        const SizedBox(height: 8),
        const Text('Tidak dapat memuat prediksi', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.navy)),
        const SizedBox(height: 4),
        const Text('Periksa koneksi internet dan coba lagi.', style: TextStyle(fontSize: 11.5, color: AppColors.gray)),
        const SizedBox(height: 12),
        ElevatedButton.icon(
          onPressed: _loadForecast,
          icon: const Icon(Icons.refresh_rounded, size: 14),
          label: const Text('Refresh'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.teal,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
      ],
    );
  }

  Widget _buildForecastContent(Map<String, dynamic> data) {
    final predictedState = data['predicted_state']?.toString() ?? '–';
    final confidence = (data['confidence'] as num?)?.toDouble() ?? 0.0;
    final horizon = data['horizon_hours']?.toString() ?? '–';
    final trend = data['trend']?.toString() ?? '–';

    Color stateColor = AppColors.teal;
    if (predictedState.toLowerCase().contains('persistent') || predictedState.toLowerCase().contains('deviasi')) {
      stateColor = AppColors.red;
    } else if (predictedState.toLowerCase().contains('candidate')) {
      stateColor = AppColors.amber;
    } else if (predictedState.toLowerCase().contains('recovery')) {
      stateColor = AppColors.purple;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('State Terprediksi', style: TextStyle(fontSize: 10, color: AppColors.gray)),
                  const SizedBox(height: 4),
                  Text(
                    predictedState,
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: stateColor),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: stateColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  Text('${(confidence * 100).toStringAsFixed(0)}%', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: stateColor)),
                  Text('confidence', style: TextStyle(fontSize: 9, color: stateColor)),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _buildForecastMetric('Horizon', '$horizon jam'),
            const SizedBox(width: 10),
            _buildForecastMetric('Tren', trend),
          ],
        ),
      ],
    );
  }

  Widget _buildForecastMetric(String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.bg,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 10, color: AppColors.gray, fontWeight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.navy)),
          ],
        ),
      ),
    );
  }

  // ── Recovery Profile Card ─────────────────────────────────────────────────

  Widget _buildRecoveryProfileCard() {
    final metrics = forecastData?['recovery_profile'] as Map<String, dynamic>?;

    return Container(
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
            'PROFIL RECOVERY PERSONAL',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray, letterSpacing: 0.5),
          ),
          const SizedBox(height: 12),
          if (metrics == null)
            const Text(
              'Data profil belum tersedia. Dibutuhkan minimal 1 episode selesai.',
              style: TextStyle(fontSize: 12, color: AppColors.gray),
            )
          else ...[
            _buildProfileRow('Rata-rata durasi episode', '${metrics['avg_duration_h'] ?? '–'} jam'),
            _buildProfileRow('Rata-rata AUC burden', '${metrics['avg_auc'] ?? '–'} SD·jam'),
            _buildProfileRow('Waktu recovery median', '${metrics['median_recovery_h'] ?? '–'} jam'),
            _buildProfileRow('Total episode tercatat', '${metrics['total_episodes'] ?? '–'} episode'),
          ],
        ],
      ),
    );
  }

  Widget _buildProfileRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.gray)),
          Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.navy)),
        ],
      ),
    );
  }

  // ── Horizon Prediction Card ───────────────────────────────────────────────

  Widget _buildHorizonCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.teal.withValues(alpha: 0.08), AppColors.purpleSoft],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.teal.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.tips_and_updates_rounded, color: AppColors.teal, size: 18),
              SizedBox(width: 8),
              Text('INSIGHT RISET', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.teal, letterSpacing: 0.5)),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'Data Anda berkontribusi pada pemahaman pola recovery autonomik berbasis HRV longitudinal.',
            style: TextStyle(fontSize: 12.5, color: AppColors.navy, height: 1.5),
          ),
          const SizedBox(height: 8),
          const Text(
            'Semakin konsisten streaming, semakin akurat model prediksi personal Anda.',
            style: TextStyle(fontSize: 11.5, color: AppColors.gray, fontStyle: FontStyle.italic),
          ),
        ],
      ),
    );
  }
}
