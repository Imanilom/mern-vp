import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';

import '../../theme/app_colors.dart';
import '../../widgets/evidence_chip.dart';
import '../../services/api_service.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  Map<String, dynamic>? selectedEpisode;
  List<Map<String, dynamic>> episodes = [];
  bool isLoading = true;
  String userId = '';

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    setState(() => isLoading = true);
    final prefs = await SharedPreferences.getInstance();
    final uid = prefs.getString('user_id') ?? '';
    if (mounted) setState(() => userId = uid);

    if (uid.isEmpty) {
      if (mounted) setState(() => isLoading = false);
      return;
    }

    try {
      final result = await ApiService.getRecentEvents(uid, limit: 50);
      final raw = result is Map
          ? (result['data'] ?? result['events'] ?? const [])
          : result ?? const [];

      if (raw is List && mounted) {
        setState(() {
          episodes = raw.map((e) => _mapEvent(e as Map<String, dynamic>)).toList();
          isLoading = false;
        });
      } else {
        if (mounted) setState(() => isLoading = false);
      }
    } catch (_) {
      if (mounted) setState(() => isLoading = false);
    }
  }

  Map<String, dynamic> _mapEvent(Map<String, dynamic> e) {
    final createdAt = e['created_at'] ?? e['onset_time'] ?? e['timestamp'];
    String dateLabel = '—';
    String onsetStr = '—';
    String recoveryStr = '—';
    if (createdAt != null) {
      try {
        final dt = DateTime.parse(createdAt.toString()).toLocal();
        final now = DateTime.now();
        final diff = now.difference(dt);
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        if (diff.inDays == 0) {
          dateLabel = 'Hari ini ${DateFormat('HH:mm').format(dt)} WIB';
        } else if (diff.inDays == 1) {
          dateLabel = 'Kemarin ${DateFormat('HH:mm').format(dt)} WIB';
        } else {
          dateLabel = '${days[dt.weekday % 7]} ${DateFormat('HH:mm').format(dt)} WIB';
        }
        onsetStr = DateFormat('HH:mm').format(dt);
      } catch (_) {}
    }
    final recoveryAt = e['recovery_time'] ?? e['recovered_at'];
    if (recoveryAt != null) {
      try {
        final dt = DateTime.parse(recoveryAt.toString()).toLocal();
        recoveryStr = DateFormat('HH:mm').format(dt);
      } catch (_) {}
    }

    final durationMs = e['duration_ms'];
    final durationStr = durationMs != null
        ? '${((durationMs as num) / 60000).round()} m'
        : '—';

    final recoveryMs = e['recovery_duration_ms'];
    final recoveryDurStr = recoveryMs != null
        ? '${((recoveryMs as num) / 60000).round()} m'
        : '—';

    final classification = e['classification'] ?? e['status'] ?? 'Unknown';
    final isRecovered = classification == 'RECOVERED' || classification == 'Recovered';

    final peakScore = e['peak_score'] ?? e['anomaly_score'] ?? e['score'] ?? 0.0;
    final auc = e['auc_burden'] ?? e['auc'] ?? 0.0;

    final id = e['_id'] ?? e['event_id'] ?? '—';
    final shortId = id.toString().length > 8 ? 'EP-${id.toString().substring(0, 8).toUpperCase()}' : 'EP-$id';

    final activity = e['activity'] ?? e['activity_context'] ?? '—';

    final List<String> evidence = [];
    if (e['hr_deviation'] != null) evidence.add('HR ${_fmtDev(e['hr_deviation'])} SD');
    if (e['rmssd_deviation'] != null) evidence.add('RMSSD ${_fmtDev(e['rmssd_deviation'])} SD');
    if (e['dfa_deviation'] != null) evidence.add('DFA α1 ${_fmtDev(e['dfa_deviation'])} SD');
    if (e['quality_score'] != null) evidence.add('Quality ${(e['quality_score'] as num).toStringAsFixed(2)}');
    if (evidence.isEmpty) evidence.add('Score: ${(peakScore as num).toStringAsFixed(2)}');

    return {
      'id': shortId,
      'date': dateLabel,
      'context': activity,
      'status': isRecovered ? 'Recovered' : classification,
      'duration': durationStr,
      'recoveryTime': recoveryDurStr,
      'onset': onsetStr,
      'recovery': recoveryStr,
      'peakScore': (peakScore as num).toDouble(),
      'auc': (auc as num).toDouble(),
      'evidence': evidence,
      'raw': e,
    };
  }

  String _fmtDev(dynamic v) {
    if (v == null) return '0';
    final n = (v as num).toDouble();
    return n >= 0 ? '+${n.toStringAsFixed(1)}' : n.toStringAsFixed(1);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: selectedEpisode != null
            ? _buildEpisodeDetailScreen(selectedEpisode!)
            : _buildHistoryListScreen(),
      ),
    );
  }

  Widget _buildHistoryListScreen() {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Riwayat Episode',
                      style: TextStyle(fontFamily: 'Plus Jakarta Sans', fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.navy),
                    ),
                    SizedBox(height: 2),
                    Text('Catatan longitudinal episode deviasi & recovery', style: TextStyle(fontSize: 12, color: AppColors.gray)),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.refresh_rounded, color: AppColors.teal),
                onPressed: _loadHistory,
                tooltip: 'Refresh',
              ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: isLoading
                ? const Center(child: CircularProgressIndicator())
                : episodes.isEmpty
                    ? _buildEmptyState()
                    : ListView.builder(
                        itemCount: episodes.length,
                        itemBuilder: (ctx, idx) {
                          final ep = episodes[idx];
                          final isRecovered = ep['status'] == 'Recovered';
                          return Card(
                            elevation: 0,
                            margin: const EdgeInsets.only(bottom: 10),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                              side: const BorderSide(color: AppColors.line),
                            ),
                            child: ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                              onTap: () => setState(() => selectedEpisode = ep),
                              title: Text(ep['date'], style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.navy)),
                              subtitle: Text(ep['context'], style: const TextStyle(fontSize: 11, color: AppColors.gray)),
                              trailing: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  isRecovered ? EvidenceChip.recovered() : EvidenceChip.qualityWarning(),
                                  const SizedBox(height: 4),
                                  Text(ep['duration'], style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.ink)),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.history_rounded, size: 48, color: AppColors.line),
          const SizedBox(height: 12),
          const Text('Belum ada episode tercatat', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.gray)),
          const SizedBox(height: 6),
          const Text('Episode akan muncul setelah sistem mendeteksi deviasi fisiologis', style: TextStyle(fontSize: 12, color: AppColors.gray), textAlign: TextAlign.center),
          const SizedBox(height: 16),
          TextButton.icon(
            onPressed: _loadHistory,
            icon: const Icon(Icons.refresh_rounded, size: 16),
            label: const Text('Muat Ulang'),
          ),
        ],
      ),
    );
  }

  Widget _buildEpisodeDetailScreen(Map<String, dynamic> ep) {
    final evidenceList = ep['evidence'] as List<String>;
    final peakScore = (ep['peakScore'] as double).toStringAsFixed(2);
    final auc = (ep['auc'] as double).toStringAsFixed(1);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back, color: AppColors.navy),
                onPressed: () => setState(() => selectedEpisode = null),
              ),
              Text(ep['id'], style: const TextStyle(fontFamily: 'Plus Jakarta Sans', fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.navy)),
              const Spacer(),
              ep['status'] == 'Recovered' ? EvidenceChip.recovered() : EvidenceChip.qualityWarning(),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(left: 48),
            child: Text('${ep['date']} · ${ep['context']}', style: const TextStyle(fontSize: 12, color: AppColors.gray)),
          ),
          const SizedBox(height: 20),

          // Score Trajectory Graphic
          Container(
            height: 100,
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.line),
            ),
            child: CustomPaint(painter: _TrajectoryPainter()),
          ),
          const SizedBox(height: 16),

          // Metrics Grid
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 2.2,
            children: [
              _buildMetricCard('Onset', ep['onset']),
              _buildMetricCard('Recovery', ep['recovery']),
              _buildMetricCard('Peak Score', peakScore),
              _buildMetricCard('AUC Burden', auc),
            ],
          ),
          const SizedBox(height: 16),

          const Text('EVIDENCE & PENJELASAN', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: evidenceList.map((ev) => Chip(
              label: Text(ev, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.navy)),
              backgroundColor: AppColors.graySoft,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            )).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.navy)),
        ],
      ),
    );
  }
}

class _TrajectoryPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.red
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final path = Path();
    path.moveTo(0, size.height * 0.7);
    path.lineTo(size.width * 0.2, size.height * 0.6);
    path.lineTo(size.width * 0.4, size.height * 0.2);
    path.lineTo(size.width * 0.6, size.height * 0.1);
    path.lineTo(size.width * 0.8, size.height * 0.5);
    path.lineTo(size.width, size.height * 0.8);

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
