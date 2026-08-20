import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/api_service.dart';
import '../../services/ble_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/markov_heatmap_widget.dart';
import '../../widgets/calibration_history_widget.dart';

class InsightScreen extends ConsumerStatefulWidget {
  const InsightScreen({super.key});

  @override
  ConsumerState<InsightScreen> createState() => _InsightScreenState();
}

class _InsightScreenState extends ConsumerState<InsightScreen> {
  Map<String, dynamic>? forecastData;
  Map<String, dynamic>? markovData;
  List<Map<String, dynamic>> calibrationHistory = [];
  int selectedHorizon = 3;
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
      final results = await Future.wait([
        ApiService.fetchForecast(),
        ApiService.fetchMarkovModel(horizon: selectedHorizon),
        ApiService.fetchCalibrationHistory(),
      ]);
      final fData = results[0] as Map<String, dynamic>?;
      final mData = results[1] as Map<String, dynamic>?;
      final cData = results[2] as List<Map<String, dynamic>>;

      if (mounted) {
        setState(() {
          forecastData = fData;
          markovData = mData;
          calibrationHistory = cData;
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

                // ── Markov Transition Prediction & Heatmap ────────────────
                if (markovData != null) ...[
                  _buildMarkovPredictionCard(),
                  const SizedBox(height: 14),
                  if (markovData!['matrix'] != null) ...[
                    MarkovHeatmapWidget(markovData: markovData!),
                    const SizedBox(height: 14),
                  ],
                ],

                // ── Recovery Profile ───────────────────────────────────────
                _buildRecoveryProfileCard(),
                const SizedBox(height: 14),

                // ── Calibration History ───────────────────────────────────
                if (calibrationHistory.isNotEmpty) ...[
                  CalibrationHistoryWidget(history: calibrationHistory),
                  const SizedBox(height: 14),
                ],

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
    final predictedState = data['predicted_state']?.toString() ??
        (data['most_likely_next'] != null ? data['most_likely_next']['state']?.toString() : null) ??
        data['current_state']?.toString() ??
        'BASELINE_COMPATIBLE';

    final confidence = (data['confidence'] as num?)?.toDouble() ??
        (data['most_likely_next'] != null ? (data['most_likely_next']['prob'] as num?)?.toDouble() : null) ??
        0.88;

    final horizon = data['horizon_hours']?.toString() ?? '3';
    final trend = data['trend']?.toString() ?? data['slope_direction']?.toString() ?? 'Stabil (Normal)';

    Color stateColor = AppColors.teal;
    final String cleanState = predictedState.replaceAll('_', ' ');
    if (cleanState.toLowerCase().contains('persistent') || cleanState.toLowerCase().contains('deviasi')) {
      stateColor = AppColors.red;
    } else if (cleanState.toLowerCase().contains('candidate')) {
      stateColor = AppColors.amber;
    } else if (cleanState.toLowerCase().contains('recovery')) {
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
                    cleanState,
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

  // ── Markov State Transition Prediction Card ──────────────────────────────

  double typeofScoreToDouble(dynamic val) {
    if (val is num) return val.toDouble();
    if (val is String) return double.tryParse(val) ?? 0.0;
    return 0.0;
  }

  Widget _buildMarkovPredictionCard() {
    if (markovData == null || markovData!['prediction'] == null) {
      return const SizedBox.shrink();
    }

    final pred = markovData!['prediction'] as Map<String, dynamic>? ?? {};
    final currentState = pred['current_state']?.toString() ?? 'BASELINE_COMPATIBLE';
    final nextState = pred['most_likely_next_state']?.toString() ?? 'BASELINE_COMPATIBLE';
    final double prob = typeofScoreToDouble(pred['most_likely_probability'] ?? 0.0);
    final vectorMap = pred['vector'] as Map<String, dynamic>? ?? {};

    Color getStatusColor(String state) {
      final s = state.toUpperCase();
      if (s.contains('PERSISTENT')) return AppColors.red;
      if (s.contains('CANDIDATE') || s.contains('ALERT')) return AppColors.amber;
      if (s.contains('RECOVERY')) return AppColors.purple;
      return AppColors.teal;
    }

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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'PREDIKSI MARKOV MODEL',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: AppColors.purple,
                      letterSpacing: 0.5,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Probabilitas Transisi State Next',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: AppColors.navy,
                    ),
                  ),
                ],
              ),
              DropdownButtonHideUnderline(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.purpleSoft,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.purple.withValues(alpha: 0.3)),
                  ),
                  child: DropdownButton<int>(
                    value: selectedHorizon,
                    icon: const Icon(Icons.arrow_drop_down, color: AppColors.purple, size: 18),
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.purple),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => selectedHorizon = val);
                        _loadForecast();
                      }
                    },
                    items: const [
                      DropdownMenuItem(value: 1, child: Text('Horizon +1 Window')),
                      DropdownMenuItem(value: 3, child: Text('Horizon +3 Window')),
                      DropdownMenuItem(value: 5, child: Text('Horizon +5 Window')),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Result badge
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: getStatusColor(nextState).withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: getStatusColor(nextState).withValues(alpha: 0.25)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Prediksi State Berikutnya (Next State)',
                        style: TextStyle(fontSize: 10.5, color: AppColors.gray, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        nextState.replaceAll('_', ' '),
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: getStatusColor(nextState),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'State Saat Ini: ${currentState.replaceAll('_', ' ')}',
                        style: const TextStyle(fontSize: 10.5, color: AppColors.gray),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: getStatusColor(nextState),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    children: [
                      Text(
                        '${(prob * 100).toStringAsFixed(0)}%',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white),
                      ),
                      const Text(
                        'peluang',
                        style: TextStyle(fontSize: 9, color: Colors.white70),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Vector Probabilities breakdown progress bars
          const Text(
            'DISTRIBUSI PROBABILITAS VEKTOR PREDIKSI',
            style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: AppColors.gray),
          ),
          const SizedBox(height: 8),

          ...vectorMap.entries.map((entry) {
            final stName = entry.key;
            final double stProb = typeofScoreToDouble(entry.value);
            final stColor = getStatusColor(stName);

            return Padding(
              padding: const EdgeInsets.only(bottom: 6.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        stName.replaceAll('_', ' '),
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.navy),
                      ),
                      Text(
                        '${(stProb * 100).toStringAsFixed(1)}%',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: stColor),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: stProb.clamp(0.0, 1.0),
                      minHeight: 6,
                      backgroundColor: AppColors.line,
                      valueColor: AlwaysStoppedAnimation<Color>(stColor),
                    ),
                  ),
                ],
              ),
            );
          }),
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
