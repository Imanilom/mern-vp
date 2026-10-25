import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../services/deviation_prompt_model.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';
import '../pedagogy/pedagogy_screen_what_changed.dart';
import '../pedagogy/pedagogy_screen_action.dart';
import '../pedagogy/pedagogy_screen_why.dart';
import '../pedagogy/patient_journey_screen.dart';
import '../pedagogy/capar_history_screen.dart';
import '../pedagogy/pedagogy_screen_recovery.dart';
import '../pedagogy/pedagogy_screen_where_am_i.dart';
import '../input/guided_daily_flow_screen.dart';
import '../input/symptom_input_screen.dart';
import '../input/activity_input_screen.dart';
import '../input/sleep_input_screen.dart';
import '../input/manual_measurement_screen.dart';
import '../input/event_marker_screen.dart';
import '../input/free_note_screen.dart';
import '../summary/daily_summary_screen.dart';
import '../profile/profile_screen.dart';
import '../actions/action_tracking_screen.dart';
import '../chat/personal_health_chat_screen.dart';
import '../impact/impact_dashboard_screen.dart';
import '../gamification/gamification_screen.dart';
import 'profile_snapshot_card.dart';
import 'wearable_monitoring_card.dart';
import 'live_heart_rate_chart.dart';

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

  void _selectTab(int index) {
    if (index < 0 || index >= 5) return;
    setState(() => _currentIndex = index);
    _queueMovementPrompt();
    if (index == 0) {
      _queueDeviationPrompt();
    }
  }

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
          title: const Text('Ada perubahan pada pola tubuh Anda'),
          content: ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 420),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _deviationPromptMessage(appState, followUp),
                  ),
                  const SizedBox(height: 12),
                  if (followUp.onsetTime != null)
                    Text(
                      'Mulai terdeteksi: ${_formatDateTime(followUp.onsetTime!)}',
                    ),
                  if (followUp.peakTime != null)
                    Text(
                      'Perubahan tertinggi: ${_formatDateTime(followUp.peakTime!)}',
                    ),
                  if (followUp.mainFactors.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Faktor utama yang terpantau: ${_factorLabel(followUp.mainFactors.first)}',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ],
                  const SizedBox(height: 10),
                  const Text(
                    'Perbandingan ini berdasarkan pola pribadi Anda, bukan diagnosis. Catatan konteks membantu memahami situasi saat itu, tetapi tidak membuktikan penyebab perubahan.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Ceritakan kondisi saat itu'),
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

  String _deviationPromptMessage(
    AppState appState,
    CaparFollowUpPrompt followUp,
  ) {
    final rawCheckIns = appState.dailySummaryData?['check_ins'];
    final checkIns = rawCheckIns is List
        ? rawCheckIns
            .whereType<Map>()
            .map((checkIn) => Map<String, dynamic>.from(checkIn))
            .toList()
        : const <Map<String, dynamic>>[];
    return const DeviationPromptModel().generate(
      followUp: followUp,
      wearable: appState.wearable,
      checkIns: checkIns,
    );
  }

  String _formatDateTime(DateTime value) =>
      '${MaterialLocalizations.of(context).formatFullDate(value.toLocal())} ${MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(value.toLocal()))}';

  String _factorLabel(Map<String, dynamic> factor) {
    final feature =
        (factor['feature'] ?? factor['key'] ?? '').toString().toLowerCase();
    final label = factor['label']?.toString() ??
        switch (feature) {
          'delta_hr' || 'hr_delta' => 'perubahan denyut jantung',
          'hr_mean' => 'denyut jantung rata-rata',
          'hr_slope' => 'kenaikan denyut jantung',
          'dfa_alpha1' => 'pola ritme jantung',
          _ => feature.isEmpty ? 'data tubuh' : feature.replaceAll('_', ' '),
        };
    return label;
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
      if (!mounted || !context.mounted || _currentIndex != 0) {
        _movementDialogVisible = false;
        return;
      }
      final navigator = Navigator.of(context, rootNavigator: true);
      final messenger = ScaffoldMessenger.of(context);
      final selectedActivity = await showDialog<String>(
        context: context,
        useRootNavigator: true,
        barrierDismissible: false,
        builder: (_) => AlertDialog(
          title: Text(appState.isPostureChangePrompt
              ? 'Terdeteksi perubahan posisi'
              : 'Terdeteksi perubahan gerak'),
          content: ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 460),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    appState.isPostureChangePrompt
                        ? 'Sensor mendeteksi perubahan orientasi/pergerakan. Sensor tidak dapat memastikan apakah Anda berubah dari duduk ke berdiri atau sebaliknya. Pilih kondisi Anda sekarang:'
                        : 'Pola akselerometer menyerupai ${appState.suggestedActivity.toLowerCase()}. Apakah Anda sedang ${appState.suggestedActivity.toLowerCase()}? Ini perkiraan sensor; konfirmasi Anda yang menentukan.',
                  ),
                  const SizedBox(height: 8),
                  Text(
                    appState.isPostureChangePrompt
                        ? 'Perkiraan non-klinis: arah rata-rata akselerasi selama sekitar 1 detik berubah ≥25° pada dua pembacaan berturut-turut. Silakan konfirmasi posisi/aktivitas Anda.'
                        : 'Aturan non-klinis: resultan √(x²+y²+z²), lalu delta terhadap rerata lokal; sumbu tidak dinormalisasi. Minimal ${ActivityMotionPolicy.demo.minimumSampleSeconds.toStringAsFixed(0)} detik, cadence ${ActivityMotionPolicy.demo.minimumCadenceHz.toStringAsFixed(1)}–${ActivityMotionPolicy.demo.maximumCadenceHz.toStringAsFixed(1)} Hz, berlari mulai ${ActivityMotionPolicy.demo.runningCadenceHz.toStringAsFixed(1)} Hz, prominence ≥${ActivityMotionPolicy.demo.minimumPeakProminenceG.toStringAsFixed(2)} g, variasi interval ≤${(ActivityMotionPolicy.demo.maximumIntervalVariation * 100).round()}%.',
                    style:
                        const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                  ),
                  if (appState.movementAnalysis != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      'Terukur: ${appState.movementAnalysis!.cadenceHz.toStringAsFixed(2)} Hz; ${appState.movementAnalysis!.peakCount} puncak; RMS delta resultan ${appState.movementAnalysis!.rmsDeltaMagnitudeG.toStringAsFixed(3)} g.',
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF6B7280)),
                    ),
                  ],
                  const SizedBox(height: 10),
                  ...kActivities.map(
                    (item) => ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(item.$2, color: AppTheme.primary),
                      title: Text(item.$1),
                      onTap: () => navigator.pop(item.$1),
                    ),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => navigator.pop('__keep_activity__'),
              child: Text('Saya tetap ${appState.activity.toLowerCase()}'),
            ),
          ],
        ),
      );
      _movementDialogVisible = false;
      if (!mounted || !context.mounted || !navigator.mounted) return;
      if (selectedActivity == null || selectedActivity == '__keep_activity__') {
        appState.dismissActivityMovementPrompt();
        return;
      }
      final saved = await appState.confirmActivityTransition(selectedActivity);
      if (!mounted || !context.mounted || !messenger.mounted) return;
      messenger.showSnackBar(
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
      const _PedagogyDashboard(),
      const _TodayOverviewTab(),
      const _InsightsHubTab(),
      const PersonalHealthChatScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF6F9F8),
      body: LayoutBuilder(
        builder: (context, constraints) => Center(
          child: SizedBox(
            width: constraints.maxWidth > 480 ? 480 : constraints.maxWidth,
            height: constraints.maxHeight,
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
                      onDestinationSelected: _selectTab,
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
                          icon: Icon(Icons.today_outlined, size: 22),
                          selectedIcon: Icon(Icons.today_rounded,
                              color: AppTheme.primary, size: 25),
                          label: 'Hari Ini',
                        ),
                        NavigationDestination(
                          icon: Icon(Icons.insights_outlined, size: 22),
                          selectedIcon: Icon(Icons.insights_rounded,
                              color: AppTheme.primary, size: 23),
                          label: 'Insight',
                        ),
                        NavigationDestination(
                          icon: Icon(Icons.auto_awesome_outlined, size: 22),
                          selectedIcon: Icon(Icons.auto_awesome_rounded,
                              color: AppTheme.primary, size: 23),
                          label: 'Tanya AI',
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
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 0: Dashboard Utama (Pemantauan Personal Ramah Pasien)
// ---------------------------------------------------------------------------
class _PedagogyDashboard extends StatelessWidget {
  const _PedagogyDashboard();

  Future<void> _openNextDailyEntry(BuildContext context, AppState state) async {
    final today = DateUtils.dateOnly(DateTime.now());
    state.update(() {
      state.logDate = today;
    });
    await state.fetchDailySummary(today);
    if (!context.mounted) return;
    final sections = state.confirmedDailySections;
    final nextStep = !sections.contains('activity')
        ? 5
        : !sections.contains('symptoms')
            ? 6
            : !sections.contains('sleep')
                ? 7
                : !sections.contains('measurements')
                    ? 8
                    : !sections.contains('note')
                        ? 10
                        : 11;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => GuidedDailyFlowScreen(initialStep: nextStep),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final triage = s.triageLevel;
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
            Text(
              'VidyaMedic',
              style: AppTheme.font(
                  size: 18.5,
                  weight: FontWeight.w800,
                  color: AppTheme.primaryDark,
                  letterSpacing: -0.3),
            ),
            const SizedBox(height: 1),
            Text(
              'PEMANTAUAN KESEHATAN PERSONAL',
              style: AppTheme.font(
                size: 9,
                weight: FontWeight.w700,
                color: AppTheme.textMuted,
                letterSpacing: 0.5,
              ),
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
                  ],
                ),
              ),

              const WearableMonitoringCard(),
              const WearableVitalsGrid(),

              const ProfileSnapshotCard(),

              _TodayHealthLogCard(
                onOpenDailyLog: () => _openNextDailyEntry(context, s),
                onOpenEvents: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const EventMarkerScreen()),
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
                  isPostureChange: s.isPostureChangePrompt,
                  analysis: s.movementAnalysis,
                  onConfirm: () =>
                      s.confirmActivityTransition(s.suggestedActivity),
                  onDismiss: () => s.dismissActivityMovementPrompt(),
                  onSelectOther: () => _showActivitySelectionModal(context, s),
                ),
              ],

              const SizedBox(height: 14),
              if (s.hasCaparRecoveryData) ...[
                const SizedBox(height: 14),
                // Show recovery only when CAPAR has evidence for a result.
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
              ],

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
                          children: [
                            Flexible(
                              child: Text(
                                'Buka Panduan Tindakan Lengkap',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTheme.font(
                                  size: 12,
                                  weight: FontWeight.w700,
                                  color: triage.color,
                                ),
                              ),
                            ),
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

              const SizedBox(height: 12),
            ],
          ),
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
  final bool isPostureChange;
  final LocomotionAnalysis? analysis;
  final Future<bool> Function() onConfirm;
  final VoidCallback onDismiss;
  final VoidCallback onSelectOther;

  const _AccMovementAlertBanner({
    required this.currentActivity,
    required this.suggestedActivity,
    required this.isPostureChange,
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
                      isPostureChange
                          ? 'Terdeteksi perubahan posisi!'
                          : 'Terdeteksi pergerakan!',
                      style: AppTheme.font(
                          size: 13,
                          weight: FontWeight.w700,
                          color: const Color(0xFF7A5C00)),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isPostureChange
                          ? 'Akselerometer menunjukkan perubahan orientasi/pergerakan. Sensor tidak dapat memastikan posisi duduk atau berdiri; pilih kondisi Anda untuk memperbarui catatan.'
                          : 'Pola akselerometer menyerupai $suggestedActivity. Apakah Anda sedang $suggestedActivity? Ini perkiraan sensor, bukan kepastian.',
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
          if (!isPostureChange)
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
                    if (isPostureChange) {
                      onSelectOther();
                      return;
                    }
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
                  child: Text(
                      isPostureChange
                          ? 'Pilih kondisi sekarang'
                          : 'Ya, Sedang $suggestedActivity',
                      style: AppTheme.font(
                          size: 12,
                          weight: FontWeight.w700,
                          color: const Color(0xFF4A3800))),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 108,
                child: OutlinedButton(
                  onPressed: onSelectOther,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF7A5C00),
                    side: const BorderSide(color: Color(0xFFFFCC02)),
                    padding:
                        const EdgeInsets.symmetric(vertical: 9, horizontal: 8),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  child: Text('Pilih Lain',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTheme.font(
                          size: 12,
                          weight: FontWeight.w600,
                          color: const Color(0xFF7A5C00))),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 1: Ringkasan aktivitas dan data hari ini
// ---------------------------------------------------------------------------
class _TodayOverviewTab extends StatelessWidget {
  const _TodayOverviewTab();

  Future<void> _openDailyFlow(BuildContext context, AppState state) async {
    final today = DateUtils.dateOnly(DateTime.now());
    state.update(() {
      state.logDate = today;
    });
    await state.fetchDailySummary(today);
    if (!context.mounted) return;
    final sections = state.confirmedDailySections;
    final nextStep = !sections.contains('activity')
        ? 5
        : !sections.contains('symptoms')
            ? 6
            : !sections.contains('sleep')
                ? 7
                : !sections.contains('measurements')
                    ? 8
                    : !sections.contains('note')
                        ? 10
                        : 11;
    await Navigator.push(
      context,
      MaterialPageRoute<void>(
        builder: (_) => GuidedDailyFlowScreen(initialStep: nextStep),
      ),
    );
  }

  Map<String, dynamic> _latestCheckIn(AppState state) {
    final raw = state.dailySummaryData?['check_ins'];
    if (raw is! List) return const {};
    for (final item in raw.reversed) {
      if (item is Map) return Map<String, dynamic>.from(item);
    }
    return const {};
  }

  List<Map<String, dynamic>> _todayReadings(AppState state) {
    final today = DateUtils.dateOnly(DateTime.now());
    final readings = <Map<String, dynamic>>[
      ...state.personalChatWearableHistory,
      ...state.wearableSamples,
      if (state.wearableBridge.isStreaming &&
          !state.wearableBridge.isDemoDevice)
        ...state.liveStreamReadings,
    ];
    final unique = <String, Map<String, dynamic>>{};
    for (final reading in readings) {
      final recordedAt =
          DateTime.tryParse(reading['recorded_at']?.toString() ?? '');
      if (recordedAt == null ||
          !DateUtils.isSameDay(recordedAt.toLocal(), today) ||
          reading['is_simulated'] == true ||
          reading['heart_rate_bpm'] is! num) {
        continue;
      }
      unique['${recordedAt.toIso8601String()}:${reading['heart_rate_bpm']}'] =
          reading;
    }
    return unique.values.toList()
      ..sort((first, second) {
        final firstAt =
            DateTime.tryParse(first['recorded_at']?.toString() ?? '');
        final secondAt =
            DateTime.tryParse(second['recorded_at']?.toString() ?? '');
        if (firstAt == null || secondAt == null) return 0;
        return firstAt.compareTo(secondAt);
      });
  }

  String _display(dynamic value, {String fallback = 'Belum dicatat'}) {
    if (value == null || value.toString().trim().isEmpty) return fallback;
    return value.toString();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final checkIn = _latestCheckIn(state);
    final sleep = checkIn['sleep'] is Map
        ? Map<String, dynamic>.from(checkIn['sleep'] as Map)
        : const <String, dynamic>{};
    final symptoms = checkIn['symptoms'] is List
        ? (checkIn['symptoms'] as List)
            .map((item) => mapApiToSymptomLabel(item.toString()))
            .join(', ')
        : '';
    final readings = _todayReadings(state);
    final events = state.events
        .where((event) =>
            DateUtils.isSameDay(event.timestamp.toLocal(), DateTime.now()))
        .toList()
      ..sort((first, second) => second.timestamp.compareTo(first.timestamp));
    final latestReading =
        readings.isEmpty ? null : readings.last['heart_rate_bpm'] as num;

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: Text(
          'Hari Ini',
          style: AppTheme.font(
              size: 17, weight: FontWeight.w800, color: AppTheme.primaryDark),
        ),
        actions: [
          IconButton(
            tooltip: 'Perbarui data hari ini',
            onPressed: state.isRefreshing ? null : state.refreshAllData,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: state.refreshAllData,
        color: AppTheme.primary,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics()),
          padding: const EdgeInsets.fromLTRB(20, 6, 20, 32),
          children: [
            Text(
              DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(DateTime.now()),
              style: AppTheme.font(size: 12, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppTheme.primaryDark, AppTheme.primary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Row(
                children: [
                  const Icon(Icons.favorite_rounded,
                      color: Colors.white, size: 26),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          latestReading == null
                              ? 'Belum ada sampel wearable hari ini'
                              : 'Denyut terakhir ${latestReading.round()} bpm',
                          style: AppTheme.font(
                              size: 14,
                              weight: FontWeight.w800,
                              color: Colors.white),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          readings.isEmpty
                              ? 'Hubungkan perangkat atau catat aktivitas Anda.'
                              : '${readings.length} sampel nyata hari ini · bukan sinyal medis langsung',
                          style: AppTheme.font(
                              size: 10.5,
                              color: Colors.white.withValues(alpha: 0.85)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Card(
              margin: const EdgeInsets.only(top: 12),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: LiveHeartRateChart(
                  readings: readings,
                  isStreaming: state.wearableBridge.isStreaming &&
                      !state.wearableBridge.isDemoDevice,
                ),
              ),
            ),
            Card(
              margin: const EdgeInsets.only(top: 12),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Ringkasan pengamatan',
                        style:
                            AppTheme.font(size: 14, weight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    _TodayMetricRow(
                      label: 'Aktivitas',
                      value: _display(
                        checkIn['activity'] == null
                            ? null
                            : mapApiToActivity(checkIn['activity'].toString()),
                        fallback: state.activity,
                      ),
                    ),
                    _TodayMetricRow(
                      label: 'Denyut jantung',
                      value: latestReading == null
                          ? 'Belum ada sampel nyata'
                          : '${latestReading.round()} bpm',
                    ),
                    _TodayMetricRow(
                      label: 'RMSSD (HRV)',
                      value: state.wearable.hrvRmssd > 0
                          ? '${state.wearable.hrvRmssd} ms'
                          : 'Belum tersedia',
                    ),
                    _TodayMetricRow(
                      label: 'Tidur',
                      value: sleep['duration_minutes'] is num
                          ? '${((sleep['duration_minutes'] as num) / 60).toStringAsFixed(1)} jam'
                          : 'Belum dicatat',
                    ),
                    _TodayMetricRow(
                      label: 'Gejala',
                      value: symptoms.isEmpty ? 'Belum dicatat' : symptoms,
                    ),
                    if (checkIn['stress_level'] != null)
                      _TodayMetricRow(
                        label: 'Stres yang dilaporkan',
                        value: checkIn['stress_level'].toString(),
                      ),
                  ],
                ),
              ),
            ),
            Card(
              margin: const EdgeInsets.only(top: 12),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text('Event hari ini',
                              style: AppTheme.font(
                                  size: 14, weight: FontWeight.w800)),
                        ),
                        TextButton(
                          onPressed: () => Navigator.push(
                            context,
                            MaterialPageRoute<void>(
                              builder: (_) => const EventMarkerScreen(),
                            ),
                          ),
                          child: const Text('Tambah'),
                        ),
                      ],
                    ),
                    if (events.isEmpty)
                      Text('Belum ada event yang dicatat hari ini.',
                          style: AppTheme.font(
                              size: 12, color: AppTheme.textSecondary))
                    else
                      ...events.take(5).map(
                            (event) => ListTile(
                              contentPadding: EdgeInsets.zero,
                              dense: true,
                              leading: Icon(event.icon, color: event.color),
                              title: Text(event.title),
                              subtitle: Text(event.details),
                              trailing: Text(
                                DateFormat('HH:mm')
                                    .format(event.timestamp.toLocal()),
                              ),
                            ),
                          ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: () => _openDailyFlow(context, state),
              icon: const Icon(Icons.edit_note_rounded),
              label: const Text('Catat Hari Ini'),
            ),
            OutlinedButton.icon(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute<void>(
                  builder: (_) => const DailySummaryScreen(),
                ),
              ),
              icon: const Icon(Icons.assignment_outlined),
              label: const Text('Lihat ringkasan dan riwayat harian'),
            ),
            OutlinedButton.icon(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute<void>(
                  builder: (_) => const _InputFlowTab(),
                ),
              ),
              icon: const Icon(Icons.playlist_add_check_rounded),
              label: const Text('Buka semua pilihan pencatatan'),
            ),
          ],
        ),
      ),
    );
  }
}

class _TodayMetricRow extends StatelessWidget {
  const _TodayMetricRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(label,
                  style:
                      AppTheme.font(size: 12, color: AppTheme.textSecondary)),
            ),
            const SizedBox(width: 12),
            Flexible(
              child: Text(value,
                  textAlign: TextAlign.end,
                  style: AppTheme.font(
                      size: 12,
                      weight: FontWeight.w700,
                      color: AppTheme.textPrimary)),
            ),
          ],
        ),
      );
}

// ---------------------------------------------------------------------------
// Tab 2: Insight dan akses fitur analisis lanjutan
// ---------------------------------------------------------------------------
class _InsightsHubTab extends StatelessWidget {
  const _InsightsHubTab();

  void _open(BuildContext context, Widget screen) {
    Navigator.push(
      context,
      MaterialPageRoute<void>(builder: (_) => screen),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final recovery = state.recoveryProgress;
    final citations = state.scientificCitations;
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: Text('Insight',
            style: AppTheme.font(
                size: 17,
                weight: FontWeight.w800,
                color: AppTheme.primaryDark)),
        actions: [
          IconButton(
            tooltip: 'Buka Tanya AI',
            onPressed: () => context
                .findAncestorStateOfType<_HomeScreenState>()
                ?._selectTab(3),
            icon: const Icon(Icons.auto_awesome_rounded),
          ),
        ],
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 6, 20, 32),
        children: [
          Text(
            'Pola, baseline, dan riwayat pemantauan Anda',
            style: AppTheme.font(size: 12, color: AppTheme.textSecondary),
          ),
          Card(
            margin: const EdgeInsets.only(top: 12),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Gambaran saat ini',
                      style: AppTheme.font(size: 14, weight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  _TodayMetricRow(
                    label: 'Sampel wearable tersinkron',
                    value: state.wearableSamples.length.toString(),
                  ),
                  _TodayMetricRow(
                    label: 'Event tercatat',
                    value: state.events.length.toString(),
                  ),
                  _TodayMetricRow(
                    label: 'Baseline pribadi',
                    value: state.hasCaparMetrics
                        ? 'Tersedia untuk ditinjau'
                        : 'Belum tersedia',
                  ),
                  _TodayMetricRow(
                    label: 'Pemulihan CAPAR',
                    value: recovery == null
                        ? 'Belum tersedia'
                        : '${recovery.round()}% · ringkasan model, bukan diagnosis',
                  ),
                  if (state.latestCaparMahalanobis?['distance'] != null)
                    _TodayMetricRow(
                      label: 'Deviasi terbaru (Mahalanobis)',
                      value:
                          state.latestCaparMahalanobis!['distance'].toString(),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text('Jelajahi insight',
              style: AppTheme.font(size: 14, weight: FontWeight.w800)),
          const SizedBox(height: 8),
          _InsightLinkCard(
            icon: Icons.timeline_rounded,
            title: 'Tren & perjalanan kesehatan',
            subtitle: 'Grafik wearable, aktivitas, dan check-in historis',
            onTap: () => _open(context, const PatientJourneyScreen()),
          ),
          _InsightLinkCard(
            icon: Icons.event_note_outlined,
            title: 'Kondisi pada tanggal tertentu',
            subtitle: 'Tinjau ringkasan dan pengukuran pada hari pilihan',
            onTap: () => _open(context, const WhereAmIScreen()),
          ),
          _InsightLinkCard(
            icon: Icons.history_rounded,
            title: 'Riwayat baseline dan CAPAR',
            subtitle: 'Baseline, deviasi, pemulihan, dan catatan longitudinal',
            onTap: () => _open(context, const CaparHistoryScreen()),
          ),
          _InsightLinkCard(
            icon: Icons.bedtime_outlined,
            title: 'Pemulihan',
            subtitle: 'Tinjau lintasan pemulihan dan data yang tersedia',
            onTap: () => _open(context, const RecoveryScreen()),
          ),
          _InsightLinkCard(
            icon: Icons.location_searching_rounded,
            title: 'Apa yang berubah?',
            subtitle: 'Buka penjelasan perubahan terbaru dan konteksnya',
            onTap: () => _open(context, const WhatChangedScreen()),
          ),
          _InsightLinkCard(
            icon: Icons.lightbulb_outline_rounded,
            title: 'Mengapa perubahan mungkin terjadi?',
            subtitle:
                'Tinjau faktor terkait sebagai asosiasi, bukan sebab pasti',
            onTap: () => _open(context, const WhyScreen()),
          ),
          _InsightLinkCard(
            icon: Icons.checklist_rounded,
            title: 'Panduan tindakan',
            subtitle: 'Panduan non-diagnostik berdasarkan data yang tersedia',
            onTap: () => _open(context, const ActionGuidanceScreen()),
          ),
          _InsightLinkCard(
            icon: Icons.task_alt_outlined,
            title: 'Tindakan & tindak lanjut',
            subtitle: 'Catat dan tinjau tindakan yang sudah dilakukan',
            onTap: () => _open(context, const ActionTrackingScreen()),
          ),
          _InsightLinkCard(
            icon: Icons.health_and_safety_outlined,
            title: 'Dampak & keselamatan',
            subtitle: 'Ketersediaan data, outcome, dan tata kelola',
            onTap: () => _open(context, const ImpactDashboardScreen()),
          ),
          _InsightLinkCard(
            icon: Icons.emoji_events_outlined,
            title: 'Komunitas',
            subtitle: 'Koin, papan skor, dan pengaturan keikutsertaan',
            onTap: () => _open(context, const GamificationScreen()),
          ),
          _InsightLinkCard(
            icon: Icons.science_outlined,
            title: 'Skenario HCI A/B/C',
            subtitle: 'Buka fitur skenario penelitian yang tersedia',
            onTap: () => Navigator.pushNamed(context, '/scenarios'),
          ),
          if (citations.isNotEmpty) ...[
            const SizedBox(height: 14),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Wawasan ilmiah terkait',
                        style:
                            AppTheme.font(size: 14, weight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text(
                      'Relevansi topik literatur tidak membuktikan sebab-akibat atau diagnosis pada diri Anda.',
                      style: AppTheme.font(
                          size: 11,
                          color: AppTheme.textSecondary,
                          height: 1.35),
                    ),
                    const SizedBox(height: 8),
                    ...citations.take(4).map(
                          (citation) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            dense: true,
                            leading: const Icon(Icons.menu_book_outlined,
                                color: AppTheme.primary),
                            title: Text(citation.title),
                            subtitle: Text(citation.summary),
                          ),
                        ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _InsightLinkCard extends StatelessWidget {
  const _InsightLinkCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(bottom: 8),
        child: ListTile(
          leading: CircleAvatar(
            backgroundColor: AppTheme.primarySoft,
            child: Icon(icon, color: AppTheme.primary),
          ),
          title: Text(title,
              style: AppTheme.font(size: 12.5, weight: FontWeight.w700)),
          subtitle: Text(subtitle,
              style: AppTheme.font(size: 10.5, color: AppTheme.textSecondary)),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: onTap,
        ),
      );
}

// ---------------------------------------------------------------------------
// Tab 6: Peta Lengkap Input Mobile
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

class _TodayHealthLogCard extends StatelessWidget {
  const _TodayHealthLogCard({
    required this.onOpenDailyLog,
    required this.onOpenEvents,
  });

  final VoidCallback onOpenDailyLog;
  final VoidCallback onOpenEvents;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final isCurrentDay = DateUtils.isSameDay(state.logDate, DateTime.now());
    final todayEvents = state.events
        .where((event) => DateUtils.isSameDay(event.timestamp, DateTime.now()))
        .toList();
    final symptoms = state.symptoms.where((value) => value != kNoSymptom);
    final symptomSummary =
        isCurrentDay && state.confirmedDailySections.contains('symptoms')
            ? symptoms.isEmpty
                ? 'Tidak ada keluhan'
                : symptoms.join(', ')
            : 'Belum dicatat';
    final activitySummary =
        isCurrentDay && state.confirmedDailySections.contains('activity')
            ? [
                state.activity,
                if (state.stress != null) 'Stres ${state.stress!.label}',
              ].join(' · ')
            : 'Belum dicatat';
    final sleepSummary = isCurrentDay &&
            state.confirmedDailySections.contains('sleep') &&
            state.sleepMinutes > 0
        ? '${state.sleepMinutes ~/ 60} jam ${state.sleepMinutes % 60} menit · ${state.sleepQuality.label}'
        : 'Belum dicatat';
    const dailySections = [
      'activity',
      'symptoms',
      'sleep',
      'measurements',
      'note',
    ];
    final completedSections = isCurrentDay
        ? dailySections.where(state.confirmedDailySections.contains).length
        : 0;

    return Card(
      margin: const EdgeInsets.only(top: 12),
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: AppTheme.borderLight),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const CircleAvatar(
                  backgroundColor: AppTheme.primarySoft,
                  child: Icon(Icons.today_outlined, color: AppTheme.primary),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Catatan Hari Ini',
                          style:
                              AppTheme.font(size: 14, weight: FontWeight.w800)),
                      Text(
                        DateFormat('EEEE, d MMMM yyyy', 'id_ID')
                            .format(DateTime.now()),
                        style: AppTheme.font(
                            size: 10.5, color: AppTheme.textSecondary),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Tambah event',
                  onPressed: onOpenEvents,
                  icon: const Icon(Icons.add_circle_outline_rounded),
                ),
              ],
            ),
            const SizedBox(height: 8),
            _todayLogRow('Perasaan & gejala', symptomSummary),
            _todayLogRow('Aktivitas', activitySummary),
            _todayLogRow('Tidur', sleepSummary),
            _todayLogRow(
              'Event',
              todayEvents.isEmpty
                  ? 'Belum ada event'
                  : todayEvents.map((event) => event.title).join(', '),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Progres catatan hari ini',
                    style: AppTheme.font(size: 11, weight: FontWeight.w700),
                  ),
                ),
                Text(
                  '$completedSections/${dailySections.length}',
                  style: AppTheme.font(
                    size: 11,
                    weight: FontWeight.w800,
                    color: AppTheme.primary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 5),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: completedSections / dailySections.length,
                minHeight: 5,
                backgroundColor: AppTheme.fieldFill,
                color: AppTheme.primary,
              ),
            ),
            if (isCurrentDay &&
                state.confirmedDailySections.contains('note') &&
                state.note.trim().isNotEmpty) ...[
              const SizedBox(height: 5),
              Text(
                state.note,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: AppTheme.font(
                    size: 11, color: AppTheme.textSecondary, height: 1.35),
              ),
            ],
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: onOpenDailyLog,
                icon: const Icon(Icons.edit_note_rounded, size: 18),
                label: const Text('Lengkapi catatan'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _todayLogRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 112,
            child: Text(label,
                style: AppTheme.font(size: 10.5, color: AppTheme.textMuted)),
          ),
          Expanded(
            child: Text(
              value,
              style: AppTheme.font(
                  size: 10.5,
                  color: value == 'Belum dicatat' || value == 'Belum ada event'
                      ? AppTheme.textMuted
                      : AppTheme.textPrimary,
                  weight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
