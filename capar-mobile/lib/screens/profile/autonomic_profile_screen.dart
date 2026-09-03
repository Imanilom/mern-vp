import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

class AutonomicProfileScreen extends StatefulWidget {
  const AutonomicProfileScreen({super.key});

  @override
  State<AutonomicProfileScreen> createState() => _AutonomicProfileScreenState();
}

class _AutonomicProfileScreenState extends State<AutonomicProfileScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String _expandedQId = 'Q1';

  final List<Map<String, dynamic>> _qList = [
    {
      'id': 'Q1',
      'title': 'Seberapa sering deviasi terjadi?',
      'evidence': 'episode_id + valid time, timestamp, state, context',
      'metrics': 'episode rate, episode_count, episodes_per_valid_hour',
      'level': 'Episode / Day',
      'color': Color(0xFF0284C7),
      'icon': Icons.show_chart_rounded,
      'dataLog': 'timestamp, valid_window, state, episode_id, context',
      'derived': 'Episode segmentation; durasi monitoring valid; episode count per hari/per konteks.',
      'formula': 'N_episode = jumlah episode_id unik yang valid\nDeviation Rate = N_episode / valid monitoring hours',
      'example': '“Terdeteksi 4 episode deviasi dalam 12 jam monitoring valid (0,33 episode/jam). Dua episode terjadi saat duduk dan dua saat berdiri.”',
      'why': 'Sistem menghitung episode unik yang lolos quality gate, bukan jumlah baris state deviasi mentah.',
      'limits': 'Frekuensi bergantung pada parameter onset, hysteresis, dwell, dan aturan penggabungan episode.',
    },
    {
      'id': 'Q2',
      'title': 'Seberapa besar deviasinya?',
      'evidence': 'deviation_score + baseline personal, HR, RR/HRV, DFA',
      'metrics': 'Peak D, AUC-D, Z_HR, Z_dHR, Z_DFA',
      'level': 'Episode',
      'color': Color(0xFFE11D48),
      'icon': Icons.speed_rounded,
      'dataLog': 'HR, RR/HRV, DFA alpha1, baseline personal-contextual, z_hr, z_dhr, z_dfa, deviation_score',
      'derived': 'Z-score per feature; weighted deviation score D(t); peak deviation; AUC-D.',
      'formula': 'Z_HR(t) = [HR(t) - mean_HR,context] / SD_HR,context\nD(t) = w1|Z_HR| + w2|Z_dHR| + w3|Z_DFA| + ...\nPeak D = max D(t), AUC-D = integral D(t) dt',
      'example': '“Episode E12 memiliki peak deviation 2,8 dan AUC-D tertinggi hari ini. Penyumbang terbesar berasal dari Z_HR dan Z_DFA.”',
      'why': 'Magnitudo dijelaskan oleh jarak terhadap baseline personal-contextual, bukan oleh HR absolut semata.',
      'limits': 'Nilai magnitudo hanya bermakna bila baseline sudah matang (mature) dan weights ditentukan eksplisit.',
    },
    {
      'id': 'Q3',
      'title': 'Berapa lama deviasi bertahan?',
      'evidence': 'onset + persistent_start + recovery_start',
      'metrics': 'deviation_duration_sec, persistent_duration_sec',
      'level': 'Episode',
      'color': Color(0xFFD97706),
      'icon': Icons.timer_rounded,
      'dataLog': 'episode_id, onset, persistent_start, recovery_start, state',
      'derived': 'Deviation duration dan persistent duration.',
      'formula': 'Deviation Duration = t_recovery_start - t_onset\nPersistent Duration = t_recovery_start - t_persistent_start',
      'example': '“Deviasi bertahan 210 detik sebelum recovery dimulai; 145 detik berada pada state persistent deviation.”',
      'why': 'XAI menunjukkan timestamp onset dan recovery-start sehingga durasi dapat diaudit langsung.',
      'limits': 'Episode unresolved tidak memiliki recovery_start lengkap dan ditandai censored, bukan dipaksakan selesai.',
    },
    {
      'id': 'Q4',
      'title': 'Seberapa cepat recovery?',
      'evidence': 'recovery trajectory, recovery_start, recovered_at',
      'metrics': 'TTR (Time-to-Recovery), velocity, acceleration',
      'level': 'Episode',
      'color': Color(0xFF059669),
      'icon': Icons.directions_run_rounded,
      'dataLog': 'recovery_start, recovered_at, deviation_score sepanjang recovery, timestamp',
      'derived': 'Time-to-recovery (TTR), recovery velocity/slope, recovery acceleration.',
      'formula': 'TTR = t_recovered - t_recovery_start\nRecovery velocity = [D_start - D_end] / TTR\nRecovery acceleration = delta(recovery velocity) / delta time',
      'example': '“Recovery selesai dalam 92 detik. Deviation score turun secara konsisten dengan recovery velocity positif; tidak ada pembalikan arah besar.”',
      'why': 'TTR menjawab lama recovery, sedangkan velocity dan acceleration menjelaskan bentuk lintasan menuju target.',
      'limits': 'TTR wajib dibandingkan pada konteks yang sama (TTR duduk berbeda dari TTR berlari).',
    },
    {
      'id': 'Q5',
      'title': 'Apakah benar-benar stabil atau relapse?',
      'evidence': 'post-recovery states, recovered_at, motion, context',
      'metrics': 'relapse rate, relapse latency, recovery stability',
      'level': 'Episode',
      'color': Color(0xFF7C3AED),
      'icon': Icons.security_rounded,
      'dataLog': 'recovered_at, state setelah recovered, deviation_score, context, motion, episode_id',
      'derived': 'Post-recovery observation window; relapse count; relapse latency; recovery stability.',
      'formula': 'Relapse = 1 bila deviasi muncul kembali dalam W_R tanpa stimulus baru\nRelapse Rate = N_relapse / N_recovered\nRecovery Stability = 1 - Relapse Rate',
      'example': '“Tiga dari 10 episode recovered kembali memasuki deviation dalam 10 menit; relapse rate 30%. Dua kejadian tidak disertai perubahan aktivitas.”',
      'why': 'XAI memperlihatkan urutan state: Recovery -> Recovered -> Stable -> Deviation serta waktu dan konteksnya.',
      'limits': 'Perubahan aktivitas baru harus mengecualikan episode dari label relapse fisiologis internal.',
    },
    {
      'id': 'Q6',
      'title': 'Apakah deviasi sesuai aktivitas?',
      'evidence': 'context + ACC + motion_intensity + baseline',
      'metrics': 'context appropriateness, context-explained vs inappropriate',
      'level': 'Episode / Context',
      'color': Color(0xFF2563EB),
      'icon': Icons.directions_walk_rounded,
      'dataLog': 'context, ACC, motion_intensity, HR/RR/HRV/DFA, contextual baseline, event marker',
      'derived': 'Context appropriateness; context-explained versus context-inappropriate candidate.',
      'formula': 'Bandingkan D(t) terhadap baseline personal pada context yang aktif\nContext explained bila perubahan fisiologi selaras dengan motion/transisi aktivitas.',
      'example': '“HR meningkat, tetapi episode terjadi saat duduk dengan motion rendah dan tanpa transisi aktivitas. Deviasi tidak cukup dijelaskan oleh aktivitas.”',
      'why': 'Nilai fisiologis dinilai relatif terhadap context yang sedang berlangsung, bukan universal threshold.',
      'limits': 'Context classifier yang salah dapat memicu false unexplained episode. Verifikasi via kuesioner EMA membantu.',
    },
    {
      'id': 'Q7',
      'title': 'Apakah berbeda pagi-siang-sore-malam?',
      'evidence': 'timestamp + time_of_day + contextual metrics',
      'metrics': 'time-of-day profile, diurnal TTR variation',
      'level': 'Within-day',
      'color': Color(0xFFEA580C),
      'icon': Icons.wb_sunny_rounded,
      'dataLog': 'timestamp, time_of_day, context, episode metrics (TTR, peak D, AUC-D, relapse)',
      'derived': 'Stratifikasi time-of-day dan context-adjusted profile.',
      'formula': 'Bandingkan metrics dalam context yang sama:\nTTR_context,morning vs TTR_context,night',
      'example': '“Median TTR pada episode duduk meningkat dari 80 detik pagi menjadi 145 detik malam pada context duduk yang sama.”',
      'why': 'XAI memastikan perbedaan tidak semata-mata akibat komposisi aktivitas, melainkan murni efek sirkadian.',
      'limits': 'Perbedaan pagi-malam dapat dipengaruhi faktor perancu (kualitas tidur, stres, makan, hidrasi).',
    },
    {
      'id': 'Q8',
      'title': 'Apakah pola itu konsisten lintas hari?',
      'evidence': 'daily metrics, date, TTR, peak D, relapse',
      'metrics': 'daily profile, CV (Coefficient of Variation), repeatability',
      'level': 'Between-day',
      'color': Color(0xFF4F46E5),
      'icon': Icons.date_range_rounded,
      'dataLog': 'date, episode_id, TTR, peak D, AUC-D, relapse, unexplained flag',
      'derived': 'Daily autonomic profile; median/IQR; coefficient of variation (CV); repeatability.',
      'formula': 'Daily Profile_d = [Ndev, median Peak D, median AUC-D, median TTR, relapse rate]\nCV = SD(day metric) / Mean(day metric)',
      'example': '“Median TTR relatif konsisten selama 5 hari (CV 0,16), sedangkan unexplained episode muncul hanya pada dua hari.”',
      'why': 'Kesimpulan phenotype tidak dibangun dari satu hari; XAI memperlihatkan apakah karakteristik berulang atau sporadis.',
      'limits': 'Hari dengan coverage rendah atau jumlah episode minim diberi penanda kualitas data.',
    },
    {
      'id': 'Q9',
      'title': 'Apakah ada unexplained episode?',
      'evidence': 'quality + context + motion + EMA exclusion cascade',
      'metrics': 'unexplained burden, candidate count, exclusion blockers',
      'level': 'Episode / Context',
      'color': Color(0xFFDC2626),
      'icon': Icons.warning_amber_rounded,
      'dataLog': 'quality_score, valid_window, baseline_mature, motion_intensity, context_transition, EMA/event marker, persistence',
      'derived': 'Unexplained deviation candidate setelah exclusion cascade bertingkat.',
      'formula': 'Candidate = Quality Valid AND Baseline Mature AND Low Motion AND No Transition AND No EMA Event',
      'example': '“Episode E21 ditandai unexplained candidate karena kualitas sinyal 0,97, baseline mature, motion rendah, tidak ada transisi context/EMA, deviasi 76 detik.”',
      'why': 'XAI menjelaskan setiap syarat yang lolos dan alasan bila suatu episode tidak layak disebut unexplained.',
      'limits': 'Unexplained tidak identik dengan patologis (stres psikologis, kafein, obat tetap mungkin).',
    },
    {
      'id': 'Q10',
      'title': 'Apakah menunjukkan fenotipe regulasi tertentu?',
      'evidence': 'agregasi Q1-Q9, vektor fenotipe Phi, rule model',
      'metrics': 'Phenotype Vector Phi, candidate label, confidence, reasons',
      'level': 'Person / Longitudinal',
      'color': Color(0xFF0D9488),
      'icon': Icons.fingerprint_rounded,
      'dataLog': 'Seluruh output Q1-Q9 pada level episode, hari, context, dan individu',
      'derived': 'Phenotype vector Phi = [F, M, D, R, S, C, T, K, U] dan model inferensi fenotipe.',
      'formula': 'Phi = [F, M, D, R, S, C, T, K, U]\nF=freq, M=mag, D=dur, R=rec, S=stab, C=ctx, T=time, K=cons, U=unexpl',
      'example': '“Phenotype kandidat: Unstable Recovery. Alasan: Relapse rate 31%, recovery state switching tinggi, pola berulang multi-hari, dan deviasi tanpa gerak.”',
      'why': 'Q10 bukan kotak hitam satu fitur. Ia mengagregasi evidence Q1-Q9 dan menyimpan audit trail yang dapat ditelusuri.',
      'limits': 'Phenotype merupakan konstruk analitik; diagnosis klinis tetap membutuhkan konfirmasi ECG/Holter dan dokter.',
    },
  ];

  final List<Map<String, dynamic>> _phenotypes = [
    {
      'name': 'Efficient / Stable Regulation',
      'badge': 'Optimal',
      'color': Color(0xFF10B981),
      'desc': 'TTR relatif singkat sesuai baseline personal-contextual, relapse rendah, state stabil, unexplained burden rendah.',
    },
    {
      'name': 'Delayed Recovery Candidate',
      'badge': 'Delayed',
      'color': Color(0xFFF59E0B),
      'desc': 'TTR memanjang dan/atau recovery velocity rendah secara berulang pada context yang sebanding.',
    },
    {
      'name': 'Unstable Recovery Candidate',
      'badge': 'Unstable',
      'color': Color(0xFF8B5CF6),
      'desc': 'Relapse atau state switching berulang setelah fase pemulihan awal tercapai.',
    },
    {
      'name': 'Persistent Dysregulation Candidate',
      'badge': 'Persistent',
      'color': Color(0xFFEF4444),
      'desc': 'Deviasi/persistensi panjang, AUC-D tinggi, dan recovery tidak tuntas dengan residual tinggi.',
    },
    {
      'name': 'Recurrent Unexplained Deviation',
      'badge': 'Unexplained',
      'color': Color(0xFFEC4899),
      'desc': 'Episode berulang yang lolos quality dan baseline gate namun terjadi tanpa stimulus motion/transisi aktivitas.',
    },
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: const Text(
          'Profil Otonom & XAI (Q1–Q10)',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.navy),
        ),
        backgroundColor: AppColors.surface,
        elevation: 0,
        centerTitle: false,
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.teal,
          unselectedLabelColor: AppColors.gray,
          labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
          indicatorColor: AppColors.teal,
          tabs: const [
            Tab(text: 'Matriks Q1–Q10'),
            Tab(text: 'Detail Evidence'),
            Tab(text: '5 Fenotipe'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildMatrixTab(),
          _buildDetailTab(),
          _buildPhenotypesTab(),
        ],
      ),
    );
  }

  Widget _buildMatrixTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Pipeline Flow Banner
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.navy,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.hub_rounded, size: 14, color: AppColors.teal),
                  SizedBox(width: 6),
                  Text(
                    'PIPELINE REGULASI OTONOM',
                    style: TextStyle(color: AppColors.teal, fontWeight: FontWeight.w800, fontSize: 10, letterSpacing: 0.5),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                'Raw Log → Valid Window → Contextual Baseline → Deviation → State Machine → Episode → Recovery Metrics → Daily Pattern → Longitudinal Phenotype',
                style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600, height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // Disclaimer
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xFFFFFBEB),
            border: Border.all(color: const Color(0xFFFDE68A)),
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Text(
            'Catatan: Output Q1–Q10 merupakan inferensi regulasi fisiologis & kandidat digital biomarker, bukan diagnosis definitif penyakit jantung.',
            style: TextStyle(fontSize: 10.5, color: Color(0xFF92400E), height: 1.4),
          ),
        ),
        const SizedBox(height: 14),

        // Matriks Cards
        ..._qList.map((q) {
          final color = q['color'] as Color;
          return Card(
            margin: const EdgeInsets.only(bottom: 10),
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
              side: const BorderSide(color: AppColors.line),
            ),
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () {
                setState(() => _expandedQId = q['id'] as String);
                _tabController.animateTo(1);
              },
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: color.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            q['id'] as String,
                            style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 11),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            q['title'] as String,
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: AppColors.navy),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.bg,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.line),
                          ),
                          child: Text(
                            q['level'] as String,
                            style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: AppColors.gray),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Evidence: ${q['evidence']}',
                      style: const TextStyle(fontSize: 11, color: AppColors.ink, fontFamily: 'monospace'),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Metrik: ${q['metrics']}',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.navy),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildDetailTab() {
    final currentQ = _qList.firstWhere((q) => q['id'] == _expandedQId, orElse: () => _qList[0]);
    final color = currentQ['color'] as Color;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Selector Row
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: _qList.map((q) {
              final isSel = q['id'] == _expandedQId;
              final qCol = q['color'] as Color;
              return Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(q['id'] as String),
                  selected: isSel,
                  selectedColor: qCol,
                  labelStyle: TextStyle(
                    color: isSel ? Colors.white : AppColors.navy,
                    fontWeight: FontWeight.w800,
                    fontSize: 11,
                  ),
                  onSelected: (val) {
                    if (val) setState(() => _expandedQId = q['id'] as String);
                  },
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 14),

        // Detail Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.3), width: 1.5),
            boxShadow: [
              BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 10, offset: const Offset(0, 3)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      currentQ['id'] as String,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      currentQ['title'] as String,
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.navy),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Data Log & Derived
              _buildInfoRow('Data Log Utama', currentQ['dataLog'] as String, isCode: true),
              const SizedBox(height: 8),
              _buildInfoRow('Variabel Turunan', currentQ['derived'] as String),
              const SizedBox(height: 12),

              // Formula Box
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('PERHITUNGAN & ATURAN:', style: TextStyle(color: Color(0xFF38BDF8), fontSize: 9.5, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text(
                      currentQ['formula'] as String,
                      style: const TextStyle(color: Color(0xFFE2E8F0), fontFamily: 'monospace', fontSize: 11, height: 1.4),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Example XAI Box
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('CONTOH PENJELASAN XAI:', style: TextStyle(color: Color(0xFF1D4ED8), fontSize: 9.5, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text(
                      currentQ['example'] as String,
                      style: const TextStyle(color: Color(0xFF1E3A8A), fontStyle: FontStyle.italic, fontSize: 11.5, height: 1.4),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Why & Limitations
              _buildBoxRow('MENGAPA DAPAT DIJELASKAN?', currentQ['why'] as String, const Color(0xFFF0FDF4), const Color(0xFF15803D), const Color(0xFFBBF7D0)),
              const SizedBox(height: 8),
              _buildBoxRow('KETERBATASAN INTERPRETASI', currentQ['limits'] as String, const Color(0xFFFFF1F2), const Color(0xFFBE123C), const Color(0xFFFECDD3)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPhenotypesTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text(
          'Taksonomi 5 Kandidat Fenotipe Regulasi Otonom',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.navy),
        ),
        const SizedBox(height: 4),
        const Text(
          'Hasil agregasi seluruh rantai bukti Q1–Q9 menjadi vektor fenotipe Phi = [F, M, D, R, S, C, T, K, U].',
          style: TextStyle(fontSize: 11.5, color: AppColors.gray),
        ),
        const SizedBox(height: 14),

        ..._phenotypes.map((p) {
          final col = p['color'] as Color;
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: col.withValues(alpha: 0.35), width: 1.2),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        p['name'] as String,
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: col),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: col.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        p['badge'] as String,
                        style: TextStyle(color: col, fontWeight: FontWeight.w800, fontSize: 10),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  p['desc'] as String,
                  style: const TextStyle(fontSize: 11.5, color: AppColors.ink, height: 1.45),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }

  Widget _buildInfoRow(String label, String value, {bool isCode = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(), style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: AppColors.gray)),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(fontSize: 11.5, color: AppColors.navy, fontFamily: isCode ? 'monospace' : null),
        ),
      ],
    );
  }

  Widget _buildBoxRow(String label, String value, Color bg, Color textCol, Color border) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: textCol, fontWeight: FontWeight.w800, fontSize: 9.5)),
          const SizedBox(height: 2),
          Text(value, style: TextStyle(color: textCol.withValues(alpha: 0.9), fontSize: 11, height: 1.35)),
        ],
      ),
    );
  }
}
