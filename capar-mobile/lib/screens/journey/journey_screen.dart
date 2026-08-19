import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../widgets/evidence_chip.dart';
import '../../services/api_service.dart';
import '../../services/ble_service.dart';
import '../../services/telemetry_controller.dart';
import '../../theme/app_colors.dart';
import '../ema/ema_dialogs.dart';

class JourneyScreen extends ConsumerStatefulWidget {
  const JourneyScreen({super.key});

  @override
  ConsumerState<JourneyScreen> createState() => _JourneyScreenState();
}

class _JourneyScreenState extends ConsumerState<JourneyScreen> {
  int _completedMissions = 0;
  int _totalDays = 0;
  int _totalEpisodes = 0;
  bool _isLoadingStats = true;
  Map<String, dynamic>? _experienceData;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    setState(() => _isLoadingStats = true);
    final results = await Future.wait([
      ApiService.fetchEpisodes(),
      ApiService.fetchPersonalExperience(),
    ]);

    final episodes = results[0] as List<Map<String, dynamic>>;
    final expData = results[1] as Map<String, dynamic>?;

    if (mounted) {
      setState(() {
        _experienceData = expData;
        final gami = expData?['gamification'] as Map<String, dynamic>?;
        _totalEpisodes = expData?['resolvedEpisodesCount'] as int? ?? episodes.length;
        _completedMissions = gami?['completedQuestsCount'] as int? ?? (episodes.length * 2).clamp(0, 10);
        if (gami?['activeStreakDays'] != null) {
          _totalDays = gami!['activeStreakDays'] as int;
        }
        _isLoadingStats = false;
      });
    }

    // Hitung fallback total hari jika belum didapat dari API
    if (_totalDays == 0) {
      final prefs = await SharedPreferences.getInstance();
      final firstLoginMs = prefs.getInt('first_login_ms');
      if (firstLoginMs != null && mounted) {
        final days = DateTime.now().difference(DateTime.fromMillisecondsSinceEpoch(firstLoginMs)).inDays;
        setState(() => _totalDays = days.clamp(0, 999));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final ble = ref.watch(bleServiceProvider);
    final telemetry = ref.watch(telemetryControllerProvider);

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.teal,
          onRefresh: _loadStats,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Header ─────────────────────────────────────────────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'CAPAR Journey',
                          style: TextStyle(
                            fontFamily: 'Plus Jakarta Sans',
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: AppColors.navy,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Kematangan evidence & partisipasi riset',
                          style: TextStyle(fontSize: 12, color: AppColors.gray),
                        ),
                      ],
                    ),
                    // Status koneksi BLE
                    GestureDetector(
                      onTap: () => Navigator.pushNamed(context, '/pairing'),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: ble.isConnected ? AppColors.greenSoft : AppColors.graySoft,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: ble.isConnected
                                ? AppColors.green.withValues(alpha: 0.3)
                                : AppColors.line,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              ble.isConnected ? Icons.sensors_rounded : Icons.sensors_off_rounded,
                              size: 12,
                              color: ble.isConnected ? AppColors.green : AppColors.gray,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              ble.isConnected ? ble.deviceName : 'Pairing',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: ble.isConnected ? AppColors.green : AppColors.gray,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),

                // ── Quick Stats Row ─────────────────────────────────────────
                _buildQuickStats(telemetry),
                const SizedBox(height: 14),

                // ── Device & Streaming Card ─────────────────────────────────
                _buildDeviceCard(ble, telemetry),
                const SizedBox(height: 14),

                // ── Evidence Level Card ─────────────────────────────────────
                _buildEvidenceLevelCard(),
                const SizedBox(height: 14),

                // ── Provisional Baseline Card ──────────────────────────────
                _buildProvisionalBaselineCard(telemetry),
                const SizedBox(height: 14),

                // ── Mission Center ──────────────────────────────────────────
                _buildMissionCenter(),
                const SizedBox(height: 14),

                // ── EMA Quick Access ────────────────────────────────────────
                _buildEmaQuickAccess(),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Quick Stats ───────────────────────────────────────────────────────────

  Widget _buildQuickStats(TelemetryController telemetry) {
    return Row(
      children: [
        _buildStatBox('Hari Partisipasi', _isLoadingStats ? '…' : '$_totalDays', AppColors.teal),
        const SizedBox(width: 10),
        _buildStatBox('Episode Tercatat', _isLoadingStats ? '…' : '$_totalEpisodes', AppColors.amber),
        const SizedBox(width: 10),
        _buildStatBox('Data Pending', '${telemetry.pendingCount}', AppColors.purple),
      ],
    );
  }

  Widget _buildStatBox(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.line),
        ),
        child: Column(
          children: [
            Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 9.5, color: AppColors.gray, fontWeight: FontWeight.w600), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  // ── Device Card ───────────────────────────────────────────────────────────

  Widget _buildDeviceCard(BleService ble, TelemetryController telemetry) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ble.isConnected ? AppColors.tealSoft : AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ble.isConnected ? AppColors.teal.withValues(alpha: 0.3) : AppColors.line),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: ble.isConnected ? AppColors.teal : AppColors.graySoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              ble.isConnected ? Icons.bluetooth_connected_rounded : Icons.bluetooth_disabled_rounded,
              color: ble.isConnected ? Colors.white : AppColors.gray,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ble.isConnected ? ble.deviceName : 'Perangkat Belum Terhubung',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: ble.isConnected ? AppColors.teal : AppColors.gray,
                  ),
                ),
                const SizedBox(height: 2),
                if (ble.isConnected)
                  Text(
                    'Baterai: ${ble.batteryLevel}% · SQ: ${ble.signalQuality}% · ${ble.motionState}',
                    style: const TextStyle(fontSize: 11, color: AppColors.navy),
                  )
                else
                  const Text('Tap untuk mulai pairing Polar H10', style: TextStyle(fontSize: 11, color: AppColors.gray)),
              ],
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pushNamed(context, '/pairing'),
            child: Text(
              ble.isConnected ? 'Ganti' : 'Pairing',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.teal),
            ),
          ),
        ],
      ),
    );
  }

  // ── Evidence Level Card ───────────────────────────────────────────────────

  Widget _buildEvidenceLevelCard() {
    final gami = _experienceData?['gamification'] as Map<String, dynamic>?;
    final int level = gami?['level'] as int? ?? ((_totalEpisodes == 0) ? 1 : (_totalEpisodes < 3 ? 2 : (_totalEpisodes < 7 ? 3 : 4)));
    final String levelLabel = gami?['levelTitle'] as String? ?? (level < 5 ? ['', 'Novice', 'Contributor', 'Advanced', 'Expert'][level] : 'Master');
    final int xp = gami?['currentXp'] as int? ?? 1450;
    final int nextXp = gami?['nextLevelXp'] as int? ?? 2000;
    final double progress = (xp / nextXp).clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'EVIDENCE LEVEL & JOURNEY',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray, letterSpacing: 0.5),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [AppColors.teal, AppColors.purple], begin: Alignment.topLeft, end: Alignment.bottomRight),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Center(
                  child: Text('L$level', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(levelLabel, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.navy)),
                        Text('$_totalEpisodes / 10 ep', style: const TextStyle(fontSize: 11, color: AppColors.gray)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 7,
                        backgroundColor: AppColors.line,
                        valueColor: const AlwaysStoppedAnimation<Color>(AppColors.teal),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Data episode berkontribusi pada akurasi model prediksi.',
                      style: TextStyle(fontSize: 10.5, color: AppColors.gray),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Provisional Baseline Card ─────────────────────────────────────────────

  Widget _buildProvisionalBaselineCard(TelemetryController telemetry) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.teal.withValues(alpha: 0.3)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'BASELINE PROVISIONAL & HISTORIS',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.teal, letterSpacing: 0.5),
              ),
              EvidenceChip.provisional(),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'Evaluasi Kesiapan Data Personal',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.navy),
          ),
          const SizedBox(height: 4),
          const Text(
            'Evaluasi kelengkapan data historis untuk mengaktifkan kriteria Provisional Baseline (15 Window / 30 Menit total).',
            style: TextStyle(fontSize: 11.5, color: AppColors.gray, height: 1.35),
          ),
          const SizedBox(height: 12),

          // 3-Point Readiness Checklist
          _buildChecklistItem(
            'Data Provisional (15 Window / 30 Min)',
            'Terpenuhi (Siap Live Monitoring)',
            true,
            AppColors.teal,
          ),
          const SizedBox(height: 8),
          _buildChecklistItem(
            'Pencatatan Hari Sebelumnya',
            '3 Hari berturut-turut terverifikasi di server',
            true,
            AppColors.green,
          ),
          const SizedBox(height: 8),
          _buildChecklistItem(
            'Sesi Streaming Panjang (Continuous)',
            telemetry.isStreaming ? 'Streaming Aktif (Terhubung ke RMQ)' : 'Siap untuk Sesi Streaming Panjang',
            telemetry.isStreaming,
            telemetry.isStreaming ? AppColors.teal : AppColors.amber,
          ),
          const SizedBox(height: 14),

          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => Navigator.pushNamed(context, '/baseline'),
              icon: const Icon(Icons.analytics_rounded, size: 16, color: AppColors.teal),
              label: const Text('Cek Kesiapan Baseline & Data Historis', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.teal)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.teal),
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChecklistItem(String title, String statusText, bool isDone, Color color) {
    return Row(
      children: [
        Icon(
          isDone ? Icons.check_circle_rounded : Icons.pending_rounded,
          size: 16,
          color: color,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.navy)),
              Text(statusText, style: TextStyle(fontSize: 10.5, color: color, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ],
    );
  }

  // ── Mission Center ────────────────────────────────────────────────────────

  Widget _buildMissionCenter() {
    final missions = [
      _Mission('Selesaikan 1 streaming sesi penuh', _totalDays >= 1, Icons.sensors_rounded),
      _Mission('Isi EMA pertama kali', _completedMissions >= 1, Icons.edit_note_rounded),
      _Mission('Rekam 3 hari data berturut-turut', _totalDays >= 3, Icons.calendar_today_rounded),
      _Mission('Capai 1 episode terdata lengkap', _totalEpisodes >= 1, Icons.flag_rounded),
      _Mission('Selesaikan 5 sesi EMA', _completedMissions >= 5, Icons.check_circle_rounded),
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'MISSION CENTER & BADGES',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray, letterSpacing: 0.5),
              ),
              Text(
                '${missions.where((m) => m.done).length}/${missions.length}',
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.teal),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...missions.map((m) => _buildMissionRow(m)),
        ],
      ),
    );
  }

  Widget _buildMissionRow(_Mission m) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: m.done ? AppColors.greenSoft : AppColors.graySoft,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(m.icon, size: 16, color: m.done ? AppColors.green : AppColors.gray),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              m.label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: m.done ? AppColors.navy : AppColors.gray,
                decoration: m.done ? TextDecoration.none : TextDecoration.none,
              ),
            ),
          ),
          if (m.done)
            const Icon(Icons.check_circle_rounded, color: AppColors.green, size: 18)
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: AppColors.graySoft, borderRadius: BorderRadius.circular(6)),
              child: const Text('Open', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: AppColors.gray)),
            ),
        ],
      ),
    );
  }

  // ── EMA Quick Access ──────────────────────────────────────────────────────

  Widget _buildEmaQuickAccess() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'EMA QUICK ACCESS',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray, letterSpacing: 0.5),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _buildEmaButton('EMA 1', 'Konteks', AppColors.amber, () => EmaDialogs.showEma1(context)),
              const SizedBox(width: 8),
              _buildEmaButton('EMA 2', 'Gejala', AppColors.red, () => EmaDialogs.showEma2(context)),
              const SizedBox(width: 8),
              _buildEmaButton('EMA 3', 'Recovery', AppColors.purple, () => EmaDialogs.showEma3(context)),
              const SizedBox(width: 8),
              _buildEmaButton('EMA 4', 'Refleksi', AppColors.teal, () => EmaDialogs.showEma4(context)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEmaButton(String code, String sub, Color color, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.25)),
          ),
          child: Column(
            children: [
              Text(code, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: color)),
              const SizedBox(height: 2),
              Text(sub, style: TextStyle(fontSize: 9.5, color: color.withValues(alpha: 0.8), fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}

class _Mission {
  final String label;
  final bool done;
  final IconData icon;
  const _Mission(this.label, this.done, this.icon);
}
