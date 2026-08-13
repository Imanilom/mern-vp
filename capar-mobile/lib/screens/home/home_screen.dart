import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
  // Core evidence state
  String evidenceState = 'QUALITY_WARNING';
  String physiologicalState = 'BASELINE_COMPATIBLE';
  bool isSending = false;
  String userId = '';

  // Real metric fields from API
  double anomalyScore = 0.0;
  double peakScore = 0.0;
  double qualityScore = 0.0;
  double contextConfidence = 0.0;
  String currentActivity = 'Unknown';
  int windowPersistence = 0;
  int totalWindows = 4;
  double auc = 0.0;
  int recoveryDurationMin = 0;
  int episodeDurationMin = 0;
  int predictedRecoveryMin = 0;
  int recoveryProbPct = 0;

  // Prediction probabilities
  double predProb1 = 0.0;
  double predProb2 = 0.0;
  double predProb3 = 0.0;
  String predLabel1 = 'Baseline compatible';
  String predLabel2 = 'Deviation candidate';
  String predLabel3 = 'Persistent deviation';

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
          currentActivity = data['activity'] ?? currentActivity;
          qualityScore = (data['quality_score'] ?? qualityScore).toDouble();
          contextConfidence = (data['context_confidence'] ?? contextConfidence).toDouble();
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
    _loadUserIdAndRefresh();
  }

  @override
  void dispose() {
    super.dispose();
  }

  Future<void> _loadUserIdAndRefresh() async {
    final prefs = await SharedPreferences.getInstance();
    final uid = prefs.getString('user_id') ?? '';
    if (mounted) setState(() => userId = uid);
    await _refreshLatestFromBackend(uid);
  }

  Future<void> _refreshLatestFromBackend([String? uid]) async {
    final String id = (uid != null && uid.toString().isNotEmpty) ? uid : userId;
    if (id == null || id.toString().trim() == '' || id.toString().isEmpty == true) return;
    setState(() => isSending = true);

    try {
      // Fetch latest event data
      final result = await ApiService.getRecentEvents(id, limit: 10);
      final events = result is Map ? (result['data'] ?? result['events'] ?? const []) : result ?? const [];

      if (events is List && events.isNotEmpty) {
        final latest = events.first as Map<String, dynamic>;
        final score = latest['peak_score'] ?? latest['anomaly_score'] ?? latest['score'] ?? 0.0;
        final classification = (latest['classification'] ?? 'EVALUABLE').toString();
        
        String phyState = 'BASELINE_COMPATIBLE';
        if (classification == 'Alert' || classification == 'PERSISTENT_DEVIATION') {
          phyState = 'PERSISTENT_DEVIATION';
        } else if (classification == 'Caution' || classification == 'DEVIATION_CANDIDATE') {
          phyState = 'DEVIATION_CANDIDATE';
        } else if (classification == 'RECOVERY') {
          phyState = 'RECOVERY';
        } else if (classification == 'RECOVERED') {
          phyState = 'RECOVERED';
        }

        if (!mounted) return;
        setState(() {
          evidenceState = latest['evidence_state'] ?? 'EVALUABLE';
          physiologicalState = phyState;
          anomalyScore = (score is num) ? score.toDouble() : 0.0;
          peakScore = (latest['peak_score'] is num) ? (latest['peak_score'] as num).toDouble() : anomalyScore;
          currentActivity = latest['activity'] ?? latest['activity_context'] ?? currentActivity;
          qualityScore = (latest['quality_score'] is num) ? (latest['quality_score'] as num).toDouble() : qualityScore;
          contextConfidence = (latest['context_confidence'] is num) ? (latest['context_confidence'] as num).toDouble() : contextConfidence;
          windowPersistence = (latest['persistence_count'] is num) ? (latest['persistence_count'] as num).toInt() : windowPersistence;
          totalWindows = (latest['total_windows'] is num) ? (latest['total_windows'] as num).toInt() : 4;
          auc = (latest['auc_burden'] is num) ? (latest['auc_burden'] as num).toDouble() : auc;
          episodeDurationMin = _msToMin(latest['duration_ms']);
          recoveryDurationMin = _msToMin(latest['recovery_duration_ms']);
        });
      }

      // Fetch prediction probabilities
      final metricsRes = await ApiService.getMetricsH3a(id);
      if (metricsRes != null && mounted) {
        final payload = metricsRes is Map ? (metricsRes['data'] ?? metricsRes) : <String, dynamic>{};
        final probs = payload['probabilities'] ?? payload['state_probabilities'];
        if (probs is Map) {
          setState(() {
            if (physiologicalState == 'PERSISTENT_DEVIATION') {
              predProb1 = _toDouble(probs['RECOVERY'] ?? probs['recovery'] ?? 0.65);
              predProb2 = _toDouble(probs['PERSISTENT_DEVIATION'] ?? probs['persistent_deviation'] ?? 0.25);
              predProb3 = _toDouble(probs['UNRESOLVED'] ?? probs['unresolved'] ?? 0.10);
              predLabel1 = 'Recovery'; predLabel2 = 'Persistent deviation'; predLabel3 = 'Unresolved';
            } else if (physiologicalState == 'RECOVERY') {
              predProb1 = _toDouble(probs['RECOVERED'] ?? probs['recovered'] ?? 0.80);
              predProb2 = _toDouble(probs['RECOVERY'] ?? probs['recovery'] ?? 0.18);
              predProb3 = _toDouble(probs['PERSISTENT_DEVIATION'] ?? probs['persistent_deviation'] ?? 0.02);
              predLabel1 = 'Recovered'; predLabel2 = 'Recovery'; predLabel3 = 'Persistent deviation';
            } else {
              predProb1 = _toDouble(probs['BASELINE_COMPATIBLE'] ?? probs['baseline_compatible'] ?? 0.82);
              predProb2 = _toDouble(probs['DEVIATION_CANDIDATE'] ?? probs['deviation_candidate'] ?? 0.15);
              predProb3 = _toDouble(probs['PERSISTENT_DEVIATION'] ?? probs['persistent_deviation'] ?? 0.03);
              predLabel1 = 'Baseline compatible'; predLabel2 = 'Deviation candidate'; predLabel3 = 'Persistent deviation';
            }
          });
        }
      }
    } catch (_) {
      // Keep existing state if backend is unavailable.
    } finally {
      if (mounted) setState(() => isSending = false);
    }
  }

  int _msToMin(dynamic ms) {
    if (ms == null) return 0;
    return ((ms as num) / 60000).round();
  }

  double _toDouble(dynamic v) {
    if (v is num) {
      final d = v.toDouble();
      if (d.isNaN || d.isInfinite) return 0.0;
      return d;
    }
    return 0.0;
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
              if (evidenceState == 'QUALITY_WARNING') _buildQualityWarningState()
              else if (evidenceState == 'UNCERTAIN_CONTEXT') _buildUncertainContextState()
              else if (evidenceState == 'INSUFFICIENT_BASELINE' || evidenceState == 'PROVISIONAL_BASELINE')
                _buildBaselineState()
              else ...[
                if (physiologicalState == 'BASELINE_COMPATIBLE') _buildEvaluableState()
                else if (physiologicalState == 'DEVIATION_CANDIDATE') _buildCandidateState()
                else if (physiologicalState == 'PERSISTENT_DEVIATION') _buildPersistentState()
                else if (physiologicalState == 'RECOVERY') _buildRecoveryState()
                else if (physiologicalState == 'RECOVERED') _buildRecoveredState()
                else _buildEvaluableState()
              ]
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: isSending ? null : () => _refreshLatestFromBackend(),
        backgroundColor: AppColors.teal,
        icon: isSending
            ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
            : const Icon(Icons.sync_rounded, color: Colors.white),
        label: const Text('Sinkronkan Data', style: TextStyle(color: Colors.white)),
      ),
    );
  }

  Widget _buildBaselineState() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        EvidenceChip.qualityWarning(),
        const SizedBox(height: 12),
        const Text('Baseline belum matang', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.navy)),
        const SizedBox(height: 6),
        const Text('Sistem masih mengumpulkan data personal yang cukup dan beragam.', style: TextStyle(fontSize: 12, color: AppColors.gray)),
      ],
    );
  }

  Widget _buildEvaluableState() {
    final scoreStr = anomalyScore > 0 ? anomalyScore.toStringAsFixed(2) : '—';
    final qualStr = qualityScore > 0 ? qualityScore.toStringAsFixed(2) : '—';
    final confStr = contextConfidence > 0 ? contextConfidence.toStringAsFixed(2) : '—';
    final actLabel = currentActivity.isNotEmpty ? currentActivity : '—';

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
              Text(
                'Skor deviasi $scoreStr',
                style: const TextStyle(fontFamily: 'Plus Jakarta Sans', fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.ink),
              ),
              const SizedBox(height: 4),
              Text(
                'Konteks: $actLabel · confidence $confStr',
                style: const TextStyle(fontSize: 11.5, color: AppColors.gray),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const Text('EVIDENCE READINESS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray)),
        const SizedBox(height: 8),
        _buildMetricRow('Signal quality', qualStr, qualityScore >= 0.7 ? AppColors.green : AppColors.amber),
        _buildMetricRow('Context confidence', confStr, contextConfidence >= 0.7 ? AppColors.green : AppColors.amber),
        _buildMetricRow('Baseline status', 'Ready', AppColors.green),
        const SizedBox(height: 16),
        _buildPredictionBar(),
      ],
    );
  }

  Widget _buildQualityWarningState() {
    final qualStr = qualityScore > 0 ? qualityScore.toStringAsFixed(2) : '—';

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
        const SizedBox(height: 16),
        _buildMetricRow('Quality score', qualStr, AppColors.ink),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: () => Navigator.pushNamed(context, '/pairing'),
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

  Widget _buildCandidateState() {
    final scoreStr = anomalyScore.toStringAsFixed(2);
    final actLabel = currentActivity.isNotEmpty ? currentActivity : 'tidak diketahui';

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
              const Text('DEVIASI KANDIDAT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.amber)),
              const SizedBox(height: 4),
              Text('Skor $scoreStr', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.amber)),
              const SizedBox(height: 4),
              Text(
                'Belum menjadi episode. Sistem menunggu persistensi pada beberapa window.',
                style: const TextStyle(fontSize: 11.5, color: AppColors.ink, height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const Text('MENGAPA?', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray)),
        const SizedBox(height: 6),
        _buildBullet('Anomaly score: $scoreStr'),
        _buildBullet('Aktivitas: $actLabel'),
        _buildBullet('Menunggu konfirmasi persistensi'),
      ],
    );
  }

  Widget _buildPersistentState() {
    final scoreStr = anomalyScore.toStringAsFixed(2);
    final peakStr = peakScore > 0 ? peakScore.toStringAsFixed(2) : scoreStr;
    final persistStr = windowPersistence > 0 ? '$windowPersistence/$totalWindows window' : '—';

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
              const Text('DEVIASI PERSISTEN', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.red)),
              const SizedBox(height: 4),
              Text('Skor $scoreStr', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.red)),
              const SizedBox(height: 4),
              Text('Persistensi: $persistStr · Puncak: $peakStr', style: const TextStyle(fontSize: 11.5, color: AppColors.ink)),
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

  Widget _buildRecoveryState() {
    final recStr = recoveryDurationMin > 0 ? '$recoveryDurationMin menit' : '—';
    final predStr = predictedRecoveryMin > 0 ? '≤ $predictedRecoveryMin menit' : '—';
    final probStr = recoveryProbPct > 0 ? '$recoveryProbPct%' : '—';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        EvidenceChip.recovery(),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: AppColors.purpleSoft, borderRadius: BorderRadius.circular(16)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('RECOVERY BERJALAN', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.purple)),
              const SizedBox(height: 4),
              Text('Durasi sejak recovery: $recStr', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.purple)),
              const SizedBox(height: 4),
              Text('Prediksi recovered $predStr ($probStr probability)', style: const TextStyle(fontSize: 11.5, color: AppColors.ink)),
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

  Widget _buildRecoveredState() {
    final epDurStr = episodeDurationMin > 0 ? '$episodeDurationMin menit' : '—';
    final recDurStr = recoveryDurationMin > 0 ? '$recoveryDurationMin menit' : '—';
    final peakStr = peakScore > 0 ? peakScore.toStringAsFixed(2) : '—';
    final aucStr = auc > 0 ? auc.toStringAsFixed(1) : '—';

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
              _buildMetricRow('Durasi episode', epDurStr, AppColors.ink),
              _buildMetricRow('Recovery duration', recDurStr, AppColors.ink),
              _buildMetricRow('Peak score', peakStr, AppColors.ink),
              _buildMetricRow('AUC burden', aucStr, AppColors.ink),
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

  Widget _buildPredictionBar() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.blueSoft, borderRadius: BorderRadius.circular(14)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('PREDIKSI STATE BERIKUT', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: AppColors.blue)),
              Text('Horizon: 3 window', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: AppColors.blue)),
            ],
          ),
          const SizedBox(height: 12),
          _buildProbRow(predLabel1, predProb1),
          _buildProbRow(predLabel2, predProb2),
          _buildProbRow(predLabel3, predProb3),
        ],
      ),
    );
  }

  Widget _buildProbRow(String label, double prob) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6.0),
      child: Row(
        children: [
          SizedBox(width: 120, child: Text(label, style: const TextStyle(fontSize: 10, color: AppColors.ink))),
          Expanded(
            child: Stack(
              children: [
                Container(height: 6, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(3))),
                FractionallySizedBox(
                  widthFactor: prob.clamp(0.0, 1.0),
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
