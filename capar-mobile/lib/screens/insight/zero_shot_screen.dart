import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../services/api_service.dart';
import '../../theme/app_colors.dart';

// ─────────────────────────────────────────────────────────────────────────────
// ZeroShotScreen v2 — 6 Log Sources
// [1] Monitoring · [2] Baseline · [3] State · [4] Episode · [5] Experience · [6] Prediksi
// ─────────────────────────────────────────────────────────────────────────────

const _riskColors = {
  'rendah': Color(0xFF2E7D32),
  'sedang': Color(0xFFD98800),
  'tinggi': Color(0xFFB52A2A),
  'kritis': Color(0xFFFF6B6B),
};

const _riskBgColors = {
  'rendah': Color(0xFFE7F4E8),
  'sedang': Color(0xFFFBF0DD),
  'tinggi': Color(0xFFFAE6E6),
  'kritis': Color(0xFF3D0000),
};

class ZeroShotScreen extends StatefulWidget {
  const ZeroShotScreen({super.key});

  @override
  State<ZeroShotScreen> createState() => _ZeroShotScreenState();
}

class _ZeroShotScreenState extends State<ZeroShotScreen>
    with SingleTickerProviderStateMixin {
  List<Map<String, dynamic>> _episodes = [];
  Map<String, dynamic>? _selectedEpisode;
  Map<String, dynamic>? _result;
  Map<String, dynamic>? _meta;
  bool _loading = false;
  bool _fetchingEps = false;
  String? _error;
  late TabController _tabController;
  final _searchCtrl = TextEditingController();
  String _searchQ = '';

  static const _tabs = [
    {'id': 'patient',   'label': 'Pasien',    'icon': Icons.person_heart_rounded},
    {'id': 'monitor',   'label': 'Monitor',   'icon': Icons.wifi_tethering_rounded},
    {'id': 'baseline',  'label': 'Baseline',  'icon': Icons.bar_chart_rounded},
    {'id': 'state',     'label': 'State',     'icon': Icons.timeline_rounded},
    {'id': 'episode',   'label': 'Episode',   'icon': Icons.waves_rounded},
    {'id': 'experience','label': 'Memory',    'icon': Icons.psychology_rounded},
    {'id': 'predict',   'label': 'Prediksi',  'icon': Icons.track_changes_rounded},
    {'id': 'clinical',  'label': 'Klinis',    'icon': Icons.medical_services_rounded},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
    _loadEpisodes();
    _searchCtrl.addListener(() => setState(() => _searchQ = _searchCtrl.text));
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadEpisodes() async {
    setState(() => _fetchingEps = true);
    try {
      final data = await ApiService.fetchZeroShotEpisodes();
      if (mounted) setState(() => _episodes = data);
    } catch (e) {
      debugPrint('[ZeroShot] load episodes error: $e');
    } finally {
      if (mounted) setState(() => _fetchingEps = false);
    }
  }

  Future<void> _runAnalysis() async {
    if (_selectedEpisode == null) return;
    setState(() { _loading = true; _error = null; _result = null; _meta = null; });
    try {
      final episodeId = _selectedEpisode!['_id']?.toString() ?? '';
      final res = await ApiService.runZeroShotAnalysis(episodeId);
      if (res != null && res['success'] == true) {
        setState(() {
          _result = res['result'] as Map<String, dynamic>?;
          _meta   = res;
          _tabController.animateTo(0);
        });
      } else {
        setState(() => _error = res?['message'] ?? 'Analisis gagal.');
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filteredEpisodes {
    if (_searchQ.isEmpty) return _episodes;
    final q = _searchQ.toLowerCase();
    return _episodes.where((ep) =>
      (ep['activity'] as String? ?? '').toLowerCase().contains(q) ||
      (ep['classification'] as String? ?? '').toLowerCase().contains(q)
    ).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: _buildAppBar(),
      body: Column(
        children: [
          _buildEpisodeSelector(),
          if (_selectedEpisode != null) _buildAnalyzeButton(),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  AppBar _buildAppBar() {
    return AppBar(
      backgroundColor: AppColors.navy,
      elevation: 0,
      title: Row(
        children: [
          Container(
            width: 30, height: 30,
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [AppColors.teal, AppColors.navy.withValues(alpha: 0.8)]),
              borderRadius: BorderRadius.circular(7),
            ),
            child: const Icon(Icons.smart_toy_rounded, color: Colors.white, size: 16),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('AI Zero-Shot Analyst',
                    style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w800)),
                Text('6 Sumber Log CAPAR',
                    style: TextStyle(color: Color(0xFF8FB6C4), fontSize: 9.5)),
              ],
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh_rounded, color: Colors.white, size: 20),
          onPressed: _fetchingEps ? null : _loadEpisodes,
        ),
      ],
    );
  }

  Widget _buildEpisodeSelector() {
    return Container(
      color: AppColors.navy,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Column(
        children: [
          // Search
          Container(
            height: 36,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: TextField(
              controller: _searchCtrl,
              style: const TextStyle(color: Colors.white, fontSize: 12),
              decoration: const InputDecoration(
                hintText: 'Cari aktivitas / klasifikasi...',
                hintStyle: TextStyle(color: Color(0xFF6A8A9A), fontSize: 12),
                prefixIcon: Icon(Icons.search_rounded, color: Color(0xFF6A8A9A), size: 16),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(vertical: 10),
              ),
            ),
          ),
          const SizedBox(height: 10),

          // Episode horizontal list
          SizedBox(
            height: 72,
            child: _episodes.isEmpty
                ? Center(child: _fetchingEps
                    ? const CircularProgressIndicator(strokeWidth: 1.5, color: Color(0xFF8FB6C4))
                    : const Text('Tidak ada episode', style: TextStyle(color: Color(0xFF8FB6C4), fontSize: 12)))
                : ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: _filteredEpisodes.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (context, i) {
                      final ep = _filteredEpisodes[i];
                      final isSelected = (_selectedEpisode?['_id']) == ep['_id'];
                      final isAlert = ep['classification'] == 'Alert';
                      final col = isAlert ? AppColors.red : AppColors.amber;
                      final ts = ep['onset_time'] as num?;
                      final date = ts != null
                          ? DateTime.fromMillisecondsSinceEpoch(
                              ts < 1e12 ? (ts * 1000).toInt() : ts.toInt())
                              .toLocal()
                          : null;

                      return GestureDetector(
                        onTap: () => setState(() {
                          _selectedEpisode = ep;
                          _result = null;
                          _error = null;
                          _meta = null;
                        }),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          width: 130,
                          padding: const EdgeInsets.all(9),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? AppColors.teal.withValues(alpha: 0.18)
                                : Colors.white.withValues(alpha: 0.07),
                            borderRadius: BorderRadius.circular(9),
                            border: Border.all(
                              color: isSelected ? AppColors.teal : Colors.white.withValues(alpha: 0.1),
                              width: isSelected ? 1.5 : 1,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(children: [
                                Container(width: 5, height: 5, decoration: BoxDecoration(color: col, shape: BoxShape.circle)),
                                const SizedBox(width: 5),
                                Expanded(child: Text(ep['classification'] ?? '—',
                                    style: TextStyle(color: col, fontSize: 9.5, fontWeight: FontWeight.w800),
                                    overflow: TextOverflow.ellipsis)),
                                if (ep['relapse'] == true)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                    decoration: BoxDecoration(color: AppColors.red.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(4)),
                                    child: Text('R', style: TextStyle(fontSize: 8, color: AppColors.red, fontWeight: FontWeight.w800)),
                                  ),
                              ]),
                              Text(ep['activity'] ?? '—',
                                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
                                  overflow: TextOverflow.ellipsis),
                              Row(children: [
                                Text(
                                  ep['duration_ms'] != null
                                      ? '${((ep['duration_ms'] as num) / 60000).round()} mnt'
                                      : '—',
                                  style: const TextStyle(color: Color(0xFF8FB6C4), fontSize: 9.5),
                                ),
                                const Spacer(),
                                if (date != null)
                                  Text(
                                    '${date.day}/${date.month}',
                                    style: const TextStyle(color: Color(0xFF8FB6C4), fontSize: 9.5),
                                  ),
                              ]),
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

  Widget _buildAnalyzeButton() {
    return Container(
      color: AppColors.navy,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: _loading ? null : _runAnalysis,
          icon: _loading
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.psychology_rounded, size: 18),
          label: Text(_loading ? 'Menganalisis 6 sumber...' : 'Jalankan Zero-Shot Analysis'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.teal,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 11),
            textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
            elevation: 0,
          ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return _buildLoadingState();
    if (_error != null) return _buildErrorState(_error!);
    if (_result == null) return _buildEmptyState();
    return _buildResultPanel(_result!, _meta);
  }

  Widget _buildEmptyState() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(28),
      child: Column(
        children: [
          const SizedBox(height: 20),
          Container(
            width: 76, height: 76,
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [AppColors.navy, AppColors.teal]),
              shape: BoxShape.circle,
              boxShadow: [BoxShadow(color: AppColors.teal.withValues(alpha: 0.3), blurRadius: 24)],
            ),
            child: const Icon(Icons.smart_toy_rounded, color: Colors.white, size: 36),
          ),
          const SizedBox(height: 18),
          Text('6 Sumber Log CAPAR', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppColors.navy)),
          const SizedBox(height: 8),
          Text('Pilih episode di atas untuk memulai analisis holistik.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: AppColors.gray, height: 1.6)),
          const SizedBox(height: 20),
          Wrap(spacing: 10, runSpacing: 10, alignment: WrapAlignment.center,
            children: [
              _logChip(Icons.wifi_tethering_rounded, 'Monitoring',  AppColors.blue),
              _logChip(Icons.bar_chart_rounded,      'Baseline',    AppColors.teal),
              _logChip(Icons.timeline_rounded,       'State',       AppColors.purple),
              _logChip(Icons.waves_rounded,          'Episode',     AppColors.amber),
              _logChip(Icons.psychology_rounded,     'Experience',  AppColors.green),
              _logChip(Icons.track_changes_rounded,  'Prediksi',    AppColors.red),
            ],
          ),
        ],
      ),
    );
  }

  Widget _logChip(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _buildLoadingState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 68, height: 68,
            child: Stack(
              alignment: Alignment.center,
              children: [
                CircularProgressIndicator(strokeWidth: 3, color: AppColors.teal),
                Icon(Icons.psychology_rounded, color: AppColors.teal, size: 30),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Text('Menganalisis 6 Sumber Log...',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppColors.navy)),
          const SizedBox(height: 6),
          Text('Monitoring → Baseline → State → Episode → Experience → Prediksi',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11.5, color: AppColors.gray, height: 1.5)),
        ],
      ),
    );
  }

  Widget _buildErrorState(String error) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.redSoft,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.red),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(children: [
              Icon(Icons.error_rounded, color: AppColors.red, size: 18),
              const SizedBox(width: 7),
              Text('Analisis Gagal', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.red)),
            ]),
            const SizedBox(height: 10),
            Text(error, style: TextStyle(fontSize: 12.5, color: AppColors.ink, height: 1.6)),
          ],
        ),
      ),
    );
  }

  Widget _buildResultPanel(Map<String, dynamic> r, Map<String, dynamic>? meta) {
    final riskLevel = (r['risk_level'] as String? ?? 'sedang').toLowerCase();
    final confLevel = (r['confidence'] as String? ?? 'sedang').toLowerCase();
    final riskCol   = _riskColors[riskLevel]   ?? AppColors.amber;
    final confCol   = _riskColors[confLevel]    ?? AppColors.amber;

    final dataSrc = meta?['data_sources'] as Map? ?? {};

    return Column(
      children: [
        // Header
        Container(
          padding: const EdgeInsets.all(12),
          color: AppColors.navy,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Analisis AI — ${(meta?['provider'] as String? ?? '—').toUpperCase()} · ${(meta?['mode'] as String? ?? '').replaceAll('_', ' ')}',
                      style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w700),
                    ),
                  ),
                  _levelBadge(riskLevel, riskCol, _riskBgColors[riskLevel] ?? AppColors.amberSoft),
                  const SizedBox(width: 8),
                  _levelBadge(confLevel, confCol, AppColors.surface),
                ],
              ),
              const SizedBox(height: 8),
              // Data source chips
              Wrap(
                spacing: 5,
                runSpacing: 4,
                children: [
                  _srcChip('Monitor',    (dataSrc['recent_segments'] ?? 0) > 0),
                  _srcChip('Baseline',   dataSrc['has_baseline'] == true),
                  _srcChip('State Log',  (dataSrc['state_log_entries'] ?? 0) > 0),
                  _srcChip('Episodes',   (dataSrc['episode_history'] ?? 0) > 0),
                  _srcChip('Experience', dataSrc['has_experience'] == true),
                  _srcChip('Prediksi',   dataSrc['has_forecast'] == true),
                ],
              ),
            ],
          ),
        ),

        // Tab bar
        TabBar(
          controller: _tabController,
          labelColor: AppColors.teal,
          unselectedLabelColor: AppColors.gray,
          indicatorColor: AppColors.teal,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 10.5),
          tabs: _tabs.map((t) => Tab(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(t['icon'] as IconData, size: 13),
                const SizedBox(width: 5),
                Text(t['label'] as String),
              ],
            ),
          )).toList(),
        ),

        // Tab views
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _buildPatientTab(r),
              _buildTextTab(r['monitoring_insight'], Icons.wifi_tethering_rounded, AppColors.blue, 'Monitoring Real-Time [LOG 1]'),
              _buildTextTab(r['baseline_evaluation'], Icons.bar_chart_rounded, AppColors.teal, 'Baseline Personal [LOG 2]'),
              _buildTextTab(r['state_transition_explanation'], Icons.timeline_rounded, AppColors.purple, 'State Timeline FSM [LOG 3]'),
              _buildTextTab(r['episode_history_pattern'], Icons.waves_rounded, AppColors.amber, 'Episode List History [LOG 4]'),
              _buildTextTab(r['experience_insight'], Icons.psychology_rounded, AppColors.green, 'Experience Memory [LOG 5]'),
              _buildTextTab(r['prediction_interpretation'], Icons.track_changes_rounded, AppColors.red, 'Prediksi Markov [LOG 6]'),
              _buildClinicalTab(r),
            ],
          ),
        ),
      ],
    );
  }

  Widget _levelBadge(String label, Color textColor, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: textColor.withValues(alpha: 0.4)),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(color: textColor, fontSize: 9.5, fontWeight: FontWeight.w800),
      ),
    );
  }

  Widget _srcChip(String label, bool active) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: active ? AppColors.teal.withValues(alpha: 0.15) : Colors.white.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: active ? AppColors.teal.withValues(alpha: 0.5) : Colors.white.withValues(alpha: 0.1)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(active ? Icons.check_circle_rounded : Icons.cancel_rounded,
              size: 9, color: active ? AppColors.teal : const Color(0xFF8FB6C4)),
          const SizedBox(width: 3),
          Text(label, style: TextStyle(
              fontSize: 9,
              color: active ? AppColors.teal : const Color(0xFF8FB6C4),
              fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _buildPatientTab(Map<String, dynamic> r) {
    final riskLevel = (r['risk_level'] as String? ?? 'sedang').toLowerCase();
    final riskCol   = _riskColors[riskLevel] ?? AppColors.amber;
    final riskBg    = _riskBgColors[riskLevel] ?? AppColors.amberSoft;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFFE4F3F3), Color(0xFFF0FAF5)]),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.teal.withValues(alpha: 0.5)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Icon(Icons.person_heart_rounded, color: AppColors.teal, size: 18),
                  const SizedBox(width: 8),
                  Text('Ringkasan untuk Pasien', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: AppColors.teal)),
                ]),
                const SizedBox(height: 12),
                Text(r['patient_summary'] as String? ?? '—',
                    style: TextStyle(fontSize: 13.5, color: AppColors.ink, height: 1.75)),
              ],
            ),
          ),
          if ((r['risk_reason'] as String? ?? '').isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: riskBg,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: riskCol.withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  Icon(Icons.warning_rounded, color: riskCol, size: 15),
                  const SizedBox(width: 8),
                  Expanded(child: Text(r['risk_reason'] as String? ?? '',
                      style: TextStyle(fontSize: 12, color: riskCol, fontWeight: FontWeight.w600))),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTextTab(dynamic text, IconData icon, Color color, String title) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(icon, color: color, size: 16),
              const SizedBox(width: 8),
              Expanded(child: Text(title, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5, color: color))),
            ]),
            const SizedBox(height: 12),
            Container(
              width: double.infinity, height: 2.5,
              decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(2)),
            ),
            const SizedBox(height: 12),
            Text(
              text as String? ?? 'Data tidak tersedia.',
              style: TextStyle(fontSize: 13, color: AppColors.ink, height: 1.75),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildClinicalTab(Map<String, dynamic> r) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Icon(Icons.medical_services_rounded, color: AppColors.navy, size: 15),
                  const SizedBox(width: 7),
                  Text('Catatan Klinis (Dokter)', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: AppColors.navy)),
                ]),
                const SizedBox(height: 10),
                Text(r['clinical_notes'] as String? ?? '—',
                    style: TextStyle(fontSize: 12.5, color: AppColors.ink, height: 1.65)),
              ],
            ),
          ),
          if ((r['confidence_reason'] as String? ?? '').isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppColors.graySoft, borderRadius: BorderRadius.circular(8)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_rounded, color: AppColors.gray, size: 14),
                  const SizedBox(width: 8),
                  Expanded(child: Text(r['confidence_reason'] as String? ?? '',
                      style: TextStyle(fontSize: 11.5, color: AppColors.gray, height: 1.5))),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: jsonEncode(r)));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('JSON hasil disalin'), duration: Duration(seconds: 2)),
              );
            },
            icon: const Icon(Icons.copy_rounded, size: 14),
            label: const Text('Salin JSON Hasil'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.navy,
              textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}
