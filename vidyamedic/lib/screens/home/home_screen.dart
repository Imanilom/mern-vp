import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';
import 'pedagogy_detail_sheet.dart';
import '../pedagogy/pedagogy_screen_where_am_i.dart';
import '../pedagogy/pedagogy_screen_what_changed.dart';
import '../pedagogy/pedagogy_screen_why.dart';
import '../pedagogy/pedagogy_screen_recovery.dart';
import '../pedagogy/pedagogy_screen_action.dart';
import '../pedagogy/patient_journey_screen.dart';
import '../input/guided_daily_flow_screen.dart';
import '../input/symptom_input_screen.dart';
import '../input/activity_input_screen.dart';
import '../input/sleep_input_screen.dart';
import '../input/manual_measurement_screen.dart';
import '../input/event_marker_screen.dart';
import '../input/free_note_screen.dart';
import '../summary/daily_summary_screen.dart';
import '../profile/profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  AppState? _observedAppState;
  bool _movementDialogVisible = false;
  bool _deviationDialogVisible = false;
  String? _queuedDeviationSegmentId;
  bool _noDataDialogVisible = false;
  bool _noDataDialogHandled = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final appState = context.read<AppState>();
    if (!identical(_observedAppState, appState)) {
      _observedAppState?.removeListener(_onAppStateChanged);
      _observedAppState = appState..addListener(_onAppStateChanged);
    }
    _queueNoDataPrompt();
    _queueMovementPrompt();
    _queueDeviationPrompt();
  }

  @override
  void dispose() {
    _observedAppState?.removeListener(_onAppStateChanged);
    super.dispose();
  }

  void _onAppStateChanged() {
    _queueNoDataPrompt();
    _queueMovementPrompt();
    _queueDeviationPrompt();
  }

  void _queueDeviationPrompt() {
    final appState = _observedAppState;
    final prompt = appState?.followUpPrompt;
    final segmentId = prompt?.segmentId;
    if (!mounted ||
        _currentIndex != 0 ||
        appState == null ||
        prompt?.status != 'requested' ||
        segmentId == null ||
        _deviationDialogVisible ||
        _queuedDeviationSegmentId == segmentId ||
        !appState.markFollowUpPromptShown(segmentId)) {
      return;
    }
    _queuedDeviationSegmentId = segmentId;
    _deviationDialogVisible = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted || _currentIndex != 0) {
        _deviationDialogVisible = false;
        return;
      }
      final followUp = appState.followUpPrompt;
      final action = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Pola pribadi menyimpang'),
          content: ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 420),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    followUp.message ??
                        'CAPAR menemukan perubahan terhadap baseline pribadi. Mohon isi konteks agar sistem dapat membandingkan kondisi pada awal deviasi hingga puncaknya.',
                  ),
                  const SizedBox(height: 12),
                  if (followUp.onsetTime != null)
                    Text('Onset: ${_formatDateTime(followUp.onsetTime!)}'),
                  if (followUp.peakTime != null)
                    Text('Puncak: ${_formatDateTime(followUp.peakTime!)}'),
                  if (followUp.deviationDistance != null)
                    Text(
                      'Jarak dari baseline: ${followUp.deviationDistance!.toStringAsFixed(2)}',
                    ),
                  if (followUp.mainFactors.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Kontributor fitur terbesar: ${_factorLabel(followUp.mainFactors.first)}',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ],
                  if (followUp.referenceThresholds != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Ambang referensi CAPAR: ${followUp.referenceThresholds}',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ],
                  const SizedBox(height: 10),
                  const Text(
                    'Angka ini adalah pembanding statistik terhadap baseline Anda, bukan ambang klinis atau diagnosis. Konteks yang Anda isi adalah laporan pribadi, bukan bukti penyebab.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Isi konteks deviasi'),
            ),
          ],
        ),
      );
      _deviationDialogVisible = false;
      if (!mounted || action != true) return;
      await Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const WhatChangedScreen()),
      );
    });
  }

  String _formatDateTime(DateTime value) =>
      MaterialLocalizations.of(context).formatFullDate(value.toLocal()) +
      ' ' +
      MaterialLocalizations.of(context).formatTimeOfDay(
        TimeOfDay.fromDateTime(value.toLocal()),
      );

  String _factorLabel(Map<String, dynamic> factor) {
    final label = factor['label'] ?? factor['feature'] ?? factor['key'] ?? 'Fitur';
    final contribution =
        factor['contribution_pct'] ?? factor['contribution'] ?? factor['share'];
    return contribution == null ? '$label' : '$label ($contribution)';
  }

  void _queueNoDataPrompt() {
    final appState = _observedAppState;
    if (!mounted ||
        _currentIndex != 0 ||
        appState == null ||
        appState.isRefreshing ||
        appState.dataError != null ||
        appState.wearable.hasServerSamples ||
        appState.hasCaparMetrics ||
        _noDataDialogVisible ||
        _noDataDialogHandled) {
      return;
    }
    _noDataDialogVisible = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted || _currentIndex != 0) {
        _noDataDialogVisible = false;
        return;
      }
      _noDataDialogHandled = true;
      final choice = await showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Data kesehatan belum tersedia'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Data wearable/CAPAR belum cukup untuk menilai kondisi personal atau tingkat stres Anda. Ini bukan berarti kondisi Anda normal. Anda tetap dapat mencatat kondisi dan menggunakan aplikasi.',
              ),
              const SizedBox(height: 8),
              const Text(
                'Pertanyaan keselamatan ini adalah panduan umum NON-KLINIS / PLACEHOLDER, bukan diagnosis. Jangan menunggu aplikasi jika Anda merasa membutuhkan pertolongan segera.',
                style: TextStyle(fontSize: 12, color: Color(0xFF78350F)),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFFCA5A5)),
                ),
                child: const Text(
                  'Apakah saat ini Anda mengalami nyeri dada berat, sesak napas berat, pingsan, atau kondisi yang memburuk dengan cepat?',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, 'continue'),
              child: const Text('Lanjutkan penggunaan'),
            ),
            OutlinedButton(
              onPressed: () => Navigator.pop(dialogContext, 'check_in'),
              child: const Text('Catat gejala/kondisi'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.statusRed,
              ),
              onPressed: () => Navigator.pop(dialogContext, 'emergency'),
              child: const Text('Ya, ada tanda bahaya'),
            ),
          ],
        ),
      );
      _noDataDialogVisible = false;
      if (!mounted) return;
      if (choice == 'check_in') {
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => const GuidedDailyFlowScreen(initialStep: 6),
          ),
        );
      } else if (choice == 'emergency') {
        await showDialog<void>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: const Text('Segera cari pertolongan'),
            content: const Text(
              'Jangan menunggu data wearable atau hasil analisis aplikasi. Hubungi layanan darurat setempat atau minta orang terdekat mengantar Anda ke IGD sekarang.',
            ),
            actions: [
              ElevatedButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Mengerti'),
              ),
            ],
          ),
        );
      }
    });
  }

  void _queueMovementPrompt() {
    final appState = _observedAppState;
    if (!mounted ||
        _currentIndex != 0 ||
        appState == null ||
        appState.followUpPrompt.status == 'requested' ||
        !appState.showActivityMovementPrompt ||
        _movementDialogVisible) {
      return;
    }
    _movementDialogVisible = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted || _currentIndex != 0) {
        _movementDialogVisible = false;
        return;
      }
      final selectedActivity = await showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Terdeteksi perubahan gerak'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Pola akselerometer menyerupai ${appState.suggestedActivity.toLowerCase()}. Apakah Anda sedang ${appState.suggestedActivity.toLowerCase()}? Ini perkiraan sensor; konfirmasi Anda yang menentukan.',
              ),
              const SizedBox(height: 8),
              Text(
                'Aturan non-klinis: resultan √(x²+y²+z²), lalu delta terhadap rerata lokal; sumbu tidak dinormalisasi. Minimal ${ActivityMotionPolicy.demo.minimumSampleSeconds.toStringAsFixed(0)} detik, cadence ${ActivityMotionPolicy.demo.minimumCadenceHz.toStringAsFixed(1)}–${ActivityMotionPolicy.demo.maximumCadenceHz.toStringAsFixed(1)} Hz, berlari mulai ${ActivityMotionPolicy.demo.runningCadenceHz.toStringAsFixed(1)} Hz, prominence ≥${ActivityMotionPolicy.demo.minimumPeakProminenceG.toStringAsFixed(2)} g, variasi interval ≤${(ActivityMotionPolicy.demo.maximumIntervalVariation * 100).round()}%.',
                style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
              ),
              if (appState.movementAnalysis != null) ...[
                const SizedBox(height: 6),
                Text(
                  'Terukur: ${appState.movementAnalysis!.cadenceHz.toStringAsFixed(2)} Hz; ${appState.movementAnalysis!.peakCount} puncak; RMS delta resultan ${appState.movementAnalysis!.rmsDeltaMagnitudeG.toStringAsFixed(3)} g.',
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                ),
              ],
              const SizedBox(height: 10),
              ...kActivities
                  .where((item) => item.$1 != 'Duduk' && item.$1 != 'Istirahat')
                  .map(
                    (item) => ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(item.$2, color: AppTheme.primary),
                      title: Text(item.$1),
                      onTap: () => Navigator.pop(dialogContext, item.$1),
                    ),
                  ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () =>
                  Navigator.pop(dialogContext, '__keep_activity__'),
              child: Text('Saya tetap ${appState.activity.toLowerCase()}'),
            ),
          ],
        ),
      );
      _movementDialogVisible = false;
      if (!mounted) return;
      if (selectedActivity == null || selectedActivity == '__keep_activity__') {
        appState.dismissActivityMovementPrompt();
        return;
      }
      final saved = await appState.confirmActivityTransition(selectedActivity);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(saved
              ? 'Aktivitas $selectedActivity dikonfirmasi dan tersimpan.'
              : appState.dataError ?? 'Aktivitas gagal disimpan.'),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      _PedagogyDashboard(
          onNavigateToInput: () => setState(() => _currentIndex = 1)),
      const _InputFlowTab(),
      const DailySummaryScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF6F9F8),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Container(
            color: AppTheme.background,
            child: Scaffold(
              body: pages[_currentIndex],
              bottomNavigationBar: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(
                      top: BorderSide(color: AppTheme.borderLight, width: 1)),
                  boxShadow: [
                    BoxShadow(
                      color: Color(0x0A0B7A5A),
                      blurRadius: 16,
                      offset: Offset(0, -4),
                    ),
                  ],
                ),
                child: SafeArea(
                  child: NavigationBar(
                    selectedIndex: _currentIndex,
                    onDestinationSelected: (idx) {
                      setState(() => _currentIndex = idx);
                      _queueMovementPrompt();
                      if (idx == 0) _queueDeviationPrompt();
                    },
                    backgroundColor: Colors.white,
                    indicatorColor: AppTheme.primarySoft,
                    elevation: 0,
                    height: 65,
                    labelBehavior:
                        NavigationDestinationLabelBehavior.alwaysShow,
                    destinations: const [
                      NavigationDestination(
                        icon: Icon(Icons.favorite_border_rounded, size: 22),
                        selectedIcon: Icon(Icons.favorite_rounded,
                            color: AppTheme.primary, size: 23),
                        label: 'Beranda',
                      ),
                      NavigationDestination(
                        icon: Icon(Icons.edit_note_outlined, size: 24),
                        selectedIcon: Icon(Icons.edit_note_rounded,
                            color: AppTheme.primary, size: 25),
                        label: 'Catat Harian',
                      ),
                      NavigationDestination(
                        icon: Icon(Icons.assessment_outlined, size: 22),
                        selectedIcon: Icon(Icons.assessment_rounded,
                            color: AppTheme.primary, size: 23),
                        label: 'Ringkasan',
                      ),
                      NavigationDestination(
                        icon: Icon(Icons.person_outline_rounded, size: 22),
                        selectedIcon: Icon(Icons.person_rounded,
                            color: AppTheme.primary, size: 23),
                        label: 'Profil',
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 0: Dashboard Utama (Pemantauan Personal Ramah Pasien)
// ---------------------------------------------------------------------------
class _PedagogyDashboard extends StatelessWidget {
  final VoidCallback onNavigateToInput;
  const _PedagogyDashboard({required this.onNavigateToInput});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final triage = s.triageLevel;
    final w = s.wearable;
    final caparStatus =
        (s.rawCaparInsights?['capar'] as Map<String, dynamic>?)?['status'];

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Text(
                  'VidyaMedic',
                  style: AppTheme.font(
                      size: 18.5,
                      weight: FontWeight.w800,
                      color: AppTheme.primaryDark,
                      letterSpacing: -0.3),
                ),
                const SizedBox(width: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppTheme.primarySoft,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text('Kesehatan Personal',
                      style: AppTheme.font(
                          size: 9.5,
                          weight: FontWeight.w800,
                          color: AppTheme.primaryDark)),
                ),
              ],
            ),
            const SizedBox(height: 1),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                PulsingStatusDot(
                  size: 6,
                  color: w.hasServerSamples || s.hasCaparRecords
                      ? AppTheme.statusGreen
                      : AppTheme.textMuted,
                ),
                const SizedBox(width: 5),
                Text(
                  w.hasServerSamples
                      ? 'Sampel wearable dari server • ${w.deviceName}'
                      : s.hasCaparRecords
                          ? 'Riwayat CAPAR tersedia dari server'
                          : 'Belum ada data wearable dari server',
                  style: AppTheme.font(
                      size: 11,
                      color: AppTheme.textSecondary,
                      weight: FontWeight.w500),
                ),
              ],
            ),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 12),
            decoration: const BoxDecoration(
              color: AppTheme.primarySoft,
              shape: BoxShape.circle,
            ),
            child: IconButton(
              icon: const Icon(Icons.sync_rounded,
                  color: AppTheme.primary, size: 20),
              tooltip: 'Sinkronkan Sensor & Data',
              onPressed: () async {
                final synced = await s.syncWearable();
                if (context.mounted) {
                  if (!synced) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                          content: Text(s.dataError ?? 'Sinkronisasi gagal.')),
                    );
                  } else if (s.wearableSamples.isEmpty && !s.hasCaparRecords) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                          content: Text(s.dataError ??
                              'Belum ada sampel wearable tersimpan di server.')),
                    );
                  } else if (s.wearableSamples.isEmpty) {
                    showSaved(context, 'Riwayat CAPAR diperbarui dari server');
                  } else {
                    showSaved(context,
                        'Sampel wearable dan analisis diperbarui dari server');
                  }
                }
              },
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => s.refreshAllData(),
        color: AppTheme.primary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics()),
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. User Greeting & Date Banner
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.borderLight),
                  boxShadow: AppTheme.shadowSoft,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            decoration: const BoxDecoration(
                              gradient: AppTheme.primaryGradient,
                              shape: BoxShape.circle,
                            ),
                            child: Center(
                              child: Text(
                                s.userProfile.name.isNotEmpty
                                    ? s.userProfile.name
                                        .substring(0, 1)
                                        .toUpperCase()
                                    : 'U',
                                style: AppTheme.font(
                                    size: 14.5,
                                    weight: FontWeight.w800,
                                    color: Colors.white),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Halo, ${s.userProfile.name} 👋',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTheme.font(
                                      size: 13.5,
                                      weight: FontWeight.w800,
                                      color: AppTheme.textPrimary),
                                ),
                                DateLine(date: s.logDate),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.statusGreenBg,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                            color:
                                AppTheme.statusGreen.withValues(alpha: 0.35)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          PulsingStatusDot(
                            size: 6,
                            color: w.hasServerSamples || s.hasCaparRecords
                                ? AppTheme.statusGreen
                                : AppTheme.textMuted,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            w.hasServerSamples
                                ? 'Data server tersedia'
                                : s.hasCaparRecords
                                    ? 'Riwayat CAPAR tersedia'
                                    : 'Belum ada data',
                            style: AppTheme.font(
                              size: 10.5,
                              weight: FontWeight.w700,
                              color: w.hasServerSamples || s.hasCaparRecords
                                  ? AppTheme.statusGreen
                                  : AppTheme.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              if (caparStatus == 'link_required') ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppTheme.statusOrange.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: AppTheme.statusOrange.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Text(
                    'Akun CAPAR lama belum tertaut, jadi baseline, segment, dan episode belum bisa ditampilkan. Buka Profil → Tautkan Akun CAPAR dan verifikasi dengan kata sandi akun pasien lama.',
                    style: AppTheme.font(
                      size: 12,
                      color: AppTheme.textPrimary,
                      height: 1.4,
                    ),
                  ),
                ),
              ],

              // ACC Sudden Movement Alert Banner (Duduk -> Pergerakan ACC)
              if (s.showActivityMovementPrompt) ...[
                const SizedBox(height: 12),
                _AccMovementAlertBanner(
                  currentActivity: s.activity,
                  suggestedActivity: s.suggestedActivity,
                  analysis: s.movementAnalysis,
                  onConfirm: () =>
                      s.confirmActivityTransition(s.suggestedActivity),
                  onDismiss: () => s.dismissActivityMovementPrompt(),
                  onSelectOther: () => _showActivitySelectionModal(context, s),
                ),
              ],

              const SizedBox(height: 14),

              // 2. Realtime Physiological Metrics Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0D5C43), Color(0xFF147A5A)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF0B7A5A).withValues(alpha: 0.3),
                      blurRadius: 14,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(Icons.favorite,
                                      color: AppTheme.faceRed, size: 20),
                                  const SizedBox(width: 6),
                                  Text(
                                    'Detak Jantung',
                                    style: AppTheme.font(
                                        size: 13,
                                        color: Colors.white
                                            .withValues(alpha: 0.85),
                                        weight: FontWeight.w600),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.baseline,
                                textBaseline: TextBaseline.alphabetic,
                                children: [
                                  Text(
                                    w.heartRate > 0 ? '${w.heartRate}' : '—',
                                    style: AppTheme.font(
                                        size: 38,
                                        weight: FontWeight.w900,
                                        color: Colors.white,
                                        height: 1.0),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    'bpm',
                                    style: AppTheme.font(
                                        size: 14,
                                        color: Colors.white70,
                                        weight: FontWeight.w600),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                s.hasCaparMetrics
                                    ? 'Deviasi personal: ${s.latestCaparMahalanobis?['distance'] ?? '—'}'
                                    : 'Analisis baseline personal belum tersedia',
                                style: AppTheme.font(
                                    size: 11,
                                    color: Colors.white.withValues(alpha: 0.9)),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          width: 1,
                          height: 100,
                          color: Colors.white.withValues(alpha: 0.18),
                          margin: const EdgeInsets.symmetric(horizontal: 10),
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      w.hasServerSamples
                                          ? w.deviceName
                                          : 'Wearable belum tersedia',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppTheme.font(
                                          size: 13.5,
                                          weight: FontWeight.w800,
                                          color: Colors.white),
                                    ),
                                  ),
                                ],
                              ),
                              Text(
                                  'Tersinkron: ${w.lastSync == null ? 'Belum tersedia' : fmtTime(TimeOfDay.fromDateTime(w.lastSync!))}',
                                  style: AppTheme.font(
                                      size: 10.5, color: Colors.white70)),
                              const SizedBox(height: 8),
                              _metricRow('Pemulihan (HRV)',
                                  w.hrvRmssd > 0 ? '${w.hrvRmssd} ms' : '—'),
                              _metricRow(
                                  w.stepsEstimatedFromAcc
                                      ? 'Perkiraan langkah (ACC)'
                                      : 'Langkah Harian',
                                  w.steps > 0 ? '${w.steps} lk' : '—'),
                              _metricRow('Kadar Oksigen (SpO₂)',
                                  w.spO2 > 0 ? '${w.spO2}%' : '—'),
                              _metricRow('Suhu Kulit',
                                  w.skinTemp > 0 ? '${w.skinTemp}°C' : '—'),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 14),

              // 3. Quick Recovery & Readiness Score Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppTheme.borderLight),
                  boxShadow: AppTheme.shadowSoft,
                ),
                child: Row(
                  children: [
                    if (s.recoveryProgress != null)
                      CircularScoreGauge(
                        score: s.recoveryProgress!,
                        size: 82,
                        subtitle: '${s.recoveryProgress!.round()}%',
                        primaryColor: AppTheme.accent,
                      )
                    else
                      const CircleAvatar(
                        radius: 41,
                        backgroundColor: AppTheme.fieldFill,
                        child: Icon(Icons.hourglass_empty_rounded,
                            color: AppTheme.textMuted),
                      ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Pemulihan berdasarkan CAPAR',
                              style: AppTheme.font(
                                  size: 13.5,
                                  weight: FontWeight.w800,
                                  color: AppTheme.textPrimary)),
                          const SizedBox(height: 3),
                          Text(
                            (s.rawCaparInsights?['capar'] as Map<String,
                                        dynamic>?)?['recovery']?['state']
                                    ?.toString() ??
                                'Data pemulihan belum tersedia dari backend.',
                            style: AppTheme.font(
                                size: 11.5,
                                color: AppTheme.textSecondary,
                                height: 1.3),
                          ),
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              if (s.hasCaparMetrics)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 7, vertical: 2.5),
                                  decoration: BoxDecoration(
                                    color: AppTheme.primarySoft,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                      s.latestCaparMahalanobis?['state']
                                              ?.toString() ??
                                          'CAPAR tersedia',
                                      style: AppTheme.font(
                                          size: 9.5,
                                          weight: FontWeight.w700,
                                          color: AppTheme.primaryDark)),
                                ),
                              Text(
                                  s.latestCaparMahalanobis == null
                                      ? 'Belum ada hasil deviasi'
                                      : 'Mahalanobis ${s.latestCaparMahalanobis?['distance'] ?? '—'}',
                                  style: AppTheme.font(
                                      size: 10,
                                      color: AppTheme.textMuted,
                                      weight: FontWeight.w600)),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 14),

              // 4. Quick Daily Action Shortcuts
              Row(
                children: [
                  Expanded(
                    child: _quickShortcutTile(
                      context,
                      label: 'Gejala',
                      icon: Icons.sick_outlined,
                      color: AppTheme.faceGreen,
                      onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const SymptomInputScreen())),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _quickShortcutTile(
                      context,
                      label: 'Aktivitas',
                      icon: Icons.directions_run_rounded,
                      color: const Color(0xFF0284C7),
                      onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const ActivityInputScreen())),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _quickShortcutTile(
                      context,
                      label: 'Tidur',
                      icon: Icons.bedtime_outlined,
                      color: const Color(0xFF7C5CDB),
                      onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const SleepInputScreen())),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _quickShortcutTile(
                      context,
                      label: 'Event',
                      icon: Icons.bookmark_add_outlined,
                      color: const Color(0xFFD97706),
                      onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const EventMarkerScreen())),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 14),

              // 5. Action Guidance Banner (Panduan Tindakan Ramah Pasien)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: triage.bgColor,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                      color: triage.color.withValues(alpha: 0.35), width: 1.2),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 9, vertical: 3.5),
                          decoration: BoxDecoration(
                            color: triage.color,
                            borderRadius: BorderRadius.circular(8),
                            boxShadow: [
                              BoxShadow(
                                color: triage.color.withValues(alpha: 0.3),
                                blurRadius: 6,
                                offset: const Offset(0, 2),
                              )
                            ],
                          ),
                          child: Text(
                            triage.code,
                            style: AppTheme.font(
                                size: 11,
                                weight: FontWeight.w800,
                                color: Colors.white),
                          ),
                        ),
                        const SizedBox(width: 9),
                        Expanded(
                          child: Text(
                            triage.title,
                            style: AppTheme.font(
                                size: 14,
                                weight: FontWeight.w700,
                                color: AppTheme.textPrimary),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      triage.description,
                      style: AppTheme.font(
                          size: 12.5,
                          color: AppTheme.textSecondary,
                          height: 1.35),
                    ),
                    const SizedBox(height: 10),
                    InkWell(
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const ActionGuidanceScreen()),
                      ),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6.5),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.9),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                              color: triage.color.withValues(alpha: 0.25)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('Buka Panduan Tindakan Lengkap',
                                style: AppTheme.font(
                                    size: 12,
                                    weight: FontWeight.w700,
                                    color: triage.color)),
                            const SizedBox(width: 4),
                            Icon(Icons.arrow_forward_rounded,
                                size: 14, color: triage.color),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 14),

              // 6. Card: Riwayat Pemantauan 24 Jam Pasien
              InkWell(
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (_) => const PatientJourneyScreen()),
                ),
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF064E3B), Color(0xFF0F766E)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: AppTheme.shadowCard,
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.18),
                            shape: BoxShape.circle),
                        child: const Icon(Icons.timeline_rounded,
                            color: Colors.white, size: 22),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Riwayat Pemantauan',
                                style: AppTheme.font(
                                    size: 13.5,
                                    weight: FontWeight.w800,
                                    color: Colors.white)),
                            const SizedBox(height: 2),
                            Text(
                                'Event ${s.events.length} • Sampel wearable ${s.wearableSamples.length}',
                                style: AppTheme.font(
                                    size: 11.5, color: Colors.white70)),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded,
                          color: Colors.white70, size: 15),
                    ],
                  ),
                ),
              ),

              // 7. Scientific Evidence RAG / Wawasan Medis Pasien
              if (s.scientificCitations.isNotEmpty) ...[
                const SectionTitle('Wawasan Medis & Edukasi Terkait',
                    padding: EdgeInsets.only(top: 22, bottom: 10)),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.borderLight),
                    boxShadow: AppTheme.shadowSoft,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.menu_book_outlined,
                              color: AppTheme.primary, size: 18),
                          const SizedBox(width: 8),
                          Text('Informasi Ilmiah untuk Pasien',
                              style: AppTheme.font(
                                  size: 13,
                                  weight: FontWeight.w700,
                                  color: AppTheme.primaryDark)),
                        ],
                      ),
                      const SizedBox(height: 8),
                      ...s.scientificCitations.take(2).map((c) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: AppTheme.fieldFill,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(c.title,
                                      style: AppTheme.font(
                                          size: 12.5, weight: FontWeight.w700)),
                                  const SizedBox(height: 3),
                                  Text(c.summary,
                                      style: AppTheme.font(
                                          size: 11.5,
                                          color: AppTheme.textSecondary,
                                          height: 1.3)),
                                ],
                              ),
                            ),
                          )),
                    ],
                  ),
                ),
              ],

              const SectionTitle('6 Panduan Memahami Tubuh Anda',
                  padding: EdgeInsets.only(top: 22, bottom: 12)),

              // 8. The 6 Pedagogical Framework Tiles
              ...s.pedagogyAnswers.map((p) => _PedagogyTile(item: p)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _metricRow(String label, String val) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2.5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              '✓ $label',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTheme.font(size: 10.5, color: Colors.white70),
            ),
          ),
          const SizedBox(width: 4),
          Text(val,
              style: AppTheme.font(
                  size: 10.5, weight: FontWeight.w700, color: Colors.white)),
        ],
      ),
    );
  }

  Widget _quickShortcutTile(
    BuildContext context, {
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.borderLight),
          boxShadow: AppTheme.shadowSoft,
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 17, color: color),
            ),
            const SizedBox(height: 5),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTheme.font(
                  size: 11,
                  weight: FontWeight.w700,
                  color: AppTheme.textPrimary),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Helper: ACC Movement Activity Selection Modal
// ---------------------------------------------------------------------------
void _showActivitySelectionModal(BuildContext context, AppState s) {
  showModalBottomSheet(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (sheetContext) {
      var isSaving = false;
      return Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppTheme.borderLight,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text('Sedang apa Anda sekarang?',
                style: AppTheme.font(size: 16, weight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(
              'Sensor mendeteksi pergerakan. Pilih aktivitas yang paling sesuai.',
              style: AppTheme.font(size: 12.5, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: kActivities.map((act) {
                final isSelected = s.activity == act.$1;
                return GestureDetector(
                  onTap: () async {
                    if (isSaving) return;
                    isSaving = true;
                    final saved = await s.confirmActivityTransition(act.$1);
                    if (!sheetContext.mounted) return;
                    if (saved) {
                      Navigator.pop(sheetContext);
                    } else {
                      isSaving = false;
                      ScaffoldMessenger.of(sheetContext).showSnackBar(
                        SnackBar(
                          content: Text(s.dataError ??
                              'Konfirmasi aktivitas gagal disimpan.'),
                        ),
                      );
                    }
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: isSelected ? AppTheme.primary : Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isSelected
                            ? AppTheme.primary
                            : AppTheme.borderLight,
                        width: isSelected ? 2 : 1,
                      ),
                      boxShadow: isSelected ? AppTheme.shadowSoft : null,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(act.$2,
                            size: 17,
                            color: isSelected
                                ? Colors.white
                                : AppTheme.textSecondary),
                        const SizedBox(width: 6),
                        Text(act.$1,
                            style: AppTheme.font(
                              size: 13,
                              weight: FontWeight.w600,
                              color: isSelected
                                  ? Colors.white
                                  : AppTheme.textPrimary,
                            )),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () {
                s.dismissActivityMovementPrompt();
                Navigator.pop(context);
              },
              child: Text('Abaikan',
                  style:
                      AppTheme.font(size: 13, color: AppTheme.textSecondary)),
            ),
          ],
        ),
      );
    },
  );
}

// ---------------------------------------------------------------------------
// Widget: ACC Sudden Movement Alert Banner
// ---------------------------------------------------------------------------
class _AccMovementAlertBanner extends StatelessWidget {
  final String currentActivity;
  final String suggestedActivity;
  final LocomotionAnalysis? analysis;
  final Future<bool> Function() onConfirm;
  final VoidCallback onDismiss;
  final VoidCallback onSelectOther;

  const _AccMovementAlertBanner({
    required this.currentActivity,
    required this.suggestedActivity,
    required this.analysis,
    required this.onConfirm,
    required this.onDismiss,
    required this.onSelectOther,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8E1),
        borderRadius: BorderRadius.circular(16),
        border:
            Border.all(color: const Color(0xFFFFCC02).withValues(alpha: 0.6)),
        boxShadow: AppTheme.shadowSoft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFCC02).withValues(alpha: 0.2),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.directions_walk,
                    color: Color(0xFFB7850A), size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Terdeteksi pergerakan!',
                      style: AppTheme.font(
                          size: 13,
                          weight: FontWeight.w700,
                          color: const Color(0xFF7A5C00)),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Pola akselerometer menyerupai $suggestedActivity. Apakah Anda sedang $suggestedActivity? Ini perkiraan sensor, bukan kepastian.',
                      style: AppTheme.font(
                          size: 11.5,
                          color: const Color(0xFF7A5C00),
                          height: 1.4),
                    ),
                  ],
                ),
              ),
              GestureDetector(
                onTap: onDismiss,
                child:
                    const Icon(Icons.close, size: 18, color: Color(0xFF7A5C00)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Aturan non-klinis: resultan = √(x²+y²+z²), lalu delta resultan dibanding rerata lokal (tanpa normalisasi sumbu). Minimal ${ActivityMotionPolicy.demo.minimumSampleSeconds.toStringAsFixed(0)} detik; cadence ${ActivityMotionPolicy.demo.minimumCadenceHz.toStringAsFixed(1)}–${ActivityMotionPolicy.demo.maximumCadenceHz.toStringAsFixed(1)} Hz; berlari mulai ${ActivityMotionPolicy.demo.runningCadenceHz.toStringAsFixed(1)} Hz; prominence ≥${ActivityMotionPolicy.demo.minimumPeakProminenceG.toStringAsFixed(2)} g; variasi interval ≤${(ActivityMotionPolicy.demo.maximumIntervalVariation * 100).round()}%.',
            style: AppTheme.font(
              size: 10.5,
              color: const Color(0xFF7A5C00),
              height: 1.35,
            ),
          ),
          if (analysis != null) ...[
            const SizedBox(height: 4),
            Text(
              'Terukur: ${analysis!.cadenceHz.toStringAsFixed(2)} Hz • ${analysis!.peakCount} puncak • RMS delta resultan ${analysis!.rmsDeltaMagnitudeG.toStringAsFixed(3)} g • variasi ${(analysis!.intervalVariation * 100).toStringAsFixed(1)}%.',
              style: AppTheme.font(
                size: 10.5,
                color: const Color(0xFF7A5C00),
                height: 1.35,
              ),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () async {
                    final saved = await onConfirm();
                    if (!saved && context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                              'Konfirmasi aktivitas gagal disimpan. Periksa koneksi lalu coba lagi.'),
                        ),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFFCC02),
                    foregroundColor: const Color(0xFF4A3800),
                    padding: const EdgeInsets.symmetric(vertical: 9),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                    elevation: 0,
                  ),
                  child: Text('Ya, Sedang $suggestedActivity',
                      style: AppTheme.font(
                          size: 12,
                          weight: FontWeight.w700,
                          color: const Color(0xFF4A3800))),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: onSelectOther,
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF7A5C00),
                  side: const BorderSide(color: Color(0xFFFFCC02)),
                  padding:
                      const EdgeInsets.symmetric(vertical: 9, horizontal: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                child: Text('Pilih Lain',
                    style: AppTheme.font(
                        size: 12,
                        weight: FontWeight.w600,
                        color: const Color(0xFF7A5C00))),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PedagogyTile extends StatelessWidget {
  final PedagogyAnswer item;
  const _PedagogyTile({required this.item});

  void _openScreen(BuildContext context) {
    Widget target;
    switch (item.number) {
      case 1:
        target = const WhereAmIScreen();
      case 2:
        target = const WhatChangedScreen();
      case 3:
        target = const WhyScreen();
      case 4:
      case 5:
        target = const RecoveryScreen();
      case 6:
      default:
        target = const ActionGuidanceScreen();
    }
    Navigator.push(context, MaterialPageRoute(builder: (_) => target));
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderLight),
        boxShadow: AppTheme.shadowSoft,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _openScreen(context),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AppTheme.primarySoft,
                    shape: BoxShape.circle,
                    border: Border.all(
                        color: AppTheme.primaryLight.withValues(alpha: 0.3)),
                  ),
                  child: Center(
                    child: Text(
                      '${item.number}',
                      style: AppTheme.font(
                          size: 13.5,
                          weight: FontWeight.w800,
                          color: AppTheme.primaryDark),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              item.question,
                              style: AppTheme.font(
                                  size: 13.5, weight: FontWeight.w700),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: item.statusColor.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              item.status,
                              style: AppTheme.font(
                                  size: 10.5,
                                  weight: FontWeight.w700,
                                  color: item.statusColor),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item.summary,
                        style: AppTheme.font(
                            size: 12,
                            color: AppTheme.textSecondary,
                            height: 1.3),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        alignment: WrapAlignment.spaceBetween,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 8,
                        runSpacing: 4,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('Lihat Penjelasan Detail',
                                  style: AppTheme.font(
                                      size: 11.5,
                                      weight: FontWeight.w700,
                                      color: AppTheme.primary)),
                              const SizedBox(width: 4),
                              const Icon(Icons.arrow_forward,
                                  size: 12, color: AppTheme.primary),
                            ],
                          ),
                          InkWell(
                            onTap: () => showModalBottomSheet(
                              context: context,
                              isScrollControlled: true,
                              backgroundColor: Colors.transparent,
                              builder: (_) => PedagogyDetailSheet(answer: item),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 4, vertical: 2),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.help_outline_rounded,
                                      size: 13, color: AppTheme.textMuted),
                                  const SizedBox(width: 3),
                                  Text('Cara Analisis',
                                      style: AppTheme.font(
                                          size: 10.5,
                                          color: AppTheme.textMuted)),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 1: Peta Lengkap Input Mobile
// ---------------------------------------------------------------------------
class _InputFlowTab extends StatelessWidget {
  const _InputFlowTab();

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: Text('Alur Catat Harian',
            style: AppTheme.font(
                size: 17,
                weight: FontWeight.w800,
                color: AppTheme.primaryDark)),
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 6, 20, 32),
        children: [
          // Banner for Guided Wizard
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppTheme.primaryDark, AppTheme.primary],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(18),
              boxShadow: AppTheme.shadowCard,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(9),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.playlist_play_rounded,
                          color: Colors.white, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Panduan Pengisian Harian',
                            style: AppTheme.font(
                                size: 15,
                                weight: FontWeight.w800,
                                color: Colors.white),
                          ),
                          Text(
                            'Pengisian bertahap yang mudah & praktis',
                            style:
                                AppTheme.font(size: 12, color: Colors.white70),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: AppTheme.primaryDark,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) =>
                              const GuidedDailyFlowScreen(initialStep: 5)),
                    ),
                    child: Text(
                      'Mulai Catat Hari Ini →',
                      style: AppTheme.font(
                          size: 13,
                          weight: FontWeight.w800,
                          color: AppTheme.primaryDark),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          Text('Atau pilih menu yang ingin Anda catat:',
              style: AppTheme.font(
                  size: 12.5,
                  color: AppTheme.textSecondary,
                  weight: FontWeight.w700)),
          const SizedBox(height: 10),

          _FlowStepCard(
            stepNumber: 1,
            title: 'Aktivitas & Gaya Hidup',
            desc:
                'Aktivitas: ${s.activity} • Stres: ${s.stress?.label ?? 'Belum dicatat'}',
            icon: Icons.directions_run_outlined,
            color: const Color(0xFF0284C7),
            onTap: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const ActivityInputScreen())),
          ),
          _FlowStepCard(
            stepNumber: 2,
            title: 'Gejala & Perasaan',
            desc:
                'Perasaan: ${s.mood.label} • Gejala: ${s.symptoms.join(", ")}',
            icon: Icons.groups_2_outlined,
            color: AppTheme.faceGreen,
            onTap: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const SymptomInputScreen())),
          ),
          _FlowStepCard(
            stepNumber: 3,
            title: 'Kualitas & Durasi Tidur',
            desc: '${s.sleepDurationLabel} (${s.sleepQuality.label})',
            icon: Icons.bedtime_outlined,
            color: const Color(0xFF7C5CDB),
            onTap: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const SleepInputScreen())),
          ),
          _FlowStepCard(
            stepNumber: 4,
            title: 'Pengukuran Mandiri (Opsional)',
            desc: 'Tekanan darah, suhu, berat badan, SpO₂',
            icon: Icons.speed_outlined,
            color: const Color(0xFF059669),
            onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                    builder: (_) => const ManualMeasurementScreen())),
          ),
          _FlowStepCard(
            stepNumber: 5,
            title: 'Tandai Momen / Event',
            desc: '${s.events.length} catatan momen tersimpan',
            icon: Icons.bookmark_add_outlined,
            color: const Color(0xFFD97706),
            onTap: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const EventMarkerScreen())),
          ),
          _FlowStepCard(
            stepNumber: 6,
            title: 'Catatan Pribadi',
            desc: s.note.isEmpty ? 'Belum ada catatan' : s.note,
            icon: Icons.edit_note_outlined,
            color: const Color(0xFF64748B),
            onTap: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const FreeNoteScreen())),
          ),
          _FlowStepCard(
            stepNumber: 7,
            title: 'Ringkasan Harian',
            desc: 'Tinjau dan simpan seluruh data hari ini',
            icon: Icons.assignment_turned_in_outlined,
            color: AppTheme.primary,
            onTap: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => const DailySummaryScreen())),
          ),
        ],
      ),
    );
  }
}

class _FlowStepCard extends StatelessWidget {
  final int stepNumber;
  final String title;
  final String desc;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _FlowStepCard({
    required this.stepNumber,
    required this.title,
    required this.desc,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderLight),
        boxShadow: AppTheme.shadowSoft,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      shape: BoxShape.circle),
                  child: Center(
                    child: Text(
                      '$stepNumber',
                      style: AppTheme.font(
                          size: 13, weight: FontWeight.w800, color: color),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: AppTheme.font(
                              size: 13.5, weight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(desc,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTheme.font(
                              size: 11.5, color: AppTheme.textSecondary)),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right,
                    size: 18, color: AppTheme.textMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
