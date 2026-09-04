import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme/app_colors.dart';

class CardiovascularResilienceScreen extends StatefulWidget {
  const CardiovascularResilienceScreen({super.key});

  @override
  State<CardiovascularResilienceScreen> createState() => _CardiovascularResilienceScreenState();
}

class _CardiovascularResilienceScreenState extends State<CardiovascularResilienceScreen> {
  bool _loading = true;
  String? _error;

  Map<String, dynamic>? _resilienceData;

  // 5 Dimension scores for interactive simulation
  double _clinical = 76.0;
  double _cardiac = 84.0;
  double _autonomic = 88.0;
  double _recovery = 81.0;
  double _stability = 79.0;

  String _selectedDimensionKey = 'clinical';

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await ApiService.fetchCardiovascularResilienceState();
      if (res?['success'] == true && res?['data'] != null) {
        final data = res!['data'] as Map<String, dynamic>;
        final dims = data['dimensions'] as Map<String, dynamic>? ?? {};

        setState(() {
          _resilienceData = data;
          _clinical = (dims['clinical']?['score'] as num?)?.toDouble() ?? 76.0;
          _cardiac = (dims['cardiac']?['score'] as num?)?.toDouble() ?? 84.0;
          _autonomic = (dims['autonomic']?['score'] as num?)?.toDouble() ?? 88.0;
          _recovery = (dims['recovery']?['score'] as num?)?.toDouble() ?? 81.0;
          _stability = (dims['stability']?['score'] as num?)?.toDouble() ?? 79.0;
          _loading = false;
        });
      } else {
        setState(() => _loading = false);
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  double get _globalScore {
    final score = 0.20 * _clinical +
        0.20 * _cardiac +
        0.25 * _autonomic +
        0.20 * _recovery +
        0.15 * _stability;
    return double.parse(score.toStringAsFixed(1));
  }

  String get _stateLabel {
    if (_globalScore >= 85) return 'HIGH RESILIENCE';
    if (_globalScore >= 70) return 'MODERATE RESILIENCE';
    return 'LOW RESILIENCE';
  }

  Color get _stateColor {
    if (_globalScore >= 85) return const Color(0xFF10B981);
    if (_globalScore >= 70) return const Color(0xFFF59E0B);
    return const Color(0xFFEF4444);
  }

  @override
  Widget build(BuildContext context) {
    final engineStatus = _resilienceData?['caparEngineStatus'] as Map<String, dynamic>? ?? {
      'baseline': 'Mature',
      'currentState': 'Recovery Phase',
      'lastEpisodeTime': '14:32 WIB',
      'recoveryTimeMin': 3.8,
      'relapse': 'None',
    };

    final dims = _resilienceData?['dimensions'] as Map<String, dynamic>? ?? {};
    final currentDim = dims[_selectedDimensionKey] as Map<String, dynamic>? ?? {};
    final attributes = (currentDim['attributes'] as List<dynamic>?) ?? [];

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Cardiovascular Resilience',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
        ),
        backgroundColor: AppColors.surface,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppColors.teal),
            onPressed: _loadData,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.teal))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline_rounded, color: Colors.red, size: 48),
                        const SizedBox(height: 12),
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        ElevatedButton(
                          onPressed: _loadData,
                          style: ElevatedButton.styleFrom(backgroundColor: AppColors.teal),
                          child: const Text('Coba Lagi', style: TextStyle(color: Colors.white)),
                        ),
                      ],
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    // ── 1. MAIN RESILIENCE SCORE BANNER ───────────────────
                    _buildMainDashboardBanner(),
                    const SizedBox(height: 18),

                    // ── 2. 5 DIMENSIONAL MENU LIST ─────────────────────────
                    const Text(
                      '5 Pilar Resiliensi Kardiovaskular (CRS)',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.black87),
                    ),
                    const SizedBox(height: 10),
                    _buildDimensionTile('1', 'clinical', 'Clinical Vulnerability', _clinical, 20, const Color(0xFF6366F1), Icons.shield_rounded),
                    _buildDimensionTile('2', 'cardiac', 'Cardiac Reserve', _cardiac, 20, const Color(0xFFEC4899), Icons.favorite_rounded),
                    _buildDimensionTile('3', 'autonomic', 'Autonomic Reserve', _autonomic, 25, const Color(0xFF10B981), Icons.waves_rounded),
                    _buildDimensionTile('4', 'recovery', 'Recovery Capacity', _recovery, 20, const Color(0xFFF59E0B), Icons.replay_rounded),
                    _buildDimensionTile('5', 'stability', 'Regulation Stability', _stability, 15, const Color(0xFF0EA5E9), Icons.tune_rounded),
                    const SizedBox(height: 18),

                    // ── 3. CAPAR ENGINE STATUS ─────────────────────────────
                    _buildCaparEngineStatusCard(engineStatus),
                    const SizedBox(height: 18),

                    // ── 4. PARTICIPANT CONTEXT CONFIRMATION ACTION CARD (Q6 & Q9) ──
                    _buildContextConfirmationCard(context),
                    const SizedBox(height: 18),

                    // ── 5. DETAIL ATRIBUT & SLIDER SIMULASI ────────────────
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: Colors.black12),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Detail: ${currentDim['name'] ?? 'Dimensi'}',
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEEF2FF),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  'Skor: ${_getCurrentScore(_selectedDimensionKey).toInt()}',
                                  style: const TextStyle(color: Color(0xFF4F46E5), fontWeight: FontWeight.w900, fontSize: 11),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          ...attributes.map((attr) {
                            final m = attr as Map<String, dynamic>;
                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 4),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(m['label']?.toString() ?? '', style: const TextStyle(fontSize: 12, color: Colors.black87)),
                                  Text(m['value']?.toString() ?? '', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                                ],
                              ),
                            );
                          }),
                          const Divider(height: 20),
                          const Text('Simulasi What-If (Geser untuk tes):', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.gray)),
                          Slider(
                            value: _getCurrentScore(_selectedDimensionKey),
                            min: 20,
                            max: 100,
                            activeColor: AppColors.teal,
                            onChanged: (v) {
                              setState(() {
                                _setCurrentScore(_selectedDimensionKey, v);
                              });
                            },
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildContextConfirmationCard(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF59E0B), width: 1.2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.psychology_alt_rounded, color: Color(0xFFD97706), size: 18),
              SizedBox(width: 6),
              Text(
                'Konfirmasi Konteks Perilaku Peserta',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF92400E)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Klarifikasi faktor pemicu: Aktivitas fisik, stres mental, ada/tidaknya nyeri, atau faktor lingkungan untuk mengkalibrasi model Digital Twin ($c_{ctx}$ & $u_{unexp}$).',
            style: TextStyle(fontSize: 11.5, color: Color(0xFF78350F), height: 1.35),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => _showConfirmationBottomSheet(context),
              icon: const Icon(Icons.check_circle_outline_rounded, size: 16),
              label: const Text('Konfirmasi Pemicu Perilaku', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFD97706),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showConfirmationBottomSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const _ParticipantContextBottomSheet(),
    ).then((val) {
      if (val == true) {
        _loadData();
      }
    });
  }

  Widget _buildMainDashboardBanner() {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: _stateColor.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: _stateColor.withValues(alpha: 0.4)),
                ),
                child: Text(
                  'STATE: $_stateLabel',
                  style: TextStyle(
                    color: _stateColor,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              const Text(
                'CRS = 0.2CV+0.2CR+0.25AR+0.2RC+0.15RS',
                style: TextStyle(color: Colors.white54, fontSize: 9.5),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            'Overall Resilience Score',
            style: TextStyle(color: Colors.white70, fontSize: 12),
          ),
          const SizedBox(height: 2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                '$_globalScore',
                style: TextStyle(
                  color: _stateColor,
                  fontSize: 38,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(width: 6),
              const Text('/ 100', style: TextStyle(color: Colors.white54, fontSize: 14)),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: (_globalScore / 100).clamp(0.0, 1.0),
              minHeight: 8,
              backgroundColor: Colors.white12,
              valueColor: AlwaysStoppedAnimation<Color>(_stateColor),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDimensionTile(String num, String key, String title, double score, int weight, Color color, IconData icon) {
    final isSelected = _selectedDimensionKey == key;
    return GestureDetector(
      onTap: () => setState(() => _selectedDimensionKey = key),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isSelected ? color : Colors.black12, width: isSelected ? 2 : 1),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 14,
              backgroundColor: color.withValues(alpha: 0.15),
              foregroundColor: color,
              child: Text(num, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                  Text('Bobot: $weight%', style: const TextStyle(fontSize: 10.5, color: AppColors.gray)),
                ],
              ),
            ),
            Text(
              '${score.toInt()}',
              style: TextStyle(color: color, fontSize: 18, fontWeight: FontWeight.w900),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCaparEngineStatusCard(Map<String, dynamic> status) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFCBD5E1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.memory_rounded, color: AppColors.teal, size: 16),
              SizedBox(width: 6),
              Text(
                'CAPAR Engine Status',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _buildStatusRow('Baseline', status['baseline']?.toString() ?? 'Mature'),
          _buildStatusRow('Current State', status['currentState']?.toString() ?? 'Recovery Phase'),
          _buildStatusRow('Last Episode', status['lastEpisodeTime']?.toString() ?? '14:32'),
          _buildStatusRow('Recovery Time', '${status['recoveryTimeMin'] ?? 3.8} min'),
          _buildStatusRow('Relapse', status['relapse']?.toString() ?? 'None'),
        ],
      ),
    );
  }

  Widget _buildStatusRow(String label, String val) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 11.5, color: AppColors.gray)),
          Text(val, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
        ],
      ),
    );
  }

  double _getCurrentScore(String key) {
    switch (key) {
      case 'clinical': return _clinical;
      case 'cardiac': return _cardiac;
      case 'autonomic': return _autonomic;
      case 'recovery': return _recovery;
      case 'stability': return _stability;
      default: return 75.0;
    }
  }

  void _setCurrentScore(String key, double val) {
    switch (key) {
      case 'clinical': _clinical = val; break;
      case 'cardiac': _cardiac = val; break;
      case 'autonomic': _autonomic = val; break;
      case 'recovery': _recovery = val; break;
      case 'stability': _stability = val; break;
    }
  }
}

class _ParticipantContextBottomSheet extends StatefulWidget {
  const _ParticipantContextBottomSheet();

  @override
  State<_ParticipantContextBottomSheet> createState() => _ParticipantContextBottomSheetState();
}

class _ParticipantContextBottomSheetState extends State<_ParticipantContextBottomSheet> {
  String _selectedFactor = 'physical_activity';
  String _intensity = 'moderate';
  int _durationMinutes = 30;
  final TextEditingController _notesController = TextEditingController();
  bool _isSubmitting = false;

  final List<Map<String, dynamic>> _factors = [
    {
      'key': 'physical_activity',
      'title': 'Aktivitas Fisik',
      'icon': Icons.directions_run_rounded,
      'color': const Color(0xFF10B981),
      'desc': 'Jalan cepat, naik tangga, olahraga, atau mobilitas berat',
      'paper': 'Lear et al. (Lancet 2017) -> RC/AR',
    },
    {
      'key': 'mental_stress',
      'title': 'Beban / Stres Mental',
      'icon': Icons.psychology_rounded,
      'color': const Color(0xFF8B5CF6),
      'desc': 'Deadline mendadak, rapat tegang, beban kognitif tinggi',
      'paper': 'Kivimaki et al. (Lancet 2012) -> AR/RS',
    },
    {
      'key': 'pain_discomfort',
      'title': 'Ada / Tidaknya Nyeri',
      'icon': Icons.flash_on_rounded,
      'color': const Color(0xFFEF4444),
      'desc': 'Nyeri dada, migrain/kepala, pegal sendi akut',
      'paper': 'Koenig et al. (Pain 2016) -> AR/CV',
    },
    {
      'key': 'environmental_factor',
      'title': 'Faktor Lingkungan',
      'icon': Icons.wb_sunny_rounded,
      'color': const Color(0xFFF59E0B),
      'desc': 'Suhu ekstrem (sangat panas/dingin), polusi asap, kebisingan',
      'paper': 'Brook et al. (Circulation 2010) -> CV/AR',
    },
    {
      'key': 'caffeine',
      'title': 'Kafein / Kopi',
      'icon': Icons.local_cafe_rounded,
      'color': const Color(0xFF92400E),
      'desc': 'Espresso, kopi pekat, suplemen pre-workout',
      'paper': 'Mesas et al. (AJCN 2011) -> AR',
    },
    {
      'key': 'smoking',
      'title': 'Merokok / Nikotin',
      'icon': Icons.smoking_rooms_rounded,
      'color': const Color(0xFF64748B),
      'desc': 'Rokok konvensional atau vape tembakau',
      'paper': 'Hackshaw et al. (BMJ 2018) -> CV/AR',
    },
    {
      'key': 'diet_quality',
      'title': 'Makanan / Natrium Tinggi',
      'icon': Icons.restaurant_rounded,
      'color': const Color(0xFFEC4899),
      'desc': 'Makanan sangat asin/tinggi garam atau porsi besar',
      'paper': 'He & MacGregor (BMJ 2013) -> CR/CV',
    },
    {
      'key': 'sleep_duration',
      'title': 'Kurang / Gangguan Tidur',
      'icon': Icons.bedtime_rounded,
      'color': const Color(0xFF3B82F6),
      'desc': 'Tidur kurang dari 6 jam atau sering terbangun',
      'paper': 'Cappuccio et al. (Eur Heart J 2011) -> RC/RS',
    },
  ];

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _submitConfirmation() async {
    setState(() => _isSubmitting = true);
    try {
      final payload = {
        'behavior_type': _selectedFactor,
        'intensity': _intensity,
        'duration_minutes': _durationMinutes,
        'notes': _notesController.text.trim(),
        'confirmed_at': DateTime.now().toIso8601String(),
        'source': 'participant_context_confirmation',
      };

      final ok = await ApiService.confirmContextTrigger(payload);
      if (!mounted) return;
      setState(() => _isSubmitting = false);

      if (ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Konteks perilaku berhasil dikonfirmasi ke Digital Twin.'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
        Navigator.pop(context, true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Gagal menyimpan konfirmasi perilaku.'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Terjadi kesalahan: $e'), backgroundColor: Colors.redAccent),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 4.5,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Row(
              children: [
                Icon(Icons.tune_rounded, color: AppColors.teal, size: 22),
                SizedBox(width: 8),
                Text(
                  'Konfirmasi Konteks Perilaku',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                ),
              ],
            ),
            const SizedBox(height: 4),
            const Text(
              'Pilih faktor pemicu yang Anda rasakan/lakukan untuk menghubungkan data wearable dengan ground-truth fisiologis:',
              style: TextStyle(fontSize: 12, color: AppColors.gray, height: 1.3),
            ),
            const SizedBox(height: 16),
            const Text(
              '1. Kategori Faktor Perilaku / Lingkungan',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 8),
            ...List.generate(_factors.length, (idx) {
              final f = _factors[idx];
              final isSel = _selectedFactor == f['key'];
              final color = f['color'] as Color;

              return InkWell(
                onTap: () => setState(() => _selectedFactor = f['key']),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isSel ? color.withValues(alpha: 0.08) : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSel ? color : const Color(0xFFE2E8F0),
                      width: isSel ? 1.8 : 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(f['icon'] as IconData, color: color, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              f['title'] as String,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: isSel ? color : const Color(0xFF1E293B),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              f['desc'] as String,
                              style: const TextStyle(fontSize: 11, color: AppColors.gray),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Evidence: ${f['paper']}',
                              style: TextStyle(fontSize: 9.5, fontStyle: FontStyle.italic, color: color.withValues(alpha: 0.85)),
                            ),
                          ],
                        ),
                      ),
                      if (isSel)
                        Icon(Icons.check_circle_rounded, color: color, size: 20)
                      else
                        const Icon(Icons.radio_button_unchecked_rounded, color: Color(0xFFCBD5E1), size: 20),
                    ],
                  ),
                ),
              );
            }),
            const SizedBox(height: 12),
            const Text(
              '2. Intensitas Beban',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _buildIntensityOption('low', 'Ringan', Colors.green),
                const SizedBox(width: 8),
                _buildIntensityOption('moderate', 'Sedang', Colors.orange),
                const SizedBox(width: 8),
                _buildIntensityOption('high', 'Berat / Tinggi', Colors.red),
              ],
            ),
            const SizedBox(height: 14),
            const Text(
              '3. Estimasi Durasi (Menit)',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [10, 20, 30, 45, 60, 90, 120].map((d) {
                final isSel = _durationMinutes == d;
                return ChoiceChip(
                  label: Text('$d mnt', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: isSel ? Colors.white : Colors.black87)),
                  selected: isSel,
                  selectedColor: AppColors.teal,
                  backgroundColor: const Color(0xFFF1F5F9),
                  onSelected: (val) {
                    if (val) setState(() => _durationMinutes = d);
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 14),
            const Text(
              '4. Catatan / Rincian Konteks (Opsional)',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _notesController,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: 'Misal: Habis naik tangga darurat lantai 3 / ruangan panas terik...',
                hintStyle: const TextStyle(fontSize: 11.5, color: AppColors.gray),
                contentPadding: const EdgeInsets.all(12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.teal, width: 1.5),
                ),
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
              ),
              style: const TextStyle(fontSize: 12),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submitConfirmation,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.teal,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Text(
                        'Kirim Konfirmasi Konteks ke Digital Twin',
                        style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIntensityOption(String key, String label, Color color) {
    final isSel = _intensity == key;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _intensity = key),
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: isSel ? color.withValues(alpha: 0.12) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSel ? color : const Color(0xFFE2E8F0),
              width: isSel ? 1.8 : 1,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
              color: isSel ? color : const Color(0xFF475569),
            ),
          ),
        ),
      ),
    );
  }
}

