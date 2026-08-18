import 'package:flutter/material.dart';

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

  final List<Map<String, dynamic>> episodes = [
    {
      'id': 'EP-2026-0012',
      'date': 'Hari ini 09:02 WIB',
      'context': 'Duduk-berdiri acak',
      'status': 'Recovered',
      'duration': '38 m',
      'recoveryTime': '6 m',
      'onset': '08:24',
      'recovery': '08:56',
      'peakScore': 6.60,
      'auc': 141.8,
      'evidence': ['HR +2,1 SD', 'RMSSD −2,6 SD', 'DFA α1 +1,4 SD', 'Quality 0.94'],
      'points': const [
        TrajectoryPoint(time: '08:20', score: 0.40),
        TrajectoryPoint(time: '08:24', score: 1.50, label: 'Onset'),
        TrajectoryPoint(time: '08:32', score: 4.20),
        TrajectoryPoint(time: '08:40', score: 6.60, label: 'Peak'),
        TrajectoryPoint(time: '08:48', score: 3.10),
        TrajectoryPoint(time: '08:56', score: 1.20, label: 'Recovery'),
        TrajectoryPoint(time: '09:02', score: 0.50),
      ],
    },
    {
      'id': 'EP-2026-0011',
      'date': 'Kemarin 16:40 WIB',
      'context': 'Bekerja / rapat',
      'status': 'Recovered',
      'duration': '24 m',
      'recoveryTime': '4 m',
      'onset': '16:40',
      'recovery': '17:04',
      'peakScore': 2.40,
      'auc': 62.4,
      'evidence': ['HR +1,8 SD', 'RMSSD −1,9 SD', 'Quality 0.92'],
      'points': const [
        TrajectoryPoint(time: '16:35', score: 0.30),
        TrajectoryPoint(time: '16:40', score: 1.50, label: 'Onset'),
        TrajectoryPoint(time: '16:48', score: 2.40, label: 'Peak'),
        TrajectoryPoint(time: '16:56', score: 1.80),
        TrajectoryPoint(time: '17:04', score: 1.00, label: 'Recovery'),
        TrajectoryPoint(time: '17:10', score: 0.40),
      ],
    },
    {
      'id': 'EP-2026-0010',
      'date': 'Senin 10:12 WIB',
      'context': 'Berjalan santai',
      'status': 'Unresolved',
      'duration': '>90 m',
      'recoveryTime': '—',
      'onset': '10:12',
      'recovery': '—',
      'peakScore': 3.10,
      'auc': 210.5,
      'evidence': ['HR +2,5 SD', 'Quality 0.88'],
      'points': const [
        TrajectoryPoint(time: '10:05', score: 0.40),
        TrajectoryPoint(time: '10:12', score: 1.50, label: 'Onset'),
        TrajectoryPoint(time: '10:25', score: 2.60),
        TrajectoryPoint(time: '10:45', score: 3.10, label: 'Peak'),
        TrajectoryPoint(time: '11:05', score: 2.70),
        TrajectoryPoint(time: '11:25', score: 2.90),
      ],
    },
    {
      'id': 'EP-2026-0009',
      'date': 'Minggu 21:03 WIB',
      'context': 'Duduk / istirahat',
      'status': 'Recovered',
      'duration': '19 m',
      'recoveryTime': '3 m',
      'onset': '21:03',
      'recovery': '21:22',
      'peakScore': 1.95,
      'auc': 41.2,
      'evidence': ['HR +1,4 SD', 'RMSSD −1,5 SD', 'Quality 0.96'],
      'points': const [
        TrajectoryPoint(time: '20:58', score: 0.30),
        TrajectoryPoint(time: '21:03', score: 1.50, label: 'Onset'),
        TrajectoryPoint(time: '21:10', score: 1.95, label: 'Peak'),
        TrajectoryPoint(time: '21:16', score: 1.40),
        TrajectoryPoint(time: '21:22', score: 0.80, label: 'Recovery'),
        TrajectoryPoint(time: '21:27', score: 0.30),
      ],
    },
  ];

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
            child: ListView.builder(
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
    final List<TrajectoryPoint> points = (ep['points'] as List<TrajectoryPoint>? ?? []);
    final double peakScore = (ep['peakScore'] as num).toDouble();

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
              Text(
                ep['id'],
                style: const TextStyle(
                  fontFamily: 'Plus Jakarta Sans',
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.navy,
                ),
              ),
              const Spacer(),
              ep['status'] == 'Recovered' ? EvidenceChip.recovered() : EvidenceChip.qualityWarning(),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(left: 48),
            child: Text(
              '${ep['date']} · ${ep['context']}',
              style: const TextStyle(fontSize: 12, color: AppColors.gray),
            ),
          ),
          const SizedBox(height: 20),

          // Score Trajectory Graphic Card with X and Y Axes
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
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Trajektori Skor Deviasi',
                            style: TextStyle(
                              fontFamily: 'Plus Jakarta Sans',
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: AppColors.navy,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Sumbu Y: Skor Deviasi (SD) · Sumbu X: Waktu (WIB)',
                            style: TextStyle(fontSize: 10.5, color: AppColors.gray),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(width: 8, height: 8, decoration: const BoxDecoration(color: AppColors.red, shape: BoxShape.circle)),
                            const SizedBox(width: 4),
                            const Text('Skor Deviasi', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, color: AppColors.gray)),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(width: 8, height: 2, color: AppColors.amber),
                            const SizedBox(width: 4),
                            const Text('τin (1,5)', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, color: AppColors.amber)),
                          ],
                        ),
                      ],
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
              _buildMetricCard('Peak Score', ep['peakScore'].toString()),
              _buildMetricCard('AUC Burden', ep['auc'].toString()),
            ],
          ),
          const SizedBox(height: 16),

          const Text('EVIDENCE & PENJELASAN', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: (ep['evidence'] as List<String>).map((ev) => Chip(
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

