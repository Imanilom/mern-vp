import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../../widgets/evidence_chip.dart';
import '../ema/ema_dialogs.dart';
import '../../services/api_service.dart';
import '../../services/socket_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  // Real dynamic state
  String evidenceState = 'QUALITY_WARNING'; // Default before data arrives
  String physiologicalState = 'BASELINE_COMPATIBLE';
  double anomalyScore = 0.0;
  String currentActivity = 'Unknown';
  bool isSending = false;

  @override
  void initState() {
    super.initState();
    SocketService.onStateUpdated = (data) {
      if (!mounted) return;
      setState(() {
        if (data['evidence_state'] != null) {
          evidenceState = data['evidence_state'];
          physiologicalState = data['physiological_state'] ?? 'BASELINE_COMPATIBLE';
          anomalyScore = (data['anomaly_score'] ?? 0.0).toDouble();
          currentActivity = data['activity'] ?? 'Unknown';
        } else {
          final readings = data['readings'] as List?;
          if (readings != null && readings.isNotEmpty) {
            double rrms = (readings.last['rrms'] ?? 0.0).toDouble();
            anomalyScore = rrms;
            if (rrms > 2.5) {
              evidenceState = 'EVALUABLE';
              physiologicalState = 'PERSISTENT_DEVIATION';
            } else if (rrms > 1.5) {
              evidenceState = 'EVALUABLE';
              physiologicalState = 'DEVIATION_CANDIDATE';
            } else {
              evidenceState = 'EVALUABLE';
              physiologicalState = 'BASELINE_COMPATIBLE';
            }
          }
        }
      });
    };
    SocketService.init();
    _refreshLatestFromBackend();
  }

  @override
  void dispose() {
    SocketService.dispose();
    super.dispose();
  }

  Future<void> _refreshLatestFromBackend() async {
    setState(() => isSending = true);

    try {
      const userId = 'P012';
      final result = await ApiService.getRecentEvents(userId, limit: 10);
      final events = result is Map ? (result['data'] ?? const []) : result ?? const [];
      if (events is List && events.isNotEmpty) {
        final latest = events.first as Map<String, dynamic>;
        final score = latest['peak_score'] ?? latest['anomaly_score'] ?? latest['score'] ?? 0.0;
        if (!mounted) return;
        setState(() {
          evidenceState = (latest['classification'] ?? 'EVALUABLE').toString();
          physiologicalState = latest['classification'] == 'Alert'
              ? 'PERSISTENT_DEVIATION'
              : (latest['classification'] == 'Caution' ? 'DEVIATION_CANDIDATE' : 'BASELINE_COMPATIBLE');
          anomalyScore = (score is num) ? score.toDouble() : 0.0;
          currentActivity = latest['activity'] ?? currentActivity;
        });
      }
    } catch (_) {
      // No-op: keep existing state if backend is unavailable.
    } finally {
      if (mounted) setState(() => isSending = false);
    }
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
              // Active State Content View (AC-01, AC-02)
              if (evidenceState == 'QUALITY_WARNING') _buildQualityWarningState()
              else if (evidenceState == 'UNCERTAIN_CONTEXT') _buildUncertainContextState()
              else if (evidenceState == 'INSUFFICIENT_BASELINE' || evidenceState == 'PROVISIONAL_BASELINE') 
                _buildBaselineState()
              else ...[
                // EVALUABLE -> Show Physiological State
                if (physiologicalState == 'BASELINE_COMPATIBLE') _buildEvaluableState()
                else if (physiologicalState == 'DEVIATION_CANDIDATE') _buildCandidateState()
                else if (physiologicalState == 'PERSISTENT_DEVIATION') _buildPersistentState()
                else if (physiologicalState == 'RECOVERY') _buildRecoveryState()
                else if (physiologicalState == 'RECOVERED') _buildRecoveredState()
                else _buildEvaluableState() // Fallback
              ]
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: isSending ? null : _refreshLatestFromBackend,
        backgroundColor: AppColors.teal,
        icon: isSending ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Icon(Icons.sync_rounded, color: Colors.white),
        label: const Text('Sinkronkan Data MongoDB', style: TextStyle(color: Colors.white)),
      ),
    );
  }

  // Add a generic Baseline State view
  Widget _buildBaselineState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        EvidenceChip.qualityWarning(), // We should have an insufficientBaseline chip, but reusing this for prototype
        const SizedBox(height: 12),
        const Text(
          'Baseline belum matang',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.navy),
        ),
        const SizedBox(height: 6),
        const Text(
          'Sistem masih mengumpulkan data personal yang cukup dan beragam.',
          style: TextStyle(fontSize: 12, color: AppColors.gray),
        ),
      ],
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
                'Skor deviasi 0,42',
                style: TextStyle(
                  fontFamily: 'Plus Jakarta Sans',
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Konteks: duduk · confidence 0.96',
                style: TextStyle(fontSize: 11.5, color: AppColors.gray),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        const Text(
          'EVIDENCE READINESS',
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray),
        ),
        const SizedBox(height: 8),
        _buildMetricRow('Signal quality', '0.94', AppColors.green),
        _buildMetricRow('Context confidence', '0.96', AppColors.green),
        _buildMetricRow('Baseline status', 'Ready', AppColors.green),
        const SizedBox(height: 16),
        _buildPredictionBar(),
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
        const SizedBox(height: 16),

        _buildMetricRow('Quality score', '0.41', AppColors.ink),
        _buildMetricRow('Artifact fraction', '28%', AppColors.red),

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
                'Skor 1,82 > τin 1,50',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.amber),
              ),
              SizedBox(height: 4),
              Text(
                'Belum menjadi episode. Sistem menunggu persistensi pada beberapa window.',
                style: TextStyle(fontSize: 11.5, color: AppColors.ink, height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        const Text('MENGAPA?', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray)),
        const SizedBox(height: 6),
        _buildBullet('HR +1,4 SD dari baseline'),
        _buildBullet('RMSSD −1,8 SD'),
        _buildBullet('Aktivitas tetap: duduk'),
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
                'Skor 2,64',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.red),
              ),
              SizedBox(height: 4),
              Text(
                'Persistensi: 3/4 window · Puncak: 2,81',
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
                'Durasi sejak recovery: 8 menit',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.purple),
              ),
              SizedBox(height: 4),
              Text(
                'Prediksi recovered ≤ 20 menit (61% probability)',
                style: TextStyle(fontSize: 11.5, color: AppColors.ink),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => EmaDialogs.showEma3(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.teal,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Isi EMA 3 (Recovery Check)', style: TextStyle(fontWeight: FontWeight.w700)),
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
          child: Column(
            children: [
              const Text('Kembali stabil', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.navy)),
              const SizedBox(height: 12),
              _buildMetricRow('Durasi episode', '38 menit', AppColors.ink),
              _buildMetricRow('Recovery duration', '6 menit', AppColors.ink),
              _buildMetricRow('Peak score', '6,60', AppColors.ink),
              _buildMetricRow('AUC burden', '141,8', AppColors.ink),
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
  
  Widget _buildPredictionBar() {
    // Generate some mock distribution based on physiologicalState (since backend doesn't send yet)
    double prob1 = 0.82;
    double prob2 = 0.15;
    double prob3 = 0.03;
    String label1 = 'Baseline compatible';
    String label2 = 'Deviation candidate';
    String label3 = 'Persistent deviation';

    if (physiologicalState == 'PERSISTENT_DEVIATION') {
      prob1 = 0.65; prob2 = 0.25; prob3 = 0.10;
      label1 = 'Recovery'; label2 = 'Persistent deviation'; label3 = 'Unresolved';
    } else if (physiologicalState == 'RECOVERY') {
      prob1 = 0.80; prob2 = 0.18; prob3 = 0.02;
      label1 = 'Recovered'; label2 = 'Recovery'; label3 = 'Persistent deviation';
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.blueSoft,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'PREDIKSI STATE BERIKUT',
                style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: AppColors.blue),
              ),
              const Text(
                'Horizon: 3 window',
                style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: AppColors.blue),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Distribution bars
          _buildProbRow(label1, prob1),
          _buildProbRow(label2, prob2),
          _buildProbRow(label3, prob3),
        ],
      ),
    );
  }

  Widget _buildProbRow(String label, double prob) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6.0),
      child: Row(
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: const TextStyle(fontSize: 10, color: AppColors.ink)),
          ),
          Expanded(
            child: Stack(
              children: [
                Container(height: 6, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(3))),
                FractionallySizedBox(
                  widthFactor: prob,
                  child: Container(height: 6, decoration: BoxDecoration(color: AppColors.blue, borderRadius: BorderRadius.circular(3))),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 30,
            child: Text('${(prob * 100).toInt()}%', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.blue)),
          ),
        ],
      ),
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
