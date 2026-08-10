import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../../widgets/evidence_chip.dart';

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

  // A14 History List
  Widget _buildHistoryListScreen() {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Riwayat Episode',
            style: TextStyle(
              fontFamily: 'Plus Jakarta Sans',
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppColors.navy,
            ),
          ),
          const SizedBox(height: 2),
          const Text(
            'Catatan longitudinal episode deviasi & recovery',
            style: TextStyle(fontSize: 12, color: AppColors.gray),
          ),
          const SizedBox(height: 16),

          Expanded(
            child: ListView.builder(
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
                    title: Text(
                      ep['date'],
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.navy),
                    ),
                    subtitle: Text(
                      ep['context'],
                      style: const TextStyle(fontSize: 11, color: AppColors.gray),
                    ),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        isRecovered ? EvidenceChip.recovered() : EvidenceChip.qualityWarning(),
                        const SizedBox(height: 4),
                        Text(
                          ep['duration'],
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.ink),
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

  // A15 Episode Detail
  Widget _buildEpisodeDetailScreen(Map<String, dynamic> ep) {
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
              EvidenceChip.recovered(),
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
            child: CustomPaint(
              painter: _TrajectoryPainter(),
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
