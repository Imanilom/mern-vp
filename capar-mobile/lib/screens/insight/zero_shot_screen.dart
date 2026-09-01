import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../services/api_service.dart';
import '../../theme/app_colors.dart';

// ─────────────────────────────────────────────────────────────────────────────
// ZeroShotScreen (Explain) v3 — User-Centric 360° Explain
// Profil Pasien · Portofolio Baseline & Gaps · Beban Anomali · Fenotipe Otonom
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
  List<Map<String, dynamic>> _participants = [];
  Map<String, dynamic>? _selectedParticipant;
  List<Map<String, dynamic>> _episodes = [];
  String? _selectedEpisodeId;

  Map<String, dynamic>? _result;
  Map<String, dynamic>? _meta;
  Map<String, dynamic>? _profileSummary;
  bool _loading = false;
  bool _fetchingUsers = false;
  String? _error;
  late TabController _tabController;

  static const _tabs = [
    {'id': 'overview',  'label': 'Overview',  'icon': Icons.person_rounded},
    {'id': 'baseline',  'label': 'Baseline',  'icon': Icons.bar_chart_rounded},
    {'id': 'anomaly',   'label': 'Anomali',   'icon': Icons.waves_rounded},
    {'id': 'autonomic', 'label': 'Otonom',    'icon': Icons.favorite_rounded},
    {'id': 'patient',   'label': 'Pasien',    'icon': Icons.volunteer_activism_rounded},
    {'id': 'clinical',  'label': 'Klinis',    'icon': Icons.medical_services_rounded},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
    _loadParticipants();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadParticipants() async {
    setState(() => _fetchingUsers = true);
    try {
      final users = await ApiService.fetchZeroShotParticipants();
      if (mounted) {
        setState(() {
          _participants = users;
          if (users.isNotEmpty) {
            _selectedParticipant = users[0];
            _loadEpisodesForUser(users[0]['id']?.toString() ?? '');
          }
        });
      }
    } catch (e) {
      debugPrint('[Explain] load participants error: $e');
    } finally {
      if (mounted) setState(() => _fetchingUsers = false);
    }
  }

  Future<void> _loadEpisodesForUser(String userId) async {
    try {
      final eps = await ApiService.fetchZeroShotEpisodes(userId: userId);
      if (mounted) setState(() => _episodes = eps);
    } catch (e) {
      debugPrint('[Explain] load episodes error: $e');
    }
  }

  Future<void> _runAnalysis() async {
    final uid = _selectedParticipant?['id']?.toString() ?? _selectedParticipant?['_id']?.toString();
    if (uid == null || uid.isEmpty) return;

    setState(() {
      _loading = true;
      _error = null;
      _result = null;
      _meta = null;
      _profileSummary = null;
    });

    try {
      final res = await ApiService.runZeroShotAnalysis(
        userId: uid,
        episodeId: _selectedEpisodeId,
      );
      if (res != null && res['success'] == true) {
        setState(() {
          _result = res['result'] as Map<String, dynamic>?;
          _meta   = res;
          _profileSummary = res['profile_summary'] as Map<String, dynamic>?;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: _buildAppBar(),
      body: Column(
        children: [
          _buildParticipantSelector(),
          _buildAnalyzeButton(),
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
            child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 16),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Explain',
                    style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800)),
                Text('360° User-Centric Grounding & ANS Recovery',
                    style: TextStyle(color: Color(0xFF8FB6C4), fontSize: 9.5)),
              ],
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh_rounded, color: Colors.white, size: 20),
          onPressed: _fetchingUsers ? null : _loadParticipants,
        ),
      ],
    );
  }

  Widget _buildParticipantSelector() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: AppColors.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.person_search_rounded, size: 16, color: AppColors.teal),
              const SizedBox(width: 6),
              const Text('Pilih Pasien / Pengguna:', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5, color: AppColors.navy)),
            ],
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.line),
              color: AppColors.bg,
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<Map<String, dynamic>>(
                isExpanded: true,
                value: _selectedParticipant,
                hint: const Text('Pilih peserta...', style: TextStyle(fontSize: 12)),
                items: _participants.map((p) {
                  return DropdownMenuItem(
                    value: p,
                    child: Text(
                      '${p['name']} (${p['total_segments']} win, ${p['mature_baselines']}/${p['total_baselines']} base)',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                      overflow: TextOverflow.ellipsis,
                    ),
                  );
                }).toList(),
                onChanged: (p) {
                  setState(() {
                    _selectedParticipant = p;
                    _selectedEpisodeId = null;
                  });
                  if (p != null) {
                    _loadEpisodesForUser(p['id']?.toString() ?? '');
                  }
                },
              ),
            ),
          ),
          if (_episodes.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.line.withValues(alpha: 0.7)),
                color: AppColors.bg,
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  isExpanded: true,
                  value: _selectedEpisodeId,
                  hint: const Text('Fokus: Seluruh Profil Pasien (360° Rekomendasi)', style: TextStyle(fontSize: 11, color: AppColors.gray)),
                  items: [
                    const DropdownMenuItem<String>(
                      value: null,
                      child: Text('Seluruh Profil Pasien (360°)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.teal)),
                    ),
                    ..._episodes.map((ep) => DropdownMenuItem<String>(
                      value: ep['_id']?.toString(),
                      child: Text(
                        '[${ep['classification']}] ${ep['activity'] ?? 'Anomali'} - ${ep['duration_ms'] != null ? '${(ep['duration_ms'] / 60000).round()}m' : '-'}',
                        style: const TextStyle(fontSize: 11),
                        overflow: TextOverflow.ellipsis,
                      ),
                    )),
                  ],
                  onChanged: (val) => setState(() => _selectedEpisodeId = val),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAnalyzeButton() {
    final canRun = _selectedParticipant != null && !_loading;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: AppColors.surface,
      child: SizedBox(
        width: double.infinity,
        height: 42,
        child: ElevatedButton.icon(
          onPressed: canRun ? _runAnalysis : null,
          icon: _loading
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.auto_awesome_rounded, size: 16),
          label: Text(
            _loading ? 'Menganalisis Data 360°...' : 'Jalankan Explain AI (360°)',
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.teal,
            foregroundColor: Colors.white,
            disabledBackgroundColor: AppColors.gray.withValues(alpha: 0.3),
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(color: AppColors.teal),
            const SizedBox(height: 16),
            Text('Mengumpulkan portofolio baseline & beban anomali...',
                style: TextStyle(color: AppColors.navy, fontWeight: FontWeight.w700, fontSize: 13)),
            const SizedBox(height: 6),
            Text('Mengevaluasi Digital Autonomic Phenotype via LLM...',
                style: TextStyle(color: AppColors.gray, fontSize: 11)),
          ],
        ),
      );
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline_rounded, color: AppColors.red, size: 40),
              const SizedBox(height: 12),
              const Text('Analisis Gagal', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppColors.red)),
              const SizedBox(height: 8),
              Text(_error!, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: AppColors.gray)),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _runAnalysis,
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Coba Lagi'),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.teal, foregroundColor: Colors.white),
              ),
            ],
          ),
        ),
      );
    }

    if (_result == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 60, height: 60,
                decoration: BoxDecoration(color: AppColors.tealSoft, shape: BoxShape.circle),
                child: const Icon(Icons.lightbulb_rounded, color: AppColors.teal, size: 30),
              ),
              const SizedBox(height: 16),
              const Text('Explain AI — Analisis 360°',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.navy)),
              const SizedBox(height: 8),
              const Text(
                'Pilih pasien di atas dan tekan "Jalankan Explain AI (360°)" untuk menganalisis portofolio baseline, beban anomali, kepatuhan, dan fenotipe otonom secara menyeluruh.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: AppColors.gray, height: 1.5),
              ),
            ],
          ),
        ),
      );
    }

    final r = _result!;
    final riskLevel = (r['risk_level'] as String? ?? 'sedang').toLowerCase();
    final riskCol   = _riskColors[riskLevel] ?? AppColors.amber;
    final riskBg    = _riskBgColors[riskLevel] ?? AppColors.amberSoft;
    final confStr   = (r['confidence'] as String? ?? 'sedang').toLowerCase();
    final confCol   = _riskColors[confStr] ?? AppColors.teal;
    final confBg    = _riskBgColors[confStr] ?? AppColors.tealSoft;

    return Column(
      children: [
        // Summary Status Bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: const BoxDecoration(
            gradient: LinearGradient(colors: [Color(0xFF0B2545), Color(0xFF134074)]),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      'Explain 360° — ${_selectedParticipant?['name'] ?? 'User'}',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  _levelBadge(r['risk_level'] as String? ?? 'SEDANG', riskCol, riskBg),
                  const SizedBox(width: 6),
                  _levelBadge(r['confidence'] as String? ?? 'SEDANG', confCol, confBg),
                ],
              ),
              if (_profileSummary != null) ...[
                const SizedBox(height: 6),
                Text(
                  '${_profileSummary!['total_segments'] ?? 0} win data · ${_profileSummary!['mature_baselines'] ?? 0}/${_profileSummary!['total_baselines'] ?? 0} baseline mature · AB: ${(_profileSummary!['anomaly_burden_pct'] as num?)?.toStringAsFixed(1) ?? '0'}%',
                  style: const TextStyle(color: Color(0xFF8FB6C4), fontSize: 10, fontWeight: FontWeight.w600),
                ),
              ],
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
          labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11),
          tabs: _tabs.map((t) => Tab(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(t['icon'] as IconData, size: 14),
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
              _buildTextTab(r['user_profile_summary'], Icons.person_rounded, AppColors.blue, 'Profil & Pola Penggunaan Wearable'),
              _buildTextTab(r['baseline_portfolio_evaluation'], Icons.bar_chart_rounded, AppColors.teal, 'Evaluasi Portofolio Baseline & Gaps'),
              _buildTextTab(r['anomaly_burden_analysis'], Icons.waves_rounded, AppColors.amber, 'Beban Anomali & Riwayat Disregulasi'),
              _buildAutonomicTab(r),
              _buildPatientTab(r),
              _buildClinicalTab(r),
            ],
          ),
        ),
      ],
    );
  }

  Widget _levelBadge(String label, Color textColor, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bgColor.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: textColor.withValues(alpha: 0.4)),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(color: textColor, fontSize: 9, fontWeight: FontWeight.w800),
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
              Expanded(child: Text(title, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: color))),
            ]),
            const SizedBox(height: 12),
            Container(
              width: double.infinity, height: 2,
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

  Widget _buildAutonomicTab(Map<String, dynamic> r) {
    final phenotype = r['autonomic_phenotype'] as String?;
    final phenotypeExp = r['phenotype_explanation'] as String?;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (phenotype != null && phenotype.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0B2545), Color(0xFF134074)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF8DA9C4), width: 1.5),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(children: [
                        Icon(Icons.fingerprint_rounded, color: Color(0xFF64DFDF), size: 16),
                        SizedBox(width: 6),
                        Text(
                          'LEVEL 2 — DIGITAL PHENOTYPE',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white),
                        ),
                      ]),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF64DFDF).withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: const Color(0xFF64DFDF)),
                        ),
                        child: const Text('PROFILE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF64DFDF))),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(phenotype, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.white)),
                  if (phenotypeExp != null && phenotypeExp.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(phenotypeExp, style: const TextStyle(fontSize: 12, color: Color(0xFFEEF4F8), height: 1.55)),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],
          _buildTextTab(r['autonomic_recovery_analysis'], Icons.favorite_rounded, AppColors.teal, 'Respons Sistem Saraf Otonom (ANS)'),
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
                  Icon(Icons.volunteer_activism_rounded, color: AppColors.teal, size: 18),
                  const SizedBox(width: 8),
                  Text('Ringkasan 360° untuk Pasien', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: AppColors.teal)),
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

  Widget _buildClinicalTab(Map<String, dynamic> r) {
    final suspicion = r['clinical_suspicion'] as String?;
    final confirmatory = r['confirmatory_recommendations'] as String?;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (suspicion != null && suspicion.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF8E7),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFFFD54F), width: 1.5),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(children: [
                    Icon(Icons.warning_amber_rounded, color: Color(0xFFD98800), size: 16),
                    SizedBox(width: 6),
                    Text('LEVEL 3 — CLINICAL RISK STRATIFICATION', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5, color: Color(0xFFB26B00))),
                  ]),
                  const SizedBox(height: 8),
                  Text(suspicion, style: const TextStyle(fontSize: 12.5, color: Color(0xFF4A3B18), height: 1.55)),
                  const SizedBox(height: 6),
                  const Text('*Bukan diagnosis definitif penyakit jantung. Data wearable berfungsi sebagai penapisan longitudinal.', style: TextStyle(fontSize: 10.5, color: Color(0xFF8C6D1F), fontStyle: FontStyle.italic)),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (confirmatory != null && confirmatory.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF0F9FF),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF7DD3FC), width: 1.5),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(children: [
                    Icon(Icons.medical_services_rounded, color: Color(0xFF0284C7), size: 16),
                    SizedBox(width: 6),
                    Text('REKOMENDASI UJI KONFIRMASI KLINIS', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11.5, color: Color(0xFF0369A1))),
                  ]),
                  const SizedBox(height: 8),
                  Text(confirmatory, style: const TextStyle(fontSize: 12.5, color: Color(0xFF0C4A6E), height: 1.55)),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
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
                  Icon(Icons.notes_rounded, color: AppColors.navy, size: 15),
                  const SizedBox(width: 7),
                  Text('Catatan Komprehensif Dokter / Peneliti', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: AppColors.navy)),
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
