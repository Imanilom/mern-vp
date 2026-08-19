import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/evidence_chip.dart';

class TrajectoryPoint {
  final String time;
  final double score;
  final String? label;

  const TrajectoryPoint({
    required this.time,
    required this.score,
    this.label,
  });
}

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  Map<String, dynamic>? selectedEpisode;
  List<Map<String, dynamic>> episodes = [];
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadEpisodes();
  }

  Future<void> _loadEpisodes() async {
    setState(() => isLoading = true);
    final fetched = await ApiService.fetchEpisodes();
    if (mounted) {
      if (fetched.isNotEmpty) {
        setState(() {
          episodes = fetched.map((e) {
            final rawScore = e['peak_score'] ?? e['max_anomaly_score'] ?? e['anomaly_score'] ?? 2.85;
            final double peakVal = typeofScoreToDouble(rawScore);
            return {
              'id': e['event_id'] ?? (e['_id'] != null ? 'EP-${e['_id'].toString().substring(e['_id'].toString().length - 4)}' : 'EP-104'),
              'date': e['date_created'] ?? '15-08-2026 14:22',
              'onset': e['onset_time_str'] ?? '14:22',
              'duration': '${e['duration_minutes'] ?? 15} m',
              'durationMinutes': e['duration_minutes'] ?? 15,
              'peakScore': peakVal,
              'context': e['activity_label'] ?? e['context'] ?? 'Duduk',
              'status': e['status'] ?? 'Recovered',
              'emaStatus': e['ema_completed'] == true ? 'EMA 4/4 Complete' : 'EMA 2/4 Required',
              'raw': e,
            };
          }).toList();
          isLoading = false;
        });
      } else {
        setState(() {
          episodes = [
            {
              'id': 'EP-104',
              'date': '15-08-2026 14:22',
              'onset': '14:22',
              'duration': '15 m',
              'durationMinutes': 15,
              'peakScore': 2.85,
              'context': 'Duduk',
              'status': 'Recovered',
              'emaStatus': 'EMA 4/4 Complete',
              'onsetScore': 1.86,
              'tauIn': 1.86,
              'tauOut': 1.18,
            },
            {
              'id': 'EP-103',
              'date': '15-08-2026 10:15',
              'onset': '10:15',
              'duration': '22 m',
              'durationMinutes': 22,
              'peakScore': 3.42,
              'context': 'Berdiri',
              'status': 'Recovered',
              'emaStatus': 'EMA 3/4 Complete',
              'onsetScore': 2.10,
              'tauIn': 1.90,
              'tauOut': 1.25,
            },
            {
              'id': 'EP-102',
              'date': '14-08-2026 16:40',
              'onset': '16:40',
              'duration': '18 m',
              'durationMinutes': 18,
              'peakScore': 2.15,
              'context': 'Duduk',
              'status': 'Quality Warning',
              'emaStatus': 'EMA 2/4 Required',
              'onsetScore': 1.70,
              'tauIn': 1.80,
              'tauOut': 1.15,
            },
          ];
          isLoading = false;
        });
      }
    }
  }

  double typeofScoreToDouble(dynamic val) {
    if (val is num) return val.toDouble();
    if (val is String) return double.tryParse(val) ?? 2.50;
    return 2.50;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: selectedEpisode != null ? _buildEpisodeDetailScreen(selectedEpisode!) : _buildHistoryListScreen(),
      ),
    );
  }

  // A14 History List (A04 in Addendum)
  Widget _buildHistoryListScreen() {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Riwayat Episode',
                    style: TextStyle(
                      fontFamily: 'Plus Jakarta Sans',
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.navy,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Catatan longitudinal episode deviasi & recovery',
                    style: TextStyle(fontSize: 12, color: AppColors.gray),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Filter Chips (A04 Addendum)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterChip('All states', true),
                const SizedBox(width: 6),
                _buildFilterChip('This week', false),
                const SizedBox(width: 6),
                _buildFilterChip('All contexts', false),
              ],
            ),
          ),
          const SizedBox(height: 14),

          Expanded(
            child: episodes.isEmpty
                ? const Center(
                    child: Text(
                      'Belum ada riwayat episode.',
                      style: TextStyle(fontSize: 14, color: AppColors.gray),
                    ),
                  )
                : ListView.builder(
                    itemCount: episodes.length,
                    itemBuilder: (ctx, idx) {
                      final ep = episodes[idx];
                      final isRecovered = ep['status'] == 'Recovered';
                      final String emaTag = idx == 0 ? 'EMA 3/4' : (idx == 2 ? 'EMA 2/4' : 'EMA 4/4');

                      return Card(
                        elevation: 0,
                        margin: const EdgeInsets.only(bottom: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                          side: const BorderSide(color: AppColors.line),
                        ),
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          onTap: () => setState(() => selectedEpisode = ep),
                          title: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '${ep['id']} · ${ep['date']}',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.navy),
                              ),
                              isRecovered ? EvidenceChip.recovered() : EvidenceChip.qualityWarning(),
                            ],
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SizedBox(height: 4),
                              Text(
                                'Peak ${ep['peakScore']} · ${ep['duration']} · Konteks: ${ep['context']}',
                                style: const TextStyle(fontSize: 11, color: AppColors.gray),
                              ),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppColors.tealSoft,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      emaTag,
                                      style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: AppColors.teal),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  const Text(
                                    'Open detail →',
                                    style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.gray),
                                  ),
                                ],
                              ),
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

  Widget _buildFilterChip(String label, bool isSelected) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: isSelected ? AppColors.teal : AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: isSelected ? AppColors.teal : AppColors.line),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
          color: isSelected ? Colors.white : AppColors.navy,
        ),
      ),
    );
  }

  // A15 Episode Detail
  Widget _buildEpisodeDetailScreen(Map<String, dynamic> ep) {
    final raw = ep['raw'] as Map<String, dynamic>? ?? {};

    // Helper formatting timestamps
    String formatTs(dynamic ts) {
      if (ts == null) return '-';
      int ms = 0;
      if (ts is Map && ts.containsKey('\$numberLong')) {
        ms = int.tryParse(ts['\$numberLong'].toString()) ?? 0;
      } else if (ts is num) {
        ms = ts.toInt();
      }
      if (ms == 0) return '-';
      final dt = DateTime.fromMillisecondsSinceEpoch(ms);
      final hh = dt.hour.toString().padLeft(2, '0');
      final mm = dt.minute.toString().padLeft(2, '0');
      final ss = dt.second.toString().padLeft(2, '0');
      final dd = dt.day.toString().padLeft(2, '0');
      final mo = dt.month.toString().padLeft(2, '0');
      return '$dd-$mo-${dt.year} $hh:$mm:$ss';
    }

    final String onsetStr = raw['onset_time'] != null ? formatTs(raw['onset_time']) : (ep['date'] ?? '13-08-2026 10:01:40');
    final String peakStr = raw['peak_time'] != null ? formatTs(raw['peak_time']) : onsetStr;
    final String resolvedStr = raw['resolved_time'] != null ? formatTs(raw['resolved_time']) : '-';

    final double onsetScore = ((raw['onset_score'] ?? ep['onsetScore'] ?? 2.10) as num).toDouble();
    final double peakScore = ((raw['peak_score'] ?? ep['peakScore'] ?? 2.10) as num).toDouble();
    final double durationMin = raw['duration_ms'] != null ? (raw['duration_ms'] / 60000.0) : ((ep['durationMinutes'] ?? 15).toDouble());
    final String classification = raw['classification'] ?? ep['status'] ?? 'Caution';

    // Z-scores at peak
    final Map<String, dynamic> zPeak = raw['z_scores_at_peak'] as Map<String, dynamic>? ?? {};
    final double zHr = ((zPeak['z_hr'] ?? -0.35) as num).toDouble();
    final double zRr = ((zPeak['z_rr'] ?? 1.42) as num).toDouble();
    final double zSdnn = ((zPeak['z_sdnn'] ?? -1.54) as num).toDouble();
    final double zRmssd = ((zPeak['z_rmssd'] ?? -10.83) as num).toDouble();
    final double zMotion = ((zPeak['z_motion'] ?? 0) as num).toDouble();
    final double zDfa = ((zPeak['z_dfa'] ?? 0.65) as num).toDouble();

    // Trajectory details
    final Map<String, dynamic> traj = raw['trajectory'] as Map<String, dynamic>? ?? {};
    final double deltaHr = ((traj['delta_hr'] ?? -0.27) as num).toDouble();
    final double slopeHr = ((traj['slope_hr'] ?? -0.0019) as num).toDouble();
    final int persistence = traj['persistence'] ?? 2;
    final double dfa1 = ((traj['dfa_alpha1'] ?? 0.504) as num).toDouble();
    final double dfa2 = ((traj['dfa_alpha2'] ?? 0.725) as num).toDouble();
    final double recMs = ((traj['recovery_time_ms'] ?? 2700000) as num).toDouble();

    // Points sequence for trajectory line chart
    List<TrajectoryPoint> points = (ep['points'] as List<TrajectoryPoint>? ?? []);
    final List<dynamic> seqScores = traj['sequence_of_scores'] as List<dynamic>? ?? [onsetScore, peakScore, 1.75, 1.30, 0.85];
    if (seqScores.isNotEmpty) {
      points = [];
      for (int i = 0; i < seqScores.length; i++) {
        final double score = (seqScores[i] as num).toDouble();
        final String label = i == 0 ? 'Onset' : (i == 1 ? 'Peak' : 'Recovery');
        final String time = 'W${i+1}';
        points.add(TrajectoryPoint(time: time, score: score, label: label));
      }
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Navigation Header
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back, color: AppColors.navy),
                onPressed: () => setState(() => selectedEpisode = null),
              ),
              Text(
                ep['id'] ?? 'EP-104',
                style: const TextStyle(
                  fontFamily: 'Plus Jakarta Sans',
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.navy,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: classification == 'Alert' ? AppColors.redSoft : AppColors.amberSoft,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  classification,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: classification == 'Alert' ? AppColors.red : AppColors.amber,
                  ),
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(left: 48),
            child: Text(
              'Device: ${raw['device_id'] ?? 'TEST_DEVICE_123'} · Activity: ${raw['activity'] ?? ep['context'] ?? 'Berkendara'}',
              style: const TextStyle(fontSize: 12, color: AppColors.gray),
            ),
          ),
          const SizedBox(height: 16),

          // Time Details Card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('RINCIAN WAKTU & DURASI EPISODE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.teal)),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Onset Time (Mulai)', style: TextStyle(fontSize: 11, color: AppColors.gray)),
                    Text(onsetStr, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.navy)),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Peak Time (Puncak)', style: TextStyle(fontSize: 11, color: AppColors.gray)),
                    Text(peakStr, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.red)),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Resolved Time (Pulih)', style: TextStyle(fontSize: 11, color: AppColors.gray)),
                    Text(resolvedStr, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.green)),
                  ],
                ),
                const Divider(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total Durasi Episode', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.navy)),
                    Text('${durationMin.toStringAsFixed(1)} Menit (${(durationMin * 60000).toInt()} ms)', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.teal)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Score Trajectory Graphic Card with Interactive Touch
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.line),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.02),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          'Grafik Trajektori Skor Anomali',
                          style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: AppColors.navy),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Urutan Skor Deviasi (Sequence of Scores)',
                          style: TextStyle(fontSize: 10.5, color: AppColors.gray),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: AppColors.redSoft, borderRadius: BorderRadius.circular(6)),
                      child: Text('Peak: ${peakScore.toStringAsFixed(2)}', style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: AppColors.red)),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                _InteractiveTrajectoryChart(
                  points: points,
                  peakScore: peakScore,
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Breakdown Z-Scores Card at Peak
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('BREAKDOWN Z-SCORES AT PEAK', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.purple)),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildZChip('Z-HR', zHr),
                    _buildZChip('Z-RR', zRr),
                    _buildZChip('Z-SDNN', zSdnn),
                    _buildZChip('Z-RMSSD', zRmssd),
                    _buildZChip('Z-DFA', zDfa),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Trajectory Feature Details Grid
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 2.2,
            children: [
              _buildMetricCard('Delta HR', '${deltaHr >= 0 ? "+$deltaHr" : deltaHr} BPM'),
              _buildMetricCard('Slope HR', '${slopeHr.toStringAsFixed(4)} / min'),
              _buildMetricCard('Persistensi', '$persistence Window'),
              _buildMetricCard('DFA α1 / α2', '${dfa1.toStringAsFixed(2)} / ${dfa2.toStringAsFixed(2)}'),
              _buildMetricCard('Onset Score', onsetScore.toStringAsFixed(2)),
              _buildMetricCard('Recovery Time', '${(recMs / 60000).toStringAsFixed(1)} m'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildZChip(String label, double val) {
    final bool isExtreme = val.abs() >= 2.0;
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: AppColors.gray)),
        const SizedBox(height: 3),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
          decoration: BoxDecoration(
            color: isExtreme ? AppColors.redSoft : AppColors.graySoft,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            val >= 0 ? '+${val.toStringAsFixed(2)}' : val.toStringAsFixed(2),
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
              color: isExtreme ? AppColors.red : AppColors.navy,
            ),
          ),
        ),
      ],
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

class _InteractiveTrajectoryChart extends StatefulWidget {
  final List<TrajectoryPoint> points;
  final double peakScore;

  const _InteractiveTrajectoryChart({
    required this.points,
    required this.peakScore,
  });

  @override
  State<_InteractiveTrajectoryChart> createState() => _InteractiveTrajectoryChartState();
}

class _InteractiveTrajectoryChartState extends State<_InteractiveTrajectoryChart> {
  int? selectedIndex;

  @override
  void initState() {
    super.initState();
    final peakIdx = widget.points.indexWhere((p) => p.label == 'Peak');
    selectedIndex = peakIdx != -1 ? peakIdx : (widget.points.isNotEmpty ? 0 : null);
  }

  @override
  Widget build(BuildContext context) {
    final selectedPoint = (selectedIndex != null && selectedIndex! < widget.points.length)
        ? widget.points[selectedIndex!]
        : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 190,
          width: double.infinity,
          child: GestureDetector(
            onTapDown: (details) {
              final RenderBox box = context.findRenderObject() as RenderBox;
              final localOffset = details.localPosition;
              final double width = box.size.width;

              const double leftMargin = 34.0;
              const double rightMargin = 36.0;
              final double chartWidth = width - leftMargin - rightMargin;

              if (chartWidth > 0 && widget.points.length > 1) {
                final double relativeX = (localOffset.dx - leftMargin) / chartWidth;
                final int index = (relativeX * (widget.points.length - 1)).round().clamp(0, widget.points.length - 1);
                setState(() => selectedIndex = index);
              }
            },
            child: CustomPaint(
              painter: _TrajectoryPainter(
                points: widget.points,
                peakScore: widget.peakScore,
                selectedIndex: selectedIndex,
              ),
            ),
          ),
        ),
        if (selectedPoint != null) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.tealSoft,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.teal.withValues(alpha: 0.3)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.touch_app_rounded, size: 14, color: AppColors.teal),
                    const SizedBox(width: 6),
                    Text(
                      'Waktu: ${selectedPoint.time} WIB',
                      style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.navy),
                    ),
                  ],
                ),
                Text(
                  'Skor: ${selectedPoint.score.toStringAsFixed(2)} SD ${selectedPoint.label != null ? '(${selectedPoint.label})' : ''}',
                  style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: AppColors.teal),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _TrajectoryPainter extends CustomPainter {
  final List<TrajectoryPoint> points;
  final double peakScore;
  final int? selectedIndex;

  _TrajectoryPainter({
    required this.points,
    required this.peakScore,
    this.selectedIndex,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;

    final maxY = peakScore > 6.0 ? 8.0 : (peakScore > 3.5 ? 6.0 : 4.0);
    const minY = 0.0;
    const thresholdY = 1.5;

    const double leftMargin = 34.0;
    const double rightMargin = 36.0;
    const double topMargin = 22.0;
    const double bottomMargin = 36.0;

    final double chartWidth = size.width - leftMargin - rightMargin;
    final double chartHeight = size.height - topMargin - bottomMargin;

    double getX(int index) {
      if (points.length <= 1) return leftMargin;
      return leftMargin + (index / (points.length - 1)) * chartWidth;
    }

    double getY(double score) {
      final normalized = (score - minY) / (maxY - minY);
      return topMargin + chartHeight * (1.0 - normalized.clamp(0.0, 1.0));
    }

    // 1. Y-Axis Grid Lines & Tick Labels
    const yTickSteps = 4;
    final yStepValue = (maxY - minY) / yTickSteps;

    final gridPaint = Paint()
      ..color = AppColors.line
      ..strokeWidth = 1.0
      ..style = PaintingStyle.stroke;

    for (int i = 0; i <= yTickSteps; i++) {
      final val = minY + i * yStepValue;
      final yPos = getY(val);

      canvas.drawLine(
        Offset(leftMargin, yPos),
        Offset(leftMargin + chartWidth, yPos),
        gridPaint,
      );

      final textSpan = TextSpan(
        text: val.toStringAsFixed(1),
        style: const TextStyle(
          fontSize: 9.5,
          fontWeight: FontWeight.w600,
          color: AppColors.gray,
          fontFamily: 'Plus Jakarta Sans',
        ),
      );
      final tp = TextPainter(
        text: textSpan,
        textDirection: TextDirection.ltr,
      );
      tp.layout();
      tp.paint(canvas, Offset(leftMargin - tp.width - 6, yPos - tp.height / 2));
    }

    // 1b. Vertical Window Gridlines for Each Window Sequence Point
    final windowGridPaint = Paint()
      ..color = AppColors.line.withValues(alpha: 0.5)
      ..strokeWidth = 1.0
      ..style = PaintingStyle.stroke;

    for (int i = 0; i < points.length; i++) {
      final xPos = getX(i);
      canvas.drawLine(
        Offset(xPos, topMargin),
        Offset(xPos, topMargin + chartHeight),
        windowGridPaint,
      );
    }

    // 2. Threshold Line (τin = 1.5)
    final thresholdYPos = getY(thresholdY);
    final thresholdPaint = Paint()
      ..color = AppColors.amber.withValues(alpha: 0.8)
      ..strokeWidth = 1.2
      ..style = PaintingStyle.stroke;

    double dashWidth = 5, dashSpace = 3, startX = leftMargin;
    while (startX < leftMargin + chartWidth) {
      canvas.drawLine(
        Offset(startX, thresholdYPos),
        Offset((startX + dashWidth).clamp(leftMargin, leftMargin + chartWidth), thresholdYPos),
        thresholdPaint,
      );
      startX += dashWidth + dashSpace;
    }

    final threshTextSpan = const TextSpan(
      text: 'τin 1.5',
      style: TextStyle(
        fontSize: 9,
        fontWeight: FontWeight.w700,
        color: AppColors.amber,
        fontFamily: 'Plus Jakarta Sans',
      ),
    );
    final threshTp = TextPainter(
      text: threshTextSpan,
      textDirection: TextDirection.ltr,
    );
    threshTp.layout();
    threshTp.paint(canvas, Offset(leftMargin + chartWidth + 4, thresholdYPos - threshTp.height / 2));

    // 3. Vertical Guideline for Selected Point
    if (selectedIndex != null && selectedIndex! < points.length) {
      final selX = getX(selectedIndex!);
      final guidePaint = Paint()
        ..color = AppColors.teal.withValues(alpha: 0.5)
        ..strokeWidth = 1.0
        ..style = PaintingStyle.stroke;

      double dW = 4, dS = 3, startY = topMargin;
      while (startY < topMargin + chartHeight) {
        canvas.drawLine(
          Offset(selX, startY),
          Offset(selX, (startY + dW).clamp(topMargin, topMargin + chartHeight)),
          guidePaint,
        );
        startY += dW + dS;
      }
    }

    // 4. Trajectory Curve & Gradient Fill
    final path = Path();
    final areaPath = Path();

    final firstX = getX(0);
    final firstY = getY(points[0].score);

    path.moveTo(firstX, firstY);
    areaPath.moveTo(firstX, getY(0));
    areaPath.lineTo(firstX, firstY);

    for (int i = 0; i < points.length - 1; i++) {
      final x1 = getX(i);
      final y1 = getY(points[i].score);
      final x2 = getX(i + 1);
      final y2 = getY(points[i + 1].score);

      final controlX1 = x1 + (x2 - x1) / 2;
      final controlY1 = y1;
      final controlX2 = x1 + (x2 - x1) / 2;
      final controlY2 = y2;

      path.cubicTo(controlX1, controlY1, controlX2, controlY2, x2, y2);
      areaPath.cubicTo(controlX1, controlY1, controlX2, controlY2, x2, y2);
    }

    areaPath.lineTo(getX(points.length - 1), getY(0));
    areaPath.close();

    final areaGradient = LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [
        AppColors.red.withValues(alpha: 0.22),
        AppColors.red.withValues(alpha: 0.01),
      ],
    );

    final areaPaint = Paint()
      ..shader = areaGradient.createShader(Rect.fromLTWH(leftMargin, topMargin, chartWidth, chartHeight))
      ..style = PaintingStyle.fill;

    canvas.drawPath(areaPath, areaPaint);

    // Glow effect shadow stroke under trajectory line
    final glowPaint = Paint()
      ..color = AppColors.red.withValues(alpha: 0.28)
      ..strokeWidth = 6.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    canvas.drawPath(path, glowPaint);

    final linePaint = Paint()
      ..color = AppColors.red
      ..strokeWidth = 2.8
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    canvas.drawPath(path, linePaint);

    // 5. X-Axis Time Ticks & Labels
    for (int i = 0; i < points.length; i++) {
      final pt = points[i];
      final xPos = getX(i);
      final yBase = topMargin + chartHeight;
      final isSel = selectedIndex == i;

      canvas.drawLine(
        Offset(xPos, yBase),
        Offset(xPos, yBase + 4),
        gridPaint,
      );

      final timeSpan = TextSpan(
        text: pt.time,
        style: TextStyle(
          fontSize: 9.5,
          fontWeight: isSel ? FontWeight.w800 : (pt.label != null ? FontWeight.w700 : FontWeight.w500),
          color: isSel ? AppColors.teal : (pt.label != null ? AppColors.navy : AppColors.gray),
          fontFamily: 'Plus Jakarta Sans',
        ),
      );
      final timeTp = TextPainter(
        text: timeSpan,
        textDirection: TextDirection.ltr,
      );
      timeTp.layout();
      timeTp.paint(canvas, Offset(xPos - timeTp.width / 2, yBase + 6));
    }

    // X-Axis Subtitle / Unit "Waktu (WIB)"
    final xUnitSpan = const TextSpan(
      text: 'Waktu (WIB)',
      style: TextStyle(
        fontSize: 9.5,
        fontWeight: FontWeight.w700,
        color: AppColors.gray,
        fontFamily: 'Plus Jakarta Sans',
      ),
    );
    final xUnitTp = TextPainter(
      text: xUnitSpan,
      textDirection: TextDirection.ltr,
    );
    xUnitTp.layout();
    xUnitTp.paint(canvas, Offset(leftMargin + chartWidth / 2 - xUnitTp.width / 2, topMargin + chartHeight + 20));

    // Y-Axis Unit Label "Skor (SD)"
    final yUnitSpan = const TextSpan(
      text: 'Skor (SD)',
      style: TextStyle(
        fontSize: 9,
        fontWeight: FontWeight.w700,
        color: AppColors.gray,
        fontFamily: 'Plus Jakarta Sans',
      ),
    );
    final yUnitTp = TextPainter(
      text: yUnitSpan,
      textDirection: TextDirection.ltr,
    );
    yUnitTp.layout();
    yUnitTp.paint(canvas, Offset(leftMargin - 28, topMargin - 18));

    // 6. Data Point Dots & Milestone Callouts
    for (int i = 0; i < points.length; i++) {
      final pt = points[i];
      final px = getX(i);
      final py = getY(pt.score);
      final isSel = selectedIndex == i;

      if (isSel) {
        final highlightHalo = Paint()
          ..color = AppColors.teal.withValues(alpha: 0.35)
          ..style = PaintingStyle.fill;
        canvas.drawCircle(Offset(px, py), 9.0, highlightHalo);
      }

      final outerDotPaint = Paint()
        ..color = isSel
            ? AppColors.teal
            : (pt.label == 'Peak'
                ? AppColors.red
                : (pt.label == 'Onset' ? AppColors.amber : (pt.label == 'Recovery' ? AppColors.green : AppColors.red)))
        ..style = PaintingStyle.fill;

      final innerDotPaint = Paint()
        ..color = Colors.white
        ..style = PaintingStyle.fill;

      final dotRadius = isSel ? 5.5 : (pt.label != null ? 4.5 : 2.8);
      canvas.drawCircle(Offset(px, py), dotRadius, outerDotPaint);
      canvas.drawCircle(Offset(px, py), dotRadius * 0.5, innerDotPaint);

      if (pt.label == 'Peak') {
        final badgeText = 'Puncak ${pt.score.toStringAsFixed(1)}';
        final badgeSpan = TextSpan(
          text: badgeText,
          style: const TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w800,
            color: Colors.white,
            fontFamily: 'Plus Jakarta Sans',
          ),
        );
        final badgeTp = TextPainter(
          text: badgeSpan,
          textDirection: TextDirection.ltr,
        );
        badgeTp.layout();

        final bgRect = RRect.fromLTRBR(
          px - badgeTp.width / 2 - 5,
          py - 20,
          px + badgeTp.width / 2 + 5,
          py - 6,
          const Radius.circular(5),
        );

        final badgeBgPaint = Paint()
          ..color = AppColors.red
          ..style = PaintingStyle.fill;

        canvas.drawRRect(bgRect, badgeBgPaint);
        badgeTp.paint(canvas, Offset(px - badgeTp.width / 2, py - 18));
      } else if (pt.label == 'Onset' || pt.label == 'Recovery') {
        final mlTextSpan = TextSpan(
          text: pt.label,
          style: TextStyle(
            fontSize: 8.5,
            fontWeight: FontWeight.w700,
            color: pt.label == 'Onset' ? AppColors.amber : AppColors.green,
            fontFamily: 'Plus Jakarta Sans',
          ),
        );
        final mlTp = TextPainter(
          text: mlTextSpan,
          textDirection: TextDirection.ltr,
        );
        mlTp.layout();
        mlTp.paint(canvas, Offset(px - mlTp.width / 2, py - 15));
      }
    }
  }

  @override
  bool shouldRepaint(covariant _TrajectoryPainter oldDelegate) =>
      oldDelegate.selectedIndex != selectedIndex || oldDelegate.points != points;
}

