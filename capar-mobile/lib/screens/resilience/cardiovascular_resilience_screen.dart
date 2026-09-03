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

                    // ── 4. DETAIL ATRIBUT & SLIDER SIMULASI ────────────────
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
