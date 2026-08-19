import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/evidence_chip.dart';

class BaselineReadinessScreen extends StatefulWidget {
  const BaselineReadinessScreen({super.key});

  @override
  State<BaselineReadinessScreen> createState() => _BaselineReadinessScreenState();
}

class _BaselineReadinessScreenState extends State<BaselineReadinessScreen> {
  bool _isLoading = true;
  Map<String, dynamic>? _baselineData;
  Map<String, dynamic>? _mobileStatus;

  @override
  void initState() {
    super.initState();
    _loadBaseline();
  }

  Future<void> _loadBaseline() async {
    setState(() => _isLoading = true);
    final bData = await ApiService.fetchBaselineReadiness();
    final mStatus = await ApiService.fetchMobileStatus();

    if (mounted) {
      setState(() {
        _baselineData = bData;
        _mobileStatus = mStatus;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // Parse baseline metrics or fallback to current provisional values
    final segmentCount = _baselineData?['segment_count'] ?? _mobileStatus?['total_records'] ?? 19;
    final provRequired = 15;
    final matRequired = 30;
    final progressProv = (segmentCount / provRequired).clamp(0.0, 1.0);
    final progressMat = (segmentCount / matRequired).clamp(0.0, 1.0);
    final nEff = _baselineData?['maturity_detail']?['n_effective'] ?? (segmentCount * 0.82);
    final isFrozen = _baselineData?['is_frozen'] ?? false;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.navy),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Baseline & Kesiapan Personal',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.teal,
          onRefresh: _loadBaseline,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Baseline Progress',
                          style: TextStyle(
                            fontFamily: 'Plus Jakarta Sans',
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: AppColors.navy,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          isFrozen ? 'Baseline Personal Terkunci (Mature)' : 'Kematangan data provisional',
                          style: const TextStyle(fontSize: 12, color: AppColors.gray),
                        ),
                      ],
                    ),
                    isFrozen ? EvidenceChip.baselineCompatible() : EvidenceChip.provisional(),
                  ],
                ),
                const SizedBox(height: 16),

                // Percentage Remaining Banner (Pengecekan % Sisa Baseline Compatible)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: segmentCount >= provRequired ? AppColors.tealSoft : AppColors.amberSoft,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: segmentCount >= provRequired ? AppColors.teal : AppColors.amber),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: segmentCount >= provRequired ? AppColors.teal : AppColors.amber,
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          '${((segmentCount / provRequired) * 100).clamp(0, 100).toInt()}%',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              segmentCount >= provRequired
                                  ? '100% TERPENUHI — BASELINE COMPATIBLE'
                                  : 'SISA ${(100 - ((segmentCount / provRequired) * 100).clamp(0, 100)).toInt()}% LAGI MENUJU BASELINE COMPATIBLE',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: segmentCount >= provRequired ? AppColors.teal : AppColors.amber,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              segmentCount >= provRequired
                                  ? 'Baseline provisional aktif penuh ($segmentCount / $provRequired window terverifikasi).'
                                  : 'Butuh ${(provRequired - segmentCount).clamp(0, provRequired)} window ($segmentCount / $provRequired window) lagi untuk penguncian baseline provisional.',
                              style: const TextStyle(fontSize: 11, color: AppColors.ink, height: 1.3),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Readiness Metrics Card
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.line),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.03),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'EVALUASI GERBANG KESIAPAN (READINESS GATES)',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: AppColors.gray,
                              letterSpacing: 0.5,
                            ),
                          ),
                          if (_isLoading)
                            const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.teal)),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _buildProgressRow('Baseline Provisional (n)', '$segmentCount / $provRequired (30 min)', progressProv, AppColors.teal, segmentCount >= 15 ? 'PASS (READY)' : 'LEARNING'),
                      const SizedBox(height: 14),
                      _buildProgressRow('Baseline Mature (n)', '$segmentCount / $matRequired (60 min)', progressMat, AppColors.purple, segmentCount >= 30 ? 'MATURE' : 'AUTO ACCUMULATING'),
                      const SizedBox(height: 14),
                      _buildProgressRow('n efektif (n_eff)', nEff is double ? nEff.toStringAsFixed(1) : '$nEff', (nEff / 30).clamp(0.0, 1.0), AppColors.teal, nEff >= 12 ? 'READY' : 'LEARNING'),
                      const SizedBox(height: 14),
                      _buildProgressRow('Variasi hari', '3 / 3 hari', 1.0, AppColors.green, 'PASS'),
                      const SizedBox(height: 14),
                      _buildProgressRow('Dominasi hari', '72%', 0.72, AppColors.amber, 'PROVISIONAL'),
                      const SizedBox(height: 14),
                      _buildProgressRow('Kualitas sinyal', '0.94', 0.94, AppColors.green, 'PASS'),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Historical Activity Baseline Card
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'DATA HISTORIS BASELINE AKTIVITAS',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: AppColors.gray,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 14),
                      _buildActivityBaselineTile('Duduk', 'HR Mean: 74 bpm · RR: 812 ms', '30 min rec', AppColors.teal),
                      const Divider(height: 20),
                      _buildActivityBaselineTile('Berdiri', 'HR Mean: 84 bpm · RR: 720 ms', '15 min rec', AppColors.blue),
                      const Divider(height: 20),
                      _buildActivityBaselineTile('Berjalan / Bergerak', 'HR Mean: 98 bpm · RR: 610 ms', '20 min rec', AppColors.purple),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildProgressRow(String label, String value, double progress, Color barColor, String statusTag) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.navy,
              ),
            ),
            Row(
              children: [
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: barColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    statusTag,
                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: barColor),
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 6,
            backgroundColor: AppColors.graySoft,
            valueColor: AlwaysStoppedAnimation<Color>(barColor),
          ),
        ),
      ],
    );
  }

  Widget _buildActivityBaselineTile(String activity, String metrics, String duration, Color color) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(Icons.favorite_rounded, size: 18, color: color),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(activity, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy)),
              Text(metrics, style: const TextStyle(fontSize: 11, color: AppColors.gray)),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.graySoft,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(duration, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.ink)),
        ),
      ],
    );
  }
}
